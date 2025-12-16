import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getProject,
	updateProjectName,
	deleteProject,
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
	const { name } = await request.json();

	const project = getProject(id);
	if (!project) {
		throw error(404, 'Project not found');
	}

	updateProjectName(id, name);
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);

	const project = getProject(id);
	if (!project) {
		throw error(404, 'Project not found');
	}

	deleteProject(id);
	return json({ success: true });
};
