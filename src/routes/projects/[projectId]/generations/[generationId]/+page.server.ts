import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { activeProject } = await parent();
	
	const generationId = parseInt(params.generationId);
	const generation = activeProject.generations.find((g) => g.id === generationId);

	if (!generation) {
		throw error(404, 'Generation not found');
	}

	return {
		generation,
		activeProject // Pass through so page can access live data
	};
};
