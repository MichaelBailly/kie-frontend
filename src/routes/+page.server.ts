import type { PageServerLoad } from './$types';
import { getAllProjects, createProject } from '$lib/db.server';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	let projects = getAllProjects();

	// Create a default project if none exist
	if (projects.length === 0) {
		createProject('My First Project');
		projects = getAllProjects();
	}

	// Redirect to the first project
	throw redirect(302, `/projects/${projects[0].id}`);
};
