import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createProject, createImportedGeneration } from '$lib/db.server';
import { getMusicDetails, isCompleteStatus, isErrorStatus } from '$lib/kie-api.server';

// ============================================================================
// Type Guards for Request/Response Validation
// ============================================================================

interface ImportRequestBody {
	taskId: string;
	projectName?: string;
}

function isImportRequestBody(value: unknown): value is ImportRequestBody {
	return (
		typeof value === 'object' &&
		value !== null &&
		'taskId' in value &&
		typeof (value as ImportRequestBody).taskId === 'string'
	);
}

interface KIETrack {
	id: string;
	audioUrl: string;
	streamAudioUrl?: string;
	imageUrl?: string;
	title?: string;
	tags?: string;
	prompt?: string;
	duration?: number;
}

function isKIETrack(value: unknown): value is KIETrack {
	return (
		typeof value === 'object' &&
		value !== null &&
		'id' in value &&
		typeof (value as KIETrack).id === 'string' &&
		(value as KIETrack).id.length > 0 &&
		'audioUrl' in value &&
		typeof (value as KIETrack).audioUrl === 'string' &&
		(value as KIETrack).audioUrl.length > 0
	);
}

interface KIEResponseData {
	status: string;
	errorMessage?: string | null;
	response?: {
		sunoData?: unknown[];
	} | null;
}

function isKIEResponseData(value: unknown): value is KIEResponseData {
	return (
		typeof value === 'object' &&
		value !== null &&
		'status' in value &&
		typeof (value as KIEResponseData).status === 'string'
	);
}

interface KIEMusicDetailsResponse {
	code: number;
	msg?: string;
	data?: unknown;
}

function isKIEMusicDetailsResponse(value: unknown): value is KIEMusicDetailsResponse {
	return (
		typeof value === 'object' &&
		value !== null &&
		'code' in value &&
		typeof (value as KIEMusicDetailsResponse).code === 'number'
	);
}

// ============================================================================
// Request Handler
// ============================================================================

export const POST: RequestHandler = async ({ request }) => {
	// 1. Request body validation
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!isImportRequestBody(body)) {
		return json({ error: 'Task ID is required and must be a string' }, { status: 400 });
	}

	const trimmedTaskId = body.taskId.trim();
	if (!trimmedTaskId) {
		return json({ error: 'Task ID cannot be empty' }, { status: 400 });
	}

	const projectName = body.projectName;

	// 2. KIE API call with detailed error handling
	let details: unknown;
	try {
		details = await getMusicDetails(trimmedTaskId);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error('Failed to fetch music details from KIE:', message);

		if (message.includes('404')) {
			return json(
				{ error: 'Task ID not found. Please verify the ID is correct.' },
				{ status: 404 }
			);
		}
		if (message.includes('401') || message.includes('403')) {
			return json(
				{ error: 'API authentication failed. Please check server configuration.' },
				{ status: 502 }
			);
		}
		return json(
			{ error: 'Failed to fetch song data from KIE API. Please try again later.' },
			{ status: 502 }
		);
	}

	// 3. Response structure validation using type guards
	if (!isKIEMusicDetailsResponse(details)) {
		console.error('Invalid KIE API response structure:', details);
		return json({ error: 'Invalid response from KIE API' }, { status: 502 });
	}

	if (details.code !== 200) {
		console.error('KIE API returned error code:', details.code, details.msg);
		return json({ error: `KIE API error: ${details.msg || 'Unknown error'}` }, { status: 502 });
	}

	if (!isKIEResponseData(details.data)) {
		console.error('KIE API response missing or invalid data field:', details.data);
		return json({ error: 'Invalid response structure from KIE API' }, { status: 502 });
	}

	const responseData = details.data;
	const { status, errorMessage, response } = responseData;

	// 4. Generation status validation
	if (isErrorStatus(status)) {
		const statusMessages: Record<string, string> = {
			CREATE_TASK_FAILED: 'The generation task failed to start',
			GENERATE_AUDIO_FAILED: 'Audio generation failed',
			CALLBACK_EXCEPTION: 'A processing error occurred',
			SENSITIVE_WORD_ERROR: 'Content was flagged for policy violations'
		};
		const friendlyMessage = statusMessages[status] || status;
		return json(
			{ error: `Cannot import: ${friendlyMessage}${errorMessage ? ` - ${errorMessage}` : ''}` },
			{ status: 400 }
		);
	}

	if (!isCompleteStatus(status)) {
		const statusMessages: Record<string, string> = {
			PENDING: 'still queued',
			TEXT_SUCCESS: 'generating audio',
			FIRST_SUCCESS: 'finishing up'
		};
		const friendlyStatus = statusMessages[status] || status;
		return json(
			{
				error: `Cannot import: generation is ${friendlyStatus}. Please wait until it completes and try again.`
			},
			{ status: 400 }
		);
	}

	// 5. Track data validation using type guards
	const sunoData = response?.sunoData;
	if (!Array.isArray(sunoData) || sunoData.length === 0) {
		console.error('KIE API response missing sunoData array');
		return json({ error: 'No tracks found in this generation' }, { status: 400 });
	}

	const track1Raw = sunoData[0];
	const track2Raw = sunoData[1];

	if (!isKIETrack(track1Raw)) {
		console.error('Track 1 missing required fields or invalid:', track1Raw);
		return json({ error: 'Track 1 data is incomplete or corrupted' }, { status: 400 });
	}

	// Track 2 is optional but if present, validate it
	let track2: KIETrack | null = null;
	if (track2Raw !== undefined) {
		if (!isKIETrack(track2Raw)) {
			console.error('Track 2 missing required fields or invalid:', track2Raw);
			return json({ error: 'Track 2 data is incomplete or corrupted' }, { status: 400 });
		}
		track2 = track2Raw;
	}

	// Type-safe track references
	const track1: KIETrack = track1Raw;

	// 6. Database operations with error handling
	try {
		const defaultName = projectName?.trim() || `Imported: ${track1.title || 'Unknown Song'}`;
		const project = createProject(defaultName);

		const generation = createImportedGeneration(
			project.id,
			trimmedTaskId,
			track1.title || 'Imported Song',
			track1.tags || '',
			track1.prompt || '',
			{
				streamUrl: track1.streamAudioUrl || '',
				audioUrl: track1.audioUrl,
				imageUrl: track1.imageUrl || '',
				duration: track1.duration || 0,
				audioId: track1.id
			},
			{
				streamUrl: track2?.streamAudioUrl || '',
				audioUrl: track2?.audioUrl || '',
				imageUrl: track2?.imageUrl || '',
				duration: track2?.duration || 0,
				audioId: track2?.id || ''
			},
			JSON.stringify(responseData)
		);

		return json({
			success: true,
			project: {
				id: project.id,
				name: project.name
			},
			generation: {
				id: generation.id,
				title: generation.title
			}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error('Database error during import:', message);
		return json(
			{ error: 'Failed to save imported song to database. Please try again.' },
			{ status: 500 }
		);
	}
};
