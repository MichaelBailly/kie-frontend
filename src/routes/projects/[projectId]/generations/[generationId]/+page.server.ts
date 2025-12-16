import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getGeneration as getGenerationById } from '$lib/db.server';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { activeProject } = await parent();

	const generationId = parseInt(params.generationId);
	const generation = activeProject.generations.find((g) => g.id === generationId);

	if (!generation) {
		throw error(404, 'Generation not found');
	}

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
					title: `${parentGeneration.title} - Track 1`,
					generationId: parentGeneration.id
				};
			} else if (generation.extends_audio_id === parentGeneration.track2_audio_id) {
				parentSong = {
					id: parentGeneration.track2_audio_id,
					title: `${parentGeneration.title} - Track 2`,
					generationId: parentGeneration.id
				};
			}
		}
	}

	return {
		generation,
		activeProject, // Pass through so page can access live data
		parentGeneration,
		parentSong
	};
};
