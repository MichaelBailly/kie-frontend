import type { LayoutServerLoad } from './$types';
import { getAllProjects, getGenerationsByProject, createProject } from '$lib/db.server';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ params }) => {
	let projects = getAllProjects();

	// Create a default project if none exist
	if (projects.length === 0) {
		createProject('My First Project');
		projects = getAllProjects();
	}

	// Load generations for each project
	const projectsWithGenerations = projects.map((project) => ({
		...project,
		generations: getGenerationsByProject(project.id)
	}));

	const projectId = parseInt(params.projectId);
	const activeProject = projectsWithGenerations.find((p) => p.id === projectId);

	if (!activeProject) {
		throw error(404, 'Project not found');
	}

	return {
		projects: projectsWithGenerations,
		activeProject
	};
};
