<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Project, Generation, SSEMessage } from '$lib/types';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { onMount, onDestroy, setContext } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// State
	let projects = $state<(Project & { generations: Generation[] })[]>([]);
	let eventSource: EventSource | null = null;

	// Initialize projects from data
	$effect(() => {
		if (data.projects) {
			projects = data.projects;
		}
	});

	// Derived state
	let activeProjectId = $derived(data.activeProject.id);
	let activeProject = $derived(projects.find((p) => p.id === activeProjectId) || data.activeProject);
	let generations = $derived(activeProject?.generations || []);

	// Share live activeProject via context so child pages can access it
	setContext('activeProject', {
		get current() {
			return activeProject;
		}
	});
	
	// Determine selected generation from URL path
	let selectedGenerationId = $derived.by(() => {
		const match = $page.url.pathname.match(/\/projects\/\d+\/generations\/(\d+)/);
		return match ? parseInt(match[1]) : null;
	});

	// SSE connection for real-time updates
	onMount(() => {
		if (browser) {
			connectSSE();
		}
	});

	onDestroy(() => {
		if (eventSource) {
			eventSource.close();
		}
	});

	function connectSSE() {
		eventSource = new EventSource('/api/sse');

		eventSource.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data) as SSEMessage | { type: 'connected' };

				if (message.type === 'connected') {
					console.log('SSE connected');
					return;
				}

				// Update the generation in our local state
				if ('generationId' in message) {
					updateLocalGeneration(message.generationId, message.data);
				}
			} catch (e) {
				console.error('SSE parse error:', e);
			}
		};

		eventSource.onerror = () => {
			console.log('SSE error, reconnecting...');
			eventSource?.close();
			setTimeout(connectSSE, 3000);
		};
	}

	function updateLocalGeneration(generationId: number, data: Partial<Generation>) {
		console.log('SSE update for generation', generationId, data);
		
		// Check if generation exists in any project
		const generationExists = projects.some((project) =>
			project.generations.some((gen) => gen.id === generationId)
		);

		if (generationExists) {
			// Update existing generation
			projects = projects.map((project) => ({
				...project,
				generations: project.generations.map((gen) =>
					gen.id === generationId ? { ...gen, ...data } : gen
				)
			}));
			console.log('Updated generation in local state');
		} else {
			// New generation - refetch the active project's generations
			console.log('Generation not found, refetching project');
			refetchProjectGenerations(activeProjectId);
		}
	}

	async function refetchProjectGenerations(projectId: number) {
		try {
			const response = await fetch(`/api/projects/${projectId}`);
			if (response.ok) {
				const projectData = await response.json();
				projects = projects.map((p) =>
					p.id === projectId ? { ...p, generations: projectData.generations } : p
				);
			}
		} catch (e) {
			console.error('Failed to refetch generations:', e);
		}
	}

	async function createNewProject() {
		const response = await fetch('/api/projects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: `Project ${projects.length + 1}` })
		});

		if (response.ok) {
			const newProject = await response.json();
			projects = [...projects, { ...newProject, generations: [] }];
			// Navigate to new project
			await goto(`/projects/${newProject.id}`);
		}
	}

	async function closeTab(projectId: number, event: Event) {
		event.stopPropagation();

		if (projects.length <= 1) {
			// Don't allow closing the last tab
			return;
		}

		// Delete from server
		await fetch(`/api/projects/${projectId}`, {
			method: 'DELETE'
		});

		// Remove from local state
		const projectIndex = projects.findIndex((p) => p.id === projectId);
		projects = projects.filter((p) => p.id !== projectId);

		// Navigate to appropriate project
		let nextProject: Project | undefined;
		if (projectId === activeProjectId) {
			// If we're closing the active tab, navigate to another one
			nextProject = projects[projectIndex] || projects[projectIndex - 1] || projects[0];
			if (nextProject) {
				await goto(`/projects/${nextProject.id}`);
			}
		}
	}
</script>

<div class="flex h-screen flex-col bg-gray-100 dark:bg-gray-950">
	<!-- Tabs header -->
	<div class="flex items-center border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
		<div class="flex flex-1 items-center overflow-x-auto" role="tablist">
			{#each projects as project (project.id)}
				<a
					href="/projects/{project.id}"
					class="group relative flex min-w-0 max-w-[200px] shrink-0 items-center gap-2 border-r border-gray-200 px-4 py-3 text-sm font-medium transition-colors dark:border-gray-700 {project.id === activeProjectId
						? 'bg-gray-100 text-indigo-600 dark:bg-gray-800 dark:text-indigo-400'
						: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'}"
					role="tab"
					tabindex="0"
					aria-selected={project.id === activeProjectId}
				>
					<svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
						/>
					</svg>
					<span class="truncate">{project.name}</span>
					{#if project.generations.some((g) => ['pending', 'processing', 'text_success', 'first_success'].includes(g.status))}
						<span class="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500"></span>
					{/if}
					{#if projects.length > 1}
						<button
							onclick={(e) => closeTab(project.id, e)}
							aria-label="Close tab"
							class="ml-1 shrink-0 rounded-full p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-300"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					{/if}
					{#if project.id === activeProjectId}
						<div class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400"></div>
					{/if}
				</a>
			{/each}
		</div>

		<!-- New tab button -->
		<button
			onclick={createNewProject}
			class="flex h-full shrink-0 items-center gap-1.5 border-l border-gray-200 px-4 py-3 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			<span class="hidden sm:inline">New Project</span>
		</button>
	</div>

	<!-- Main content -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Sidebar with generations list -->
		<div class="w-80 shrink-0">
			<Sidebar
				project={activeProject}
				{generations}
				{selectedGenerationId}
			/>
		</div>

		<!-- Generation form / details -->
		<div class="flex-1 overflow-y-auto bg-white dark:bg-gray-800">
			{@render children()}
		</div>
	</div>
</div>
