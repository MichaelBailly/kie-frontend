// Shared types between server and client

export interface Project {
	id: number;
	name: string;
	created_at: string;
	updated_at: string;
}

export interface Generation {
	id: number;
	project_id: number;
	task_id: string | null;
	title: string;
	style: string;
	lyrics: string;
	status: string;
	error_message: string | null;
	track1_stream_url: string | null;
	track1_audio_url: string | null;
	track1_image_url: string | null;
	track1_duration: number | null;
	track2_stream_url: string | null;
	track2_audio_url: string | null;
	track2_image_url: string | null;
	track2_duration: number | null;
	track1_audio_id: string | null;
	track2_audio_id: string | null;
	response_data: string | null;
	extends_generation_id: number | null;
	extends_audio_id: string | null;
	continue_at: number | null;
	created_at: string;
	updated_at: string;
}

export interface SSEMessage {
	type: 'generation_update' | 'generation_complete' | 'generation_error';
	generationId: number;
	data: Partial<Generation>;
}

export type GenerationStatus =
	| 'pending'
	| 'processing'
	| 'text_success'
	| 'first_success'
	| 'success'
	| 'error';

export function getStatusLabel(status: string): string {
	const labels: Record<string, string> = {
		pending: 'Pending',
		processing: 'Processing',
		text_success: 'Generating audio...',
		first_success: 'Finishing up...',
		success: 'Complete',
		error: 'Failed'
	};
	return labels[status] || status;
}

export function isGenerating(status: string): boolean {
	return ['pending', 'processing', 'text_success', 'first_success'].includes(status);
}
