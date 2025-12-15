import { KIE_API_KEY } from './constants.server';

const KIE_API_BASE = 'https://api.kie.ai/api/v1';

export interface GenerateMusicRequest {
	prompt: string;
	style: string;
	title: string;
	customMode: boolean;
	instrumental: boolean;
	model: 'V4' | 'V4_5' | 'V4_5PLUS' | 'V4_5ALL' | 'V5';
	callBackUrl: string;
	negativeTags?: string;
}

export interface GenerateMusicResponse {
	code: number;
	msg: string;
	data: {
		taskId: string;
	};
}

export interface SunoTrack {
	id: string;
	audioUrl: string;
	streamAudioUrl: string;
	imageUrl: string;
	prompt: string;
	modelName: string;
	title: string;
	tags: string;
	createTime: string;
	duration: number;
}

export interface MusicDetailsResponse {
	code: number;
	msg: string;
	data: {
		taskId: string;
		parentMusicId: string;
		param: string;
		response: {
			taskId: string;
			sunoData: SunoTrack[];
		};
		status:
			| 'PENDING'
			| 'TEXT_SUCCESS'
			| 'FIRST_SUCCESS'
			| 'SUCCESS'
			| 'CREATE_TASK_FAILED'
			| 'GENERATE_AUDIO_FAILED'
			| 'CALLBACK_EXCEPTION'
			| 'SENSITIVE_WORD_ERROR';
		type: string;
		errorCode: string | null;
		errorMessage: string | null;
	};
}

export async function generateMusic(request: GenerateMusicRequest): Promise<GenerateMusicResponse> {
	const response = await fetch(`${KIE_API_BASE}/generate`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${KIE_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(request)
	});

	if (!response.ok) {
		throw new Error(`KIE API error: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

export async function getMusicDetails(taskId: string): Promise<MusicDetailsResponse> {
	const response = await fetch(`${KIE_API_BASE}/generate/record-info?taskId=${taskId}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${KIE_API_KEY}`
		}
	});

	if (!response.ok) {
		throw new Error(`KIE API error: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

export function isErrorStatus(status: string): boolean {
	return [
		'CREATE_TASK_FAILED',
		'GENERATE_AUDIO_FAILED',
		'CALLBACK_EXCEPTION',
		'SENSITIVE_WORD_ERROR'
	].includes(status);
}

export function isCompleteStatus(status: string): boolean {
	return status === 'SUCCESS';
}

export function isInProgressStatus(status: string): boolean {
	return ['PENDING', 'TEXT_SUCCESS', 'FIRST_SUCCESS'].includes(status);
}
