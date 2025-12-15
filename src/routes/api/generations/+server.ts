import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createGeneration,
	updateGenerationTaskId,
	updateGenerationStatus,
	getProject
} from '$lib/db.server';
import { generateMusic } from '$lib/kie-api.server';
import { notifyClients } from '$lib/sse.server';
import { pollForResults } from '$lib/polling.server';

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
