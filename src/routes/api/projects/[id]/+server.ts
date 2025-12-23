import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getProject,
	updateProjectName,
	setProjectOpen,
	getGenerationsByProject
} from '$lib/db.server';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	const project = getProject(id);

	if (!project) {
		throw error(404, 'Project not found');
	}

	const generations = getGenerationsByProject(id);

	return json({ project, generations });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = parseInt(params.id);
	const body = await request.json();

	const project = getProject(id);
	if (!project) {
		throw error(404, 'Project not found');
	}

	// Update name if provided
	if (body.name !== undefined) {
		updateProjectName(id, body.name);
	}

	// Update is_open if provided
	if (body.is_open !== undefined) {
		setProjectOpen(id, body.is_open);
	}

	return json({ success: true });
};
