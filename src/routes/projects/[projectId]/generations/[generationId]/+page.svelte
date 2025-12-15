<script lang="ts">
	import type { PageData } from './$types';
	import GenerationForm from '$lib/components/GenerationForm.svelte';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	async function handleNewGeneration(title: string, style: string, lyrics: string) {
		const response = await fetch('/api/generations', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: data.activeProject.id,
				title,
				style,
				lyrics
			})
		});

		if (response.ok) {
			const newGeneration = await response.json();
			// Navigate to the new generation
			await goto(`/projects/${data.activeProject.id}/generations/${newGeneration.id}`);
		}
	}
</script>

<GenerationForm
	generation={data.generation}
	onNewGeneration={handleNewGeneration}
	isEditing={false}
/>
