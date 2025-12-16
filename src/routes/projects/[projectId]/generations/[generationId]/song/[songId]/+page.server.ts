import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	getExtendedGenerations,
	getGeneration as getGenerationById,
	getStemSeparationsForSong
} from '$lib/db.server';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { activeProject } = await parent();

	const generationId = parseInt(params.generationId);
	const songId = params.songId;

	const generation = activeProject.generations.find((g) => g.id === generationId);

	if (!generation) {
		throw error(404, 'Generation not found');
	}

	// Determine which track to show based on songId
	let songData: {
		id: string;
		streamUrl: string | null;
		audioUrl: string | null;
		imageUrl: string | null;
		duration: number | null;
		title: string;
	} | null = null;

	if (songId === generation.track1_audio_id) {
		songData = {
			id: generation.track1_audio_id || '',
			streamUrl: generation.track1_stream_url,
			audioUrl: generation.track1_audio_url,
			imageUrl: generation.track1_image_url,
			duration: generation.track1_duration,
			title: `${generation.title} - Track 1`
		};
	} else if (songId === generation.track2_audio_id) {
		songData = {
			id: generation.track2_audio_id || '',
			streamUrl: generation.track2_stream_url,
			audioUrl: generation.track2_audio_url,
			imageUrl: generation.track2_image_url,
			duration: generation.track2_duration,
			title: `${generation.title} - Track 2`
		};
	}

	if (!songData || !songData.id) {
		throw error(404, 'Song not found');
	}

	// Get extended generations for this song (songs that extend from this one)
	const extendedGenerations = getExtendedGenerations(generationId, songId);

	// Get stem separations for this song
	const stemSeparations = getStemSeparationsForSong(generationId, songId);

	// Get parent generation if this is an extended song
	let parentGeneration = null;
	let parentSong = null;
	if (generation.extends_generation_id && generation.extends_audio_id) {
		parentGeneration = getGenerationById(generation.extends_generation_id);
		if (parentGeneration) {
			// Determine which track in parent this extends from
			if (generation.extends_audio_id === parentGeneration.track1_audio_id) {
				parentSong = {
					id: parentGeneration.track1_audio_id,
					title: `${parentGeneration.title} - Track 1`
				};
			} else if (generation.extends_audio_id === parentGeneration.track2_audio_id) {
				parentSong = {
					id: parentGeneration.track2_audio_id,
					title: `${parentGeneration.title} - Track 2`
				};
			}
		}
	}

	return {
		generation,
		song: songData,
		activeProject,
		extendedGenerations,
		stemSeparations,
		parentGeneration,
		parentSong,
		continueAt: generation.continue_at
	};
};
