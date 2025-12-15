<script lang="ts">
	import type { Project, Generation } from '$lib/types';
	import GenerationCard from './GenerationCard.svelte';

	let {
		project,
		generations,
		selectedGenerationId
	}: {
		project: Project;
		generations: Generation[];
		selectedGenerationId: number | null;
	} = $props();
</script>

<div class="flex h-full flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
	<!-- Header -->
	<div class="border-b border-gray-200 p-4 dark:border-gray-700">
		<h3 class="font-semibold text-gray-900 dark:text-gray-100">{project.name}</h3>
		<p class="text-sm text-gray-500 dark:text-gray-400">
			{generations.length} generation{generations.length !== 1 ? 's' : ''}
		</p>
	</div>

	<!-- New generation button -->
	<div class="p-3">
		<a
			href="/projects/{project.id}"
			class="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-400"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			New Generation
		</a>
	</div>

	<!-- Generation list -->
	<div class="flex-1 space-y-2 overflow-y-auto p-3">
		{#each generations as generation (generation.id)}
			<a href="/projects/{project.id}/generations/{generation.id}">
				<GenerationCard
					{generation}
					selected={selectedGenerationId === generation.id}
				/>
			</a>
		{/each}

		{#if generations.length === 0}
			<div class="py-8 text-center text-gray-500 dark:text-gray-400">
				<svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
				</svg>
				<p class="mt-3 text-sm">No generations yet</p>
				<p class="mt-1 text-xs">Create your first song!</p>
			</div>
		{/if}
	</div>
</div>
