import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createGeneration,
	updateGenerationTaskId,
	updateGenerationStatus,
	updateGenerationTracks,
	completeGeneration,
	getProject
} from '$lib/db.server';
import { generateMusic, getMusicDetails, isErrorStatus, isCompleteStatus } from '$lib/kie-api.server';
import { notifyClients } from '$lib/sse.server';

export const POST: RequestHandler = async ({ request }) => {
	const { projectId, title, style, lyrics } = await request.json();

	if (!projectId || !title || !style || !lyrics) {
		throw error(400, 'Missing required fields');
	}

	const project = getProject(projectId);
	if (!project) {
		throw error(404, 'Project not found');
	}

	// Create generation record
	const generation = createGeneration(projectId, title, style, lyrics);

	// Start async generation process
	startGeneration(generation.id, title, style, lyrics).catch(console.error);

	return json(generation);
};

async function startGeneration(generationId: number, title: string, style: string, lyrics: string) {
	try {
		// Call KIE API to generate music
		const response = await generateMusic({
			prompt: lyrics,
			style,
			title,
			customMode: true,
			instrumental: false,
			model: 'V5',
			callBackUrl: 'https://api.example.com/callback',
			negativeTags: ''
		});

		if (response.code !== 200) {
			updateGenerationStatus(generationId, 'error', response.msg);
			notifyClients(generationId, 'generation_error', { status: 'error', error_message: response.msg });
			return;
		}

		const taskId = response.data.taskId;
		updateGenerationTaskId(generationId, taskId);
		notifyClients(generationId, 'generation_update', { status: 'processing', task_id: taskId });

		// Start polling for results
		pollForResults(generationId, taskId);
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Unknown error';
		updateGenerationStatus(generationId, 'error', errorMessage);
		notifyClients(generationId, 'generation_error', { status: 'error', error_message: errorMessage });
	}
}

async function pollForResults(generationId: number, taskId: string) {
	const maxAttempts = 120; // 10 minutes with 5-second intervals
	let attempts = 0;

	const poll = async () => {
		attempts++;
		console.log(`[Poll #${attempts}] Checking taskId: ${taskId} for generation ${generationId}`);

		try {
			const details = await getMusicDetails(taskId);
			console.log(`[Poll #${attempts}] Status: ${details.data?.status}`);

			if (details.code !== 200) {
				updateGenerationStatus(generationId, 'error', details.msg);
				notifyClients(generationId, 'generation_error', { status: 'error', error_message: details.msg });
				return;
			}

			const { status, errorMessage } = details.data;

			if (isErrorStatus(status)) {
				console.log(`[Poll #${attempts}] ERROR status detected: ${status}`);
				updateGenerationStatus(generationId, 'error', errorMessage || status);
				notifyClients(generationId, 'generation_error', {
					status: 'error',
					error_message: errorMessage || status
				});
				return;
			}

			if (isCompleteStatus(status)) {
				console.log(`[Poll #${attempts}] COMPLETE status detected: ${status}`);
				const sunoData = details.data.response?.sunoData || [];
				const track1 = sunoData[0];
				const track2 = sunoData[1];

				if (track1 && track2) {
					console.log(`[Poll #${attempts}] Completing generation with both tracks`);
					completeGeneration(
						generationId,
						'success',
						{
							streamUrl: track1.streamAudioUrl,
							audioUrl: track1.audioUrl,
							imageUrl: track1.imageUrl,
							duration: track1.duration,
							audioId: track1.id
						},
						{
							streamUrl: track2.streamAudioUrl,
							audioUrl: track2.audioUrl,
							imageUrl: track2.imageUrl,
							duration: track2.duration,
							audioId: track2.id
						},
						JSON.stringify(details.data)
					);

					notifyClients(generationId, 'generation_complete', {
						status: 'success',
						track1_stream_url: track1.streamAudioUrl,
						track1_audio_url: track1.audioUrl,
						track1_image_url: track1.imageUrl,
						track1_duration: track1.duration,
						track2_stream_url: track2.streamAudioUrl,
						track2_audio_url: track2.audioUrl,
						track2_image_url: track2.imageUrl,
						track2_duration: track2.duration,
						response_data: JSON.stringify(details.data)
					});
					return;
				}
			}

			// Update status based on API status
			const statusMap: Record<string, string> = {
				PENDING: 'processing',
				TEXT_SUCCESS: 'text_success',
				FIRST_SUCCESS: 'first_success'
			};

			const newStatus = statusMap[status] || 'processing';
			updateGenerationStatus(generationId, newStatus);

			// Check for streaming URLs in text_success or first_success
			if ((status === 'TEXT_SUCCESS' || status === 'FIRST_SUCCESS') && details.data.response?.sunoData) {
				console.log(`[Poll #${attempts}] Intermediate status with stream URLs: ${status}`);
				const sunoData = details.data.response.sunoData;
				const track1 = sunoData[0];
				const track2 = sunoData[1];

				if (track1?.streamAudioUrl || track2?.streamAudioUrl) {
					console.log(`[Poll #${attempts}] Updating stream URLs - Track1: ${!!track1?.streamAudioUrl}, Track2: ${!!track2?.streamAudioUrl}`);
					updateGenerationTracks(
						generationId,
						{
							streamUrl: track1?.streamAudioUrl,
							imageUrl: track1?.imageUrl,
							audioId: track1?.id
						},
						{
							streamUrl: track2?.streamAudioUrl,
							imageUrl: track2?.imageUrl,
							audioId: track2?.id
						}
					);

					// Notify with stream URLs
					notifyClients(generationId, 'generation_update', {
						status: newStatus,
						track1_stream_url: track1?.streamAudioUrl,
						track1_image_url: track1?.imageUrl,
						track2_stream_url: track2?.streamAudioUrl,
						track2_image_url: track2?.imageUrl
					});
					// Don't return - continue polling until final SUCCESS
				}
			} else {
				// Only notify if we didn't already notify with stream URLs above
				notifyClients(generationId, 'generation_update', { status: newStatus });
			}

			// Continue polling if not complete and under max attempts
			if (attempts < maxAttempts) {
				console.log(`[Poll #${attempts}] Continuing to poll in 5 seconds...`);
				setTimeout(poll, 5000);
			} else {
				updateGenerationStatus(generationId, 'error', 'Generation timed out');
				notifyClients(generationId, 'generation_error', {
					status: 'error',
					error_message: 'Generation timed out'
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			if (attempts < maxAttempts) {
				setTimeout(poll, 5000);
			} else {
				updateGenerationStatus(generationId, 'error', errorMessage);
				notifyClients(generationId, 'generation_error', {
					status: 'error',
					error_message: errorMessage
				});
			}
		}
	};

	poll();
}
