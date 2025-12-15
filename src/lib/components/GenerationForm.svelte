<script lang="ts">
	import type { Generation } from '$lib/types';
	import { getStatusLabel, isGenerating } from '$lib/types';
	import AudioPlayer from './AudioPlayer.svelte';

	let {
		generation,
		onNewGeneration,
		isEditing = false
	}: {
		generation: Generation | null;
		onNewGeneration: (title: string, style: string, lyrics: string) => void;
		isEditing?: boolean;
	} = $props();

	let title = $state('');
	let style = $state('');
	let lyrics = $state('');
	let isSubmitting = $state(false);
	let prevGenerationId: number | null = null;

	// Read-only when viewing a completed/failed generation (not editing)
	let isReadOnly = $derived(!isEditing && generation?.status === 'success');

	// Update form when generation changes
	$effect(() => {
		const currentId = generation?.id ?? null;
		if (currentId !== prevGenerationId) {
			title = generation?.title || '';
			style = generation?.style || '';
			lyrics = generation?.lyrics || '';
			prevGenerationId = currentId;
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!title.trim() || !style.trim() || !lyrics.trim()) return;

		isSubmitting = true;
		try {
			onNewGeneration(title, style, lyrics);
		} finally {
			isSubmitting = false;
		}
	}

	function formatDuration(seconds: number | null): string {
		if (!seconds) return '';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
		<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
			{generation ? 'Song Generation' : 'Create New Song'}
		</h2>
		{#if generation && isGenerating(generation.status)}
			<div class="mt-2 flex items-center gap-2">
				<div class="h-2 w-2 animate-pulse rounded-full bg-amber-500"></div>
				<span class="text-sm text-amber-600 dark:text-amber-400">
					{getStatusLabel(generation.status)}
				</span>
			</div>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		<!-- Status indicator for completed or error -->
		{#if generation?.status === 'success'}
			<div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
				<div class="flex items-center gap-2">
					<svg class="h-5 w-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clip-rule="evenodd"
						/>
					</svg>
					<span class="font-medium text-green-800 dark:text-green-200">Generation complete!</span>
				</div>
			</div>
		{:else if generation?.status === 'error'}
			<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
				<div class="flex items-center gap-2">
					<svg class="h-5 w-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/>
					</svg>
					<span class="font-medium text-red-800 dark:text-red-200">Generation failed</span>
				</div>
				{#if generation.error_message}
					<p class="mt-2 text-sm text-red-700 dark:text-red-300">{generation.error_message}</p>
				{/if}
			</div>
		{/if}

		<!-- Audio players if tracks are available -->
		{#if generation?.track1_stream_url || generation?.track1_audio_url}
			<div class="mb-6 space-y-4">
				<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Generated Tracks</h3>
				<div class="space-y-3">
					<div>
						<p class="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">Variation 1</p>
						<AudioPlayer
							src={generation.track1_audio_url || generation.track1_stream_url || ''}
							title="{generation.title} (V1)"
							imageUrl={generation.track1_image_url || ''}
							duration={generation.track1_duration || 0}
						/>
					</div>
					{#if generation.track2_stream_url || generation.track2_audio_url}
						<div>
							<p class="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">Variation 2</p>
							<AudioPlayer
								src={generation.track2_audio_url || generation.track2_stream_url || ''}
								title="{generation.title} (V2)"
								imageUrl={generation.track2_image_url || ''}
								duration={generation.track2_duration || 0}
							/>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Generation form -->
		<form onsubmit={handleSubmit} class="space-y-5">
			<div>
				<label for="title" class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
					Title
				</label>
				<input
					type="text"
					id="title"
					bind:value={title}
					placeholder="Enter song title..."
					maxlength="80"
					readonly={isReadOnly}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-500 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 {isReadOnly ? 'cursor-default bg-gray-50 dark:bg-gray-900' : ''}"
				/>
				{#if !isReadOnly}
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{title.length}/80 characters</p>
				{/if}
			</div>

			<div>
				<label for="style" class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
					Style Prompt
				</label>
				<textarea
					id="style"
					bind:value={style}
					placeholder="Describe the musical style (e.g., 'Upbeat pop, catchy melody, female vocals, 120 bpm')..."
					rows="3"
					maxlength="1000"
					readonly={isReadOnly}
					class="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-500 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 {isReadOnly ? 'cursor-default bg-gray-50 dark:bg-gray-900' : ''}"
				></textarea>
				{#if !isReadOnly}
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{style.length}/1000 characters</p>
				{/if}
			</div>

			<div>
				<label for="lyrics" class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
					Lyrics
				</label>
				<textarea
					id="lyrics"
					bind:value={lyrics}
					placeholder="Write your song lyrics here...

[Verse 1]
Your lyrics go here...

[Chorus]
The catchy part..."
					rows="10"
					maxlength="5000"
					readonly={isReadOnly}
					class="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-mono text-sm text-gray-900 placeholder-gray-500 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 {isReadOnly ? 'cursor-default bg-gray-50 dark:bg-gray-900' : ''}"
				></textarea>
				{#if !isReadOnly}
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{lyrics.length}/5000 characters</p>
				{/if}
			</div>

			{#if !isReadOnly}
				<div class="pt-2">
					<button
						type="submit"
						disabled={isSubmitting || !title.trim() || !style.trim() || !lyrics.trim()}
						class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
					>
						{#if isSubmitting}
							<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Generating...
						{:else}
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
							</svg>
							Generate Song
						{/if}
					</button>
				</div>
			{/if}
		</form>
	</div>
</div>
