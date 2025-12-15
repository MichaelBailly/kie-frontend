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

	function handleWaveformSeek(time: number) {
		if (audio) {
			audio.currentTime = time;
			currentTime = time;
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

	<!-- Song title and metadata -->
	<div class="mb-8">
		<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
			{song.title}
		</h1>
		<div class="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
			<span>Style: {generation.style}</span>
			{#if song.duration}
				<span>
					Duration: {Math.floor(song.duration / 60)}:{String(Math.floor(song.duration % 60)).padStart(2, '0')}
				</span>
			{/if}
		</div>
	</div>

	<!-- Cover art (if available) -->
	{#if song.imageUrl}
		<div class="mb-8">
			<img
				src={song.imageUrl}
				alt={song.title}
				class="h-96 w-full rounded-xl object-cover shadow-lg"
			/>
		</div>
	{/if}

	<!-- Audio player and Waveform -->
	<div class="mb-8">
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

			<!-- Custom player controls -->
			<div class="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div class="flex items-center gap-4">
					{#if song.imageUrl}
						<img src={song.imageUrl} alt={song.title} class="h-20 w-20 shrink-0 rounded-lg object-cover" />
					{:else}
						<div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
							<svg class="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
							</svg>
						</div>
					{/if}

					<div class="min-w-0 flex-1">
						<h3 class="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{song.title}</h3>
						<div class="mt-3 flex items-center gap-3">
							<button
								onclick={() => {
									if (audio) {
										if (audio.paused) audio.play();
										else audio.pause();
									}
								}}
								class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-700"
							>
								{#if !isPlaying}
									<svg class="h-6 w-6 pl-0.5" fill="currentColor" viewBox="0 0 24 24">
										<path d="M8 5v14l11-7z" />
									</svg>
								{:else}
									<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
										<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
									</svg>
								{/if}
							</button>

							<div class="flex flex-1 items-center gap-2">
								<span class="w-12 text-sm text-gray-500 dark:text-gray-400">
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
								<span class="w-12 text-sm text-gray-500 dark:text-gray-400">
									{Math.floor((audio?.duration || song.duration || 0) / 60)}:{String(Math.floor((audio?.duration || song.duration || 0) % 60)).padStart(2, '0')}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Waveform -->
			<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Waveform</h3>
				<Waveform
					audioUrl={song.audioUrl || song.streamUrl || ''}
					height={120}
					{currentTime}
					duration={audio?.duration || song.duration || 0}
					color="#6366f1"
					backgroundColor="#e5e7eb"
					onSeek={handleWaveformSeek}
				/>
			</div>
		{:else}
			<div class="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800">
				<p class="text-gray-600 dark:text-gray-400">Audio not yet available</p>
			</div>
		{/if}
	</div>

	<!-- Lyrics -->
	{#if generation.lyrics}
		<div class="mb-8">
			<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Lyrics</h2>
			<div
				class="whitespace-pre-wrap rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
			>
				<p class="text-gray-700 dark:text-gray-300">{generation.lyrics}</p>
			</div>
		</div>
	{/if}

	<!-- Download button -->
	{#if song.audioUrl}
		<div class="flex justify-center">
			<a
				href={song.audioUrl}
				download="{song.title}.mp3"
				class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-700"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
					/>
				</svg>
				Download Track
			</a>
		</div>
	{/if}
</div>
