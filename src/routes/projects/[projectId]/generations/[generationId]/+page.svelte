<script lang="ts">
	import type { PageData } from './$types';
	import type { Generation } from '$lib/types';
	import GenerationView from '$lib/components/GenerationView.svelte';
	import { getContext } from 'svelte';

	let { data }: { data: PageData } = $props();

	// Get live activeProject from parent layout context (SSE-updated)
	const activeProjectContext = getContext<{ current: { id: number; generations: Generation[] } }>('activeProject');

	// Use live generation from context which receives SSE updates
	let generation = $derived.by(() => {
		const generationId = data.generation.id;
		const liveProject = activeProjectContext?.current;
		if (liveProject) {
			const liveGeneration = liveProject.generations.find((g) => g.id === generationId);
			if (liveGeneration) {
				return liveGeneration;
			}
		}
		// Fallback to server-loaded data
		return data.generation;
	});
</script>

<GenerationView {generation} />
