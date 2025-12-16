import {
	updateGenerationStatus,
	updateGenerationTracks,
	completeGeneration,
	type Generation,
	updateStemSeparationStatus,
	completeStemSeparation,
	type StemSeparation
} from '$lib/db.server';
import {
	getMusicDetails,
	isErrorStatus,
	isCompleteStatus,
	getStemSeparationDetails,
	isStemSeparationErrorStatus,
	isStemSeparationCompleteStatus
} from '$lib/kie-api.server';
import { notifyClients, notifyStemSeparationClients } from '$lib/sse.server';

/**
 * Poll for generation results from the KIE API.
 * This function is extracted to be reusable for both new generations and recovery.
 */
export async function pollForResults(
	generationId: number,
	taskId: string,
	options: { isRecovery?: boolean } = {}
): Promise<void> {
	const maxAttempts = 120; // 10 minutes with 5-second intervals
	let attempts = 0;
	const prefix = options.isRecovery ? '[Recovery]' : '';

	const poll = async () => {
		attempts++;
		console.log(
			`${prefix}[Poll #${attempts}] Checking taskId: ${taskId} for generation ${generationId}`
		);

		try {
			const details = await getMusicDetails(taskId);
			console.log(`${prefix}[Poll #${attempts}] Status: ${details.data?.status}`);

			if (details.code !== 200) {
				updateGenerationStatus(generationId, 'error', details.msg);
				notifyClients(generationId, 'generation_error', {
					status: 'error',
					error_message: details.msg
				});
				return;
			}

			const { status, errorMessage } = details.data;

			if (isErrorStatus(status)) {
				console.log(`${prefix}[Poll #${attempts}] ERROR status detected: ${status}`);
				updateGenerationStatus(generationId, 'error', errorMessage || status);
				notifyClients(generationId, 'generation_error', {
					status: 'error',
					error_message: errorMessage || status
				});
				return;
			}

			if (isCompleteStatus(status)) {
				console.log(`${prefix}[Poll #${attempts}] COMPLETE status detected: ${status}`);
				const sunoData = details.data.response?.sunoData || [];
				const track1 = sunoData[0];
				const track2 = sunoData[1];

				if (track1 && track2) {
					console.log(`${prefix}[Poll #${attempts}] Completing generation with both tracks`);
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
						track1_audio_id: track1.id,
						track2_stream_url: track2.streamAudioUrl,
						track2_audio_url: track2.audioUrl,
						track2_image_url: track2.imageUrl,
						track2_duration: track2.duration,
						track2_audio_id: track2.id,
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
			if (
				(status === 'TEXT_SUCCESS' || status === 'FIRST_SUCCESS') &&
				details.data.response?.sunoData
			) {
				console.log(`${prefix}[Poll #${attempts}] Intermediate status with stream URLs: ${status}`);
				const sunoData = details.data.response.sunoData;
				const track1 = sunoData[0];
				const track2 = sunoData[1];

				if (track1?.streamAudioUrl || track2?.streamAudioUrl) {
					console.log(
						`${prefix}[Poll #${attempts}] Updating stream URLs - Track1: ${!!track1?.streamAudioUrl}, Track2: ${!!track2?.streamAudioUrl}`
					);
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
				console.log(`${prefix}[Poll #${attempts}] Continuing to poll in 5 seconds...`);
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

/**
 * Recover incomplete generations by resuming polling.
 * Called on server startup to handle generations interrupted by server shutdown.
 */
export function recoverIncompleteGenerations(generations: Generation[]): void {
	if (generations.length === 0) {
		console.log('[Recovery] No incomplete generations to recover');
		return;
	}

	console.log(`[Recovery] Found ${generations.length} incomplete generation(s) to recover`);

	for (const generation of generations) {
		if (!generation.task_id) {
			// Generation was created but never got a task_id - mark as error
			console.log(`[Recovery] Generation ${generation.id} has no task_id, marking as error`);
			updateGenerationStatus(generation.id, 'error', 'Generation interrupted before task creation');
			continue;
		}

		console.log(
			`[Recovery] Resuming polling for generation ${generation.id} (taskId: ${generation.task_id}, status: ${generation.status})`
		);
		pollForResults(generation.id, generation.task_id, { isRecovery: true });
	}
}

/**
 * Poll for stem separation results from the KIE API.
 */
export async function pollForStemSeparationResults(
	stemSeparationId: number,
	taskId: string,
	generationId: number,
	audioId: string,
	options: { isRecovery?: boolean } = {}
): Promise<void> {
	const maxAttempts = 120; // 10 minutes with 5-second intervals
	let attempts = 0;
	const prefix = options.isRecovery ? '[Recovery]' : '';

	const poll = async () => {
		attempts++;
		console.log(
			`${prefix}[StemPoll #${attempts}] Checking taskId: ${taskId} for stem separation ${stemSeparationId}`
		);

		try {
			const details = await getStemSeparationDetails(taskId);
			console.log(`${prefix}[StemPoll #${attempts}] Status: ${details.data?.successFlag}`);

			if (details.code !== 200) {
				updateStemSeparationStatus(stemSeparationId, 'error', details.msg);
				notifyStemSeparationClients(
					stemSeparationId,
					generationId,
					audioId,
					'stem_separation_error',
					{
						status: 'error',
						error_message: details.msg
					}
				);
				return;
			}

			const { successFlag, errorMessage, response } = details.data;

			if (isStemSeparationErrorStatus(successFlag)) {
				console.log(`${prefix}[StemPoll #${attempts}] ERROR status detected: ${successFlag}`);
				updateStemSeparationStatus(stemSeparationId, 'error', errorMessage || successFlag);
				notifyStemSeparationClients(
					stemSeparationId,
					generationId,
					audioId,
					'stem_separation_error',
					{
						status: 'error',
						error_message: errorMessage || successFlag
					}
				);
				return;
			}

			if (isStemSeparationCompleteStatus(successFlag) && response) {
				console.log(`${prefix}[StemPoll #${attempts}] COMPLETE status detected`);

				completeStemSeparation(
					stemSeparationId,
					{
						vocalUrl: response.vocalUrl || undefined,
						instrumentalUrl: response.instrumentalUrl || undefined,
						backingVocalsUrl: response.backingVocalsUrl || undefined,
						drumsUrl: response.drumsUrl || undefined,
						bassUrl: response.bassUrl || undefined,
						guitarUrl: response.guitarUrl || undefined,
						keyboardUrl: response.keyboardUrl || undefined,
						pianoUrl: response.pianoUrl || undefined,
						percussionUrl: response.percussionUrl || undefined,
						stringsUrl: response.stringsUrl || undefined,
						synthUrl: response.synthUrl || undefined,
						fxUrl: response.fxUrl || undefined,
						brassUrl: response.brassUrl || undefined,
						woodwindsUrl: response.woodwindsUrl || undefined
					},
					JSON.stringify(details.data)
				);

				notifyStemSeparationClients(
					stemSeparationId,
					generationId,
					audioId,
					'stem_separation_complete',
					{
						status: 'success',
						vocal_url: response.vocalUrl,
						instrumental_url: response.instrumentalUrl,
						backing_vocals_url: response.backingVocalsUrl,
						drums_url: response.drumsUrl,
						bass_url: response.bassUrl,
						guitar_url: response.guitarUrl,
						keyboard_url: response.keyboardUrl,
						piano_url: response.pianoUrl,
						percussion_url: response.percussionUrl,
						strings_url: response.stringsUrl,
						synth_url: response.synthUrl,
						fx_url: response.fxUrl,
						brass_url: response.brassUrl,
						woodwinds_url: response.woodwindsUrl
					}
				);
				return;
			}

			// Continue polling if still pending
			updateStemSeparationStatus(stemSeparationId, 'processing');
			notifyStemSeparationClients(
				stemSeparationId,
				generationId,
				audioId,
				'stem_separation_update',
				{
					status: 'processing'
				}
			);

			if (attempts < maxAttempts) {
				console.log(`${prefix}[StemPoll #${attempts}] Continuing to poll in 5 seconds...`);
				setTimeout(poll, 5000);
			} else {
				updateStemSeparationStatus(stemSeparationId, 'error', 'Stem separation timed out');
				notifyStemSeparationClients(
					stemSeparationId,
					generationId,
					audioId,
					'stem_separation_error',
					{
						status: 'error',
						error_message: 'Stem separation timed out'
					}
				);
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			console.error(`${prefix}[StemPoll #${attempts}] Error:`, errorMessage);
			if (attempts < maxAttempts) {
				setTimeout(poll, 5000);
			} else {
				updateStemSeparationStatus(stemSeparationId, 'error', errorMessage);
				notifyStemSeparationClients(
					stemSeparationId,
					generationId,
					audioId,
					'stem_separation_error',
					{
						status: 'error',
						error_message: errorMessage
					}
				);
			}
		}
	};

	poll();
}

/**
 * Recover incomplete stem separations by resuming polling.
 */
export function recoverIncompleteStemSeparations(separations: StemSeparation[]): void {
	if (separations.length === 0) {
		console.log('[Recovery] No incomplete stem separations to recover');
		return;
	}

	console.log(`[Recovery] Found ${separations.length} incomplete stem separation(s) to recover`);

	for (const separation of separations) {
		if (!separation.task_id) {
			console.log(`[Recovery] Stem separation ${separation.id} has no task_id, marking as error`);
			updateStemSeparationStatus(
				separation.id,
				'error',
				'Stem separation interrupted before task creation'
			);
			continue;
		}

		console.log(
			`[Recovery] Resuming polling for stem separation ${separation.id} (taskId: ${separation.task_id}, status: ${separation.status})`
		);
		pollForStemSeparationResults(
			separation.id,
			separation.task_id,
			separation.generation_id,
			separation.audio_id,
			{ isRecovery: true }
		);
	}
}
