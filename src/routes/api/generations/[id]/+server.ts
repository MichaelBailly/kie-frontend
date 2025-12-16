import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGeneration, deleteGeneration } from '$lib/db.server';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	const generation = getGeneration(id);

	if (!generation) {
		throw error(404, 'Generation not found');
	}

	return json(generation);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);

	const generation = getGeneration(id);
	if (!generation) {
		throw error(404, 'Generation not found');
	}

	deleteGeneration(id);
	return json({ success: true });
};
