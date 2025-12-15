<script lang="ts">
	import type { PageData } from './$types';
	import Waveform from '$lib/components/Waveform.svelte';
	import { getContext } from 'svelte';
	import type { Generation } from '$lib/types';

	let { data }: { data: PageData } = $props();

	// Get live activeProject from parent layout context (SSE-updated)
	const activeProjectContext = getContext<{ current: { id: number; generations: Generation[] } }>(
		'activeProject'
	);

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

	// Update song data based on live generation
	let song = $derived.by(() => {
		const songId = data.song.id;
		if (songId === generation.track1_audio_id) {
			return {
				id: generation.track1_audio_id || '',
				streamUrl: generation.track1_stream_url,
				audioUrl: generation.track1_audio_url,
				imageUrl: generation.track1_image_url,
				duration: generation.track1_duration,
				title: `${generation.title} - Track 1`
			};
		} else if (songId === generation.track2_audio_id) {
			return {
				id: generation.track2_audio_id || '',
				streamUrl: generation.track2_stream_url,
				audioUrl: generation.track2_audio_url,
				imageUrl: generation.track2_image_url,
				duration: generation.track2_duration,
				title: `${generation.title} - Track 2`
			};
		}
		return data.song;
	});

	let audio: HTMLAudioElement | undefined = $state();
	let currentTime = $state(0);
	let isPlaying = $state(false);
	let lyricsExpanded = $state(false);
	let styleExpanded = $state(false);
	let lyricsCopied = $state(false);
	let styleCopied = $state(false);

	function handleWaveformSeek(time: number) {
		if (audio) {
			audio.currentTime = time;
			currentTime = time;
		}
	}

	async function copyToClipboard(text: string, type: 'lyrics' | 'style') {
		try {
			await navigator.clipboard.writeText(text);
			if (type === 'lyrics') {
				lyricsCopied = true;
				setTimeout(() => (lyricsCopied = false), 2000);
			} else {
				styleCopied = true;
				setTimeout(() => (styleCopied = false), 2000);
			}
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}
</script>

<div class="mx-auto max-w-5xl p-6">
	<!-- Header with back navigation -->
	<div class="mb-6">
		<a
			href="/projects/{data.generation.project_id}/generations/{data.generation.id}"
			class="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 19l-7-7 7-7"
				/>
			</svg>
			Back to generation
		</a>
	</div>

	<!-- Song title -->
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
			{song.title}
		</h1>
	</div>

	<!-- Audio player and Waveform - PRIMARY FOCUS -->
	<div class="mb-10">
		{#if song.streamUrl || song.audioUrl}
			<audio
				bind:this={audio}
				src={song.audioUrl || song.streamUrl || ''}
				ontimeupdate={() => {
					if (audio) currentTime = audio.currentTime;
				}}
				onloadedmetadata={() => {
					if (audio && audio.duration) {
						song = { ...song, duration: audio.duration };
					}
				}}
				onplay={() => {
					isPlaying = true;
				}}
				onpause={() => {
					isPlaying = false;
				}}
				onended={() => {
					isPlaying = false;
				}}
				preload="metadata"
				class="hidden"
			></audio>

			<!-- Waveform - MAIN FOCUS -->
			<div class="mb-6 rounded-xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-700 dark:bg-gray-800">
				<Waveform
					audioUrl={song.audioUrl || song.streamUrl || ''}
					height={160}
					{currentTime}
					duration={audio?.duration || song.duration || 0}
					color="#6366f1"
					backgroundColor="#e5e7eb"
					onSeek={handleWaveformSeek}
				/>
			</div>

			<!-- Playback Controls -->
			<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div class="flex items-center justify-center gap-6">
					<button
						onclick={() => {
							if (audio) {
								if (audio.paused) audio.play();
								else audio.pause();
							}
						}}
						class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-all hover:scale-105 hover:bg-indigo-700"
					>
						{#if !isPlaying}
							<svg class="h-8 w-8 pl-1" fill="currentColor" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
						{:else}
							<svg class="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
								<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
							</svg>
						{/if}
					</button>

					<div class="flex flex-1 items-center gap-3">
						<span class="w-14 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
							{Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
						</span>
						<input
							type="range"
							min="0"
							max={audio?.duration || song.duration || 100}
							value={currentTime}
							oninput={(e) => {
								if (audio) audio.currentTime = parseFloat(e.currentTarget.value);
							}}
							class="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600 dark:bg-gray-700"
						/>
						<span class="w-14 text-sm font-medium text-gray-600 dark:text-gray-300">
							{Math.floor((audio?.duration || song.duration || 0) / 60)}:{String(Math.floor((audio?.duration || song.duration || 0) % 60)).padStart(2, '0')}
						</span>
					</div>

					{#if song.audioUrl}
						<a
							href={song.audioUrl}
							download="{song.title}.mp3"
							class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
							title="Download track"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
								/>
							</svg>
						</a>
					{/if}
				</div>
			</div>
		{:else}
			<div class="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800">
				<p class="text-gray-600 dark:text-gray-400">Audio not yet available</p>
			</div>
		{/if}
	</div>

	<!-- Secondary Details - Collapsible -->
	<div class="space-y-3">
		<!-- Style Section -->
		<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<button
				onclick={() => (styleExpanded = !styleExpanded)}
				class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
			>
				<div class="flex items-center gap-3">
					<svg class="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
					</svg>
					<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Style</h2>
				</div>
				<svg
					class="h-5 w-5 text-gray-400 transition-transform {styleExpanded ? 'rotate-180' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>
			{#if styleExpanded}
				<div class="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
					<div class="p-4">
						<div class="mb-3 flex justify-end">
							<button
								onclick={() => copyToClipboard(generation.style, 'style')}
								class="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700"
							>
								{#if styleCopied}
									<svg class="h-4 w-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
									Copied!
								{:else}
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
									</svg>
									Copy
								{/if}
							</button>
						</div>
						<p class="text-gray-700 dark:text-gray-300">{generation.style}</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Lyrics Section -->
		{#if generation.lyrics}
			<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<button
					onclick={() => (lyricsExpanded = !lyricsExpanded)}
					class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
				>
					<div class="flex items-center gap-3">
						<svg class="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Lyrics</h2>
					</div>
					<svg
						class="h-5 w-5 text-gray-400 transition-transform {lyricsExpanded ? 'rotate-180' : ''}"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
				{#if lyricsExpanded}
					<div class="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
						<div class="p-4">
							<div class="mb-3 flex justify-end">
								<button
									onclick={() => copyToClipboard(generation.lyrics || '', 'lyrics')}
									class="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700"
								>
									{#if lyricsCopied}
										<svg class="h-4 w-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
										</svg>
										Copied!
									{:else}
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
										</svg>
										Copy
									{/if}
								</button>
							</div>
							<p class="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{generation.lyrics}</p>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Cover Image Section -->
		{#if song.imageUrl}
			<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div class="p-4">
					<div class="flex items-center gap-3 mb-3">
						<svg class="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Cover Art</h2>
					</div>
					<img
						src={song.imageUrl}
						alt={song.title}
						class="w-full rounded-lg object-cover"
					/>
				</div>
			</div>
		{/if}
	</div>
</div>
