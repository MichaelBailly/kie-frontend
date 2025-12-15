import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createProject, getAllProjects } from '$lib/db.server';

export const GET: RequestHandler = async () => {
	const projects = getAllProjects();
	return json(projects);
};

export const POST: RequestHandler = async ({ request }) => {
	const { name } = await request.json();
	const project = createProject(name || 'New Project');
	return json(project);
};
