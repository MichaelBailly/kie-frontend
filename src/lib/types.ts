// Shared types between server and client

export interface Project {
	id: number;
	name: string;
	is_open: boolean;
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

export type StemSeparationType = 'separate_vocal' | 'split_stem';

export interface StemSeparation {
	id: number;
	generation_id: number;
	audio_id: string;
	task_id: string | null;
	type: StemSeparationType;
	status: string;
	error_message: string | null;
	vocal_url: string | null;
	instrumental_url: string | null;
	backing_vocals_url: string | null;
	drums_url: string | null;
	bass_url: string | null;
	guitar_url: string | null;
	keyboard_url: string | null;
	piano_url: string | null;
	percussion_url: string | null;
	strings_url: string | null;
	synth_url: string | null;
	fx_url: string | null;
	brass_url: string | null;
	woodwinds_url: string | null;
	response_data: string | null;
	created_at: string;
	updated_at: string;
}

export interface SSEMessage {
	type:
		| 'generation_update'
		| 'generation_complete'
		| 'generation_error'
		| 'stem_separation_update'
		| 'stem_separation_complete'
		| 'stem_separation_error';
	generationId: number;
	data: Partial<Generation> | Partial<StemSeparation>;
	stemSeparationId?: number;
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
