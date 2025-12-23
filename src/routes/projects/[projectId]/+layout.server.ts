import type { LayoutServerLoad } from './$types';
import { getOpenProjects, getGenerationsByProject, createProject, getProject, setProjectOpen } from '$lib/db.server';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ params }) => {
	const projectId = parseInt(params.projectId);
	
	// Check if the requested project exists
	const requestedProject = getProject(projectId);
	if (!requestedProject) {
		throw error(404, 'Project not found');
	}
	
	// If project exists but is not open, open it (user navigated directly or from project management)
	if (!requestedProject.is_open) {
		setProjectOpen(projectId, true);
	}

	// Get all open projects for the tabs
	let openProjects = getOpenProjects();

	// Create a default project if none are open
	if (openProjects.length === 0) {
		createProject('My First Project', true);
		openProjects = getOpenProjects();
	}

	// Load generations for each open project
	const projectsWithGenerations = openProjects.map((project) => ({
		...project,
		generations: getGenerationsByProject(project.id)
	}));

	const activeProject = projectsWithGenerations.find((p) => p.id === projectId);

	if (!activeProject) {
		// This shouldn't happen since we just opened the project, but handle it
		throw error(404, 'Project not found');
	}

	return {
		projects: projectsWithGenerations,
		activeProject
	};
};
