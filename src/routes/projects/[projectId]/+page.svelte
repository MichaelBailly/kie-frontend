<script lang="ts">
	import type { LayoutData } from './$types';
	import GenerationForm from '$lib/components/GenerationForm.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';

	let { data }: { data: LayoutData } = $props();

	// Storage key unique to this project
	let storageKey = $derived(`generation-form-${data.activeProject.id}`);

	// Form state managed here to enable persistence
	let title = $state('');
	let style = $state('');
	let lyrics = $state('');

	// Track initialization to prevent saving during initial load
	let isInitializing = $state(true);

	// Get latest generation for initial pre-fill
	let latestGeneration = $derived(
		data.activeProject.generations.length > 0 ? data.activeProject.generations[0] : null
	);

	// On mount or project change: restore from sessionStorage or pre-fill from latest generation
	$effect(() => {
		if (!browser) return;

		isInitializing = true;

		// Check for saved form state specific to this project
		const saved = sessionStorage.getItem(storageKey);
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				// Only use saved state if it has actual content
				if (parsed.title || parsed.style || parsed.lyrics) {
					title = parsed.title ?? '';
					style = parsed.style ?? '';
					lyrics = parsed.lyrics ?? '';
					isInitializing = false;
					return;
				}
			} catch {
				// Invalid JSON, fall through to pre-fill from latest generation
			}
		}

		// No saved state (or empty saved state), pre-fill from latest generation
		title = latestGeneration?.title || '';
		style = latestGeneration?.style || '';
		lyrics = latestGeneration?.lyrics || '';
		
		isInitializing = false;
	});

	// Save form state to sessionStorage on every change (but not during initialization)
	$effect(() => {
		if (!browser || isInitializing) return;
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
			// Refresh data to get the latest generation
			await invalidateAll();
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
