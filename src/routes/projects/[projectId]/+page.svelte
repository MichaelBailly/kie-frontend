<script lang="ts">
	import type { LayoutData } from './$types';
	import GenerationForm from '$lib/components/GenerationForm.svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	let { data }: { data: LayoutData } = $props();

	// Storage key unique to this project
	let storageKey = $derived(`generation-form-${data.activeProject.id}`);

	// Form state managed here to enable persistence
	let title = $state('');
	let style = $state('');
	let lyrics = $state('');

	// Get latest generation for initial pre-fill
	let latestGeneration = $derived(
		data.activeProject.generations.length > 0 ? data.activeProject.generations[0] : null
	);

	// On mount: restore from sessionStorage or pre-fill from latest generation
	$effect(() => {
		if (!browser) return;

		const saved = sessionStorage.getItem(storageKey);
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				title = parsed.title ?? '';
				style = parsed.style ?? '';
				lyrics = parsed.lyrics ?? '';
			} catch {
				// Invalid JSON, fall back to latest generation
				title = latestGeneration?.title || '';
				style = latestGeneration?.style || '';
				lyrics = latestGeneration?.lyrics || '';
			}
		} else {
			// No saved state, pre-fill from latest generation
			title = latestGeneration?.title || '';
			style = latestGeneration?.style || '';
			lyrics = latestGeneration?.lyrics || '';
		}
	});

	// Save form state to sessionStorage on every change
	$effect(() => {
		if (!browser) return;
		sessionStorage.setItem(storageKey, JSON.stringify({ title, style, lyrics }));
	});

	async function handleNewGeneration(formTitle: string, formStyle: string, formLyrics: string) {
		const response = await fetch('/api/generations', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: data.activeProject.id,
				title: formTitle,
				style: formStyle,
				lyrics: formLyrics
			})
		});

		if (response.ok) {
			const newGeneration = await response.json();
			// Clear saved form state after successful generation
			sessionStorage.removeItem(storageKey);
			// Navigate to the new generation
			await goto(`/projects/${data.activeProject.id}/generations/${newGeneration.id}`);
		}
	}
</script>

<GenerationForm
	bind:title
	bind:style
	bind:lyrics
	onNewGeneration={handleNewGeneration}
/>
