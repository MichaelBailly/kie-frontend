<script lang="ts">
	import type { PageData } from './$types';
	import type { Project } from '$lib/types';
	import { goto } from '$app/navigation';
	import ImportSongModal from '$lib/components/ImportSongModal.svelte';

	type ProjectWithStats = Project & {
		generationCount: number;
		lastGenerationId: number | null;
		lastGenerationTitle: string | null;
		lastGenerationStatus: string | null;
		lastGenerationImageUrl: string | null;
	};

	let { data }: { data: PageData } = $props();

	// Local state - use $effect to sync with data changes
	let projects = $state<ProjectWithStats[]>([]);
	let filterText = $state('');
	let sortField = $state<'name' | 'updated_at'>('updated_at');
	let sortOrder = $state<'asc' | 'desc'>('desc');
	let showImportModal = $state(false);
	let isCreating = $state(false);

	// Sync projects when data changes
	$effect(() => {
		projects = data.projects;
	});

	// Filtered and sorted projects
	let filteredProjects = $derived.by(() => {
		let result = projects.filter((p) =>
			p.name.toLowerCase().includes(filterText.toLowerCase())
		);

		result.sort((a, b) => {
			let comparison: number;
			if (sortField === 'name') {
				comparison = a.name.localeCompare(b.name);
			} else {
				comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
			}
			return sortOrder === 'asc' ? comparison : -comparison;
		});

		return result;
	});

	async function createNewProject() {
		isCreating = true;
		try {
			const response = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: `Project ${projects.length + 1}` })
			});

			if (response.ok) {
				const newProject = await response.json();
				// Navigate to the new project (this will open it in tabs)
				await goto(`/projects/${newProject.id}`);
			}
		} finally {
			isCreating = false;
		}
	}

	async function openProject(project: ProjectWithStats) {
		// Mark as open and navigate to last generation if exists
		await fetch(`/api/projects/${project.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ is_open: true })
		});

		if (project.lastGenerationId) {
			await goto(`/projects/${project.id}/generations/${project.lastGenerationId}`);
		} else {
			await goto(`/projects/${project.id}`);
		}
	}

	function toggleSortOrder() {
		sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
	}

	function setSortField(field: 'name' | 'updated_at') {
		if (sortField === field) {
			toggleSortOrder();
		} else {
			sortField = field;
			// Default order: name ascending, date descending
			sortOrder = field === 'name' ? 'asc' : 'desc';
		}
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;

		return date.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
		});
	}

	function getStatusColor(status: string | null): string {
		if (!status) return 'bg-gray-400';
		if (status === 'success') return 'bg-emerald-500';
		if (status === 'error') return 'bg-red-500';
		return 'bg-amber-500 animate-pulse';
	}
</script>

<svelte:head>
	<title>Projects - KIE Music</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950">
	<!-- Header -->
	<header class="border-b border-white/10 bg-black/20 backdrop-blur-sm">
		<div class="mx-auto max-w-6xl px-6 py-8">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold text-white">Your Projects</h1>
					<p class="mt-2 text-gray-400">
						{projects.length} project{projects.length !== 1 ? 's' : ''} • Create and manage your AI music generations
					</p>
				</div>
				<div class="flex gap-3">
					<button
						onclick={() => (showImportModal = true)}
						class="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/30"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
							/>
						</svg>
						Import
					</button>
					<button
						onclick={createNewProject}
						disabled={isCreating}
						class="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						{isCreating ? 'Creating...' : 'New Project'}
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="mx-auto max-w-6xl px-6 py-8">
		<!-- Filters -->
		<div class="mb-8 flex flex-wrap items-center gap-4">
			<div class="relative flex-1 min-w-[200px]">
				<svg
					class="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
				<input
					type="text"
					bind:value={filterText}
					placeholder="Search projects..."
					class="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder-gray-500 backdrop-blur-sm transition-colors focus:border-indigo-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
				/>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-sm text-gray-500">Sort by</span>
				<button
					onclick={() => setSortField('name')}
					class="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all {sortField === 'name'
						? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
						: 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}"
				>
					{#if sortField === 'name'}
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							{#if sortOrder === 'asc'}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
							{:else}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							{/if}
						</svg>
					{/if}
					Name
				</button>
				<button
					onclick={() => setSortField('updated_at')}
					class="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all {sortField === 'updated_at'
						? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
						: 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}"
				>
					{#if sortField === 'updated_at'}
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							{#if sortOrder === 'asc'}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
							{:else}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							{/if}
						</svg>
					{/if}
					Recent
				</button>
			</div>
		</div>

		<!-- Projects grid -->
		{#if filteredProjects.length === 0}
			<div class="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-8 py-16 text-center backdrop-blur-sm">
				{#if projects.length === 0}
					<div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
						<svg class="h-10 w-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
							/>
						</svg>
					</div>
					<h3 class="text-xl font-semibold text-white">No projects yet</h3>
					<p class="mt-2 max-w-sm text-gray-400">
						Create your first project to start generating AI-powered music.
					</p>
					<button
						onclick={createNewProject}
						disabled={isCreating}
						class="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.02] disabled:opacity-50"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Create Your First Project
					</button>
				{:else}
					<div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
						<svg class="h-10 w-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</div>
					<h3 class="text-xl font-semibold text-white">No matching projects</h3>
					<p class="mt-2 text-gray-400">
						Try a different search term.
					</p>
				{/if}
			</div>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each filteredProjects as project (project.id)}
					<button
						onclick={() => openProject(project)}
						class="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:border-indigo-500/50 hover:bg-white/10 hover:shadow-xl hover:shadow-indigo-500/10 hover:scale-[1.02]"
					>
						<!-- Cover image or gradient -->
						<div class="relative h-32 overflow-hidden">
							{#if project.lastGenerationImageUrl}
								<img
									src={project.lastGenerationImageUrl}
									alt=""
									class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
								/>
								<div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent"></div>
							{:else}
								<div class="h-full w-full bg-gradient-to-br from-indigo-600/30 via-purple-600/20 to-pink-600/30"></div>
								<div class="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
							{/if}

							<!-- Status indicator -->
							{#if project.lastGenerationStatus && project.lastGenerationStatus !== 'success'}
								<div class="absolute right-3 top-3">
									<span class="flex h-3 w-3">
										<span class="{getStatusColor(project.lastGenerationStatus)} absolute inline-flex h-full w-full rounded-full opacity-75 {project.lastGenerationStatus !== 'error' ? 'animate-ping' : ''}"></span>
										<span class="{getStatusColor(project.lastGenerationStatus)} relative inline-flex h-3 w-3 rounded-full"></span>
									</span>
								</div>
							{/if}

							<!-- Open badge -->
							{#if project.is_open}
								<div class="absolute left-3 top-3">
									<span class="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400 backdrop-blur-sm">
										Open
									</span>
								</div>
							{/if}
						</div>

						<!-- Content -->
						<div class="flex flex-1 flex-col p-4">
							<h3 class="font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
								{project.name}
							</h3>

							{#if project.lastGenerationTitle}
								<p class="mt-1 text-sm text-gray-500 truncate">
									♪ {project.lastGenerationTitle}
								</p>
							{/if}

							<div class="mt-auto pt-4 flex items-center justify-between text-xs text-gray-500">
								<span class="flex items-center gap-1.5">
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
									</svg>
									{project.generationCount} generation{project.generationCount !== 1 ? 's' : ''}
								</span>
								<span>{formatDate(project.updated_at)}</span>
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- Import Song Modal -->
<ImportSongModal bind:isOpen={showImportModal} onClose={() => (showImportModal = false)} />
