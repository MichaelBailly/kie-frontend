<script lang="ts">
	import type { PageData } from './$types';
	import Waveform from '$lib/components/Waveform.svelte';
	import ExtendSongForm from '$lib/components/ExtendSongForm.svelte';
	import StemPlayer from '$lib/components/StemPlayer.svelte';
	import { getContext } from 'svelte';
	import type { Generation, StemSeparation, StemSeparationType } from '$lib/types';
	import { audioStore, type AudioTrack } from '$lib/stores/audio.svelte';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	// Stem separation state
	let newStemSeparations = $state<StemSeparation[]>([]);
	let separatingType = $state<StemSeparationType | null>(null);
	let showStemOptions = $state(false);

	// Get stem separation updates from parent layout context (SSE-updated)
	const stemSeparationsContext = getContext<{
		updates: Map<number, Partial<StemSeparation>>;
		set: (id: number, data: Partial<StemSeparation>) => void;
	}>('stemSeparations');

	// Merge server data with updates from SSE
	let stemSeparations = $derived.by(() => {
		// Start with server-loaded data, apply updates from SSE
		const serverData = (data.stemSeparations || []).map((sep) => {
			const updates = stemSeparationsContext?.updates.get(sep.id);
			return updates ? { ...sep, ...updates } : sep;
		});
		// Add any new separations created during this session
		return [
			...serverData,
			...newStemSeparations.filter((ns) => !serverData.find((s) => s.id === ns.id))
		];
	});

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

	// Use global audio store for playback state
	let isCurrentTrack = $derived(audioStore.isCurrentTrack(song.id));
	let isPlaying = $derived(audioStore.isTrackPlaying(song.id));
	let currentTime = $derived(isCurrentTrack ? audioStore.currentTime : 0);
	let duration = $derived(isCurrentTrack ? audioStore.duration : song.duration || 0);

	let lyricsExpanded = $state(false);
	let styleExpanded = $state(false);
	let lyricsCopied = $state(false);
	let styleCopied = $state(false);
	let showExtendForm = $state(false);

	function handleWaveformSeek(time: number) {
		if (isCurrentTrack) {
			audioStore.seek(time);
		} else {
			// Start playing from this position
			const track: AudioTrack = {
				id: song.id,
				generationId: generation.id,
				projectId: generation.project_id,
				title: song.title,
				imageUrl: song.imageUrl,
				streamUrl: song.streamUrl,
				audioUrl: song.audioUrl,
				duration: song.duration
			};
			audioStore.play(track);
			// Small delay to ensure audio is loaded, then seek
			setTimeout(() => audioStore.seek(time), 100);
		}
	}

	function handlePlayPause() {
		if (isCurrentTrack) {
			audioStore.toggle();
		} else {
			const track: AudioTrack = {
				id: song.id,
				generationId: generation.id,
				projectId: generation.project_id,
				title: song.title,
				imageUrl: song.imageUrl,
				streamUrl: song.streamUrl,
				audioUrl: song.audioUrl,
				duration: song.duration
			};
			audioStore.play(track);
		}
	}

	function handleSeek(e: Event) {
		const target = e.target as HTMLInputElement;
		const time = parseFloat(target.value);
		if (isCurrentTrack) {
			audioStore.seek(time);
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

	async function handleExtend(extendData: {
		title: string;
		style: string;
		lyrics: string;
		continueAt: number;
	}) {
		const response = await fetch('/api/generations/extend', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: generation.project_id,
				title: extendData.title,
				style: extendData.style,
				lyrics: extendData.lyrics,
				extendsGenerationId: generation.id,
				extendsAudioId: song.id,
				continueAt: extendData.continueAt
			})
		});

		if (response.ok) {
			const newGeneration = await response.json();
			showExtendForm = false;
			// Navigate to the new generation page
			goto(`/projects/${generation.project_id}/generations/${newGeneration.id}`);
		} else {
			console.error('Failed to create extend generation');
		}
	}

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Stem separation helpers
	let vocalSeparation = $derived(
		stemSeparations.find((s) => s.type === 'separate_vocal' && s.status === 'success')
	);
	let stemSeparation = $derived(
		stemSeparations.find((s) => s.type === 'split_stem' && s.status === 'success')
	);
	let pendingVocalSeparation = $derived(
		stemSeparations.find(
			(s) => s.type === 'separate_vocal' && (s.status === 'pending' || s.status === 'processing')
		)
	);
	let pendingStemSeparation = $derived(
		stemSeparations.find(
			(s) => s.type === 'split_stem' && (s.status === 'pending' || s.status === 'processing')
		)
	);

	async function requestStemSeparation(type: StemSeparationType) {
		separatingType = type;
		showStemOptions = false;

		try {
			const response = await fetch('/api/stem-separation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					generationId: generation.id,
					audioId: song.id,
					type
				})
			});

			if (response.ok) {
				const newSeparation = (await response.json()) as StemSeparation;
				// Add to newStemSeparations if not already present
				if (!newStemSeparations.find((s) => s.id === newSeparation.id)) {
					newStemSeparations = [...newStemSeparations, newSeparation];
				}
			} else {
				const error = await response.json();
				console.error('Failed to start stem separation:', error);
				separatingType = null;
			}
		} catch (err) {
			console.error('Failed to start stem separation:', err);
			separatingType = null;
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
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Back to generation
		</a>
	</div>

	<!-- Parent song link (if this is an extended song) -->
	{#if data.parentGeneration && data.parentSong}
		<div
			class="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/30"
		>
			<div class="flex items-center gap-2">
				<svg
					class="h-5 w-5 text-purple-600 dark:text-purple-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
					/>
				</svg>
				<span class="text-sm text-purple-700 dark:text-purple-300">
					Extended from
					<a
						href="/projects/{data.parentGeneration.project_id}/generations/{data.parentGeneration
							.id}/song/{data.parentSong.id}"
						class="font-medium underline hover:text-purple-900 dark:hover:text-purple-100"
					>
						{data.parentSong.title}
					</a>
					{#if data.continueAt}
						<span class="text-purple-600 dark:text-purple-400">
							at {formatTime(data.continueAt)}
						</span>
					{/if}
				</span>
			</div>
		</div>
	{/if}

	<!-- Song title -->
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
			{song.title}
		</h1>
	</div>

	<!-- Audio player and Waveform - PRIMARY FOCUS -->
	<div class="mb-10">
		{#if song.streamUrl || song.audioUrl}
			<!-- Waveform - MAIN FOCUS -->
			<div
				class="mb-6 rounded-xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-700 dark:bg-gray-800"
			>
				<Waveform
					audioUrl={song.audioUrl || song.streamUrl || ''}
					height={160}
					{currentTime}
					{duration}
					color="#6366f1"
					backgroundColor="#e5e7eb"
					onSeek={handleWaveformSeek}
				/>
			</div>

			<!-- Playback Controls -->
			<div
				class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="flex items-center justify-center gap-6">
					<button
						onclick={handlePlayPause}
						class="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-all hover:scale-105 hover:bg-indigo-700"
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
							max={duration || 100}
							value={currentTime}
							oninput={handleSeek}
							class="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600 dark:bg-gray-700"
						/>
						<span class="w-14 text-sm font-medium text-gray-600 dark:text-gray-300">
							{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
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

					<!-- Extend Song Button -->
					<button
						onclick={() => (showExtendForm = !showExtendForm)}
						class="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-purple-100 text-purple-600 transition-colors hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-400 dark:hover:bg-purple-900"
						title="Extend song"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 5l7 7-7 7M5 5l7 7-7 7"
							/>
						</svg>
					</button>

					<!-- Stem Separation Button -->
					<div class="relative">
						<button
							onclick={() => (showStemOptions = !showStemOptions)}
							disabled={separatingType !== null}
							class="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-cyan-100 text-cyan-600 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-900/50 dark:text-cyan-400 dark:hover:bg-cyan-900"
							title="Stem Separation"
						>
							{#if separatingType !== null || pendingVocalSeparation || pendingStemSeparation}
								<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
							{:else}
								<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
									/>
								</svg>
							{/if}
						</button>

						<!-- Dropdown menu -->
						{#if showStemOptions}
							<div
								class="absolute top-14 right-0 z-10 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
							>
								<div class="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
									Separate Stems
								</div>
								<div class="space-y-2">
									<button
										onclick={() => requestStemSeparation('separate_vocal')}
										disabled={!!vocalSeparation || !!pendingVocalSeparation}
										class="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-700"
									>
										<span class="text-xl">🎤</span>
										<div>
											<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
												Vocals + Instrumental
											</div>
											<div class="text-xs text-gray-500 dark:text-gray-400">
												{#if vocalSeparation}
													✓ Already separated
												{:else if pendingVocalSeparation}
													Processing...
												{:else}
													Separate vocals from backing track
												{/if}
											</div>
										</div>
									</button>
									<button
										onclick={() => requestStemSeparation('split_stem')}
										disabled={!!stemSeparation || !!pendingStemSeparation}
										class="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-700"
									>
										<span class="text-xl">🎛️</span>
										<div>
											<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
												Full Stem Split
											</div>
											<div class="text-xs text-gray-500 dark:text-gray-400">
												{#if stemSeparation}
													✓ Already separated
												{:else if pendingStemSeparation}
													Processing...
												{:else}
													Drums, bass, guitar, keys, etc.
												{/if}
											</div>
										</div>
									</button>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<div
				class="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800"
			>
				<p class="text-gray-600 dark:text-gray-400">Audio not yet available</p>
			</div>
		{/if}
	</div>

	<!-- Extend Song Form -->
	{#if showExtendForm}
		<div class="mb-10">
			<ExtendSongForm
				{generation}
				{song}
				onExtend={handleExtend}
				onCancel={() => (showExtendForm = false)}
			/>
		</div>
	{/if}

	<!-- Stem Separation Results -->
	{#if vocalSeparation || stemSeparation || pendingVocalSeparation || pendingStemSeparation}
		<div class="mb-10 space-y-4">
			<!-- Vocal Separation (Vocals + Instrumental) -->
			{#if vocalSeparation}
				<div
					class="rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-800 dark:bg-cyan-900/30"
				>
					<h3 class="mb-4 flex items-center gap-2 font-semibold text-cyan-900 dark:text-cyan-100">
						<span class="text-xl">🎤</span>
						Vocals + Instrumental
					</h3>
					<StemPlayer separation={vocalSeparation} />
				</div>
			{:else if pendingVocalSeparation}
				<div
					class="rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-800 dark:bg-cyan-900/30"
				>
					<h3 class="flex items-center gap-2 font-semibold text-cyan-900 dark:text-cyan-100">
						<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Separating Vocals + Instrumental...
					</h3>
					<p class="mt-2 text-sm text-cyan-700 dark:text-cyan-300">
						This usually takes 1-2 minutes. You can leave this page and come back later.
					</p>
				</div>
			{/if}

			<!-- Full Stem Split -->
			{#if stemSeparation}
				<div
					class="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-4 dark:border-fuchsia-800 dark:bg-fuchsia-900/30"
				>
					<h3
						class="mb-4 flex items-center gap-2 font-semibold text-fuchsia-900 dark:text-fuchsia-100"
					>
						<span class="text-xl">🎛️</span>
						Full Stem Split
					</h3>
					<StemPlayer separation={stemSeparation} />
				</div>
			{:else if pendingStemSeparation}
				<div
					class="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-4 dark:border-fuchsia-800 dark:bg-fuchsia-900/30"
				>
					<h3 class="flex items-center gap-2 font-semibold text-fuchsia-900 dark:text-fuchsia-100">
						<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Separating Full Stems...
					</h3>
					<p class="mt-2 text-sm text-fuchsia-700 dark:text-fuchsia-300">
						This usually takes 2-5 minutes. You can leave this page and come back later.
					</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Extended Songs List -->
	{#if data.extendedGenerations && data.extendedGenerations.length > 0}
		<div
			class="mb-10 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/30"
		>
			<h3 class="mb-3 flex items-center gap-2 font-semibold text-green-900 dark:text-green-100">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 5l7 7-7 7M5 5l7 7-7 7"
					/>
				</svg>
				Extended Versions ({data.extendedGenerations.length})
			</h3>
			<div class="space-y-2">
				{#each data.extendedGenerations as extGen}
					<a
						href="/projects/{extGen.project_id}/generations/{extGen.id}"
						class="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm transition-colors hover:bg-green-100 dark:bg-green-900/40 dark:hover:bg-green-800/50"
					>
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-800"
						>
							<svg
								class="h-5 w-5 text-green-600 dark:text-green-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
								/>
							</svg>
						</div>
						<div class="flex-1">
							<p class="font-medium text-green-900 dark:text-green-100">{extGen.title}</p>
							<p class="text-sm text-green-700 dark:text-green-300">
								{#if extGen.continue_at}
									Continues from {formatTime(extGen.continue_at)}
								{/if}
								· {extGen.status === 'success' ? 'Complete' : extGen.status}
							</p>
						</div>
						<svg
							class="h-5 w-5 text-green-600 dark:text-green-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Secondary Details - Collapsible -->
	<div class="space-y-3">
		<!-- Style Section -->
		<div
			class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<button
				onclick={() => (styleExpanded = !styleExpanded)}
				class="flex w-full cursor-pointer items-center justify-between p-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
			>
				<div class="flex items-center gap-3">
					<svg
						class="h-5 w-5 text-indigo-600 dark:text-indigo-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
						/>
					</svg>
					<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Style</h2>
				</div>
				<svg
					class="h-5 w-5 text-gray-400 transition-transform {styleExpanded ? 'rotate-180' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>
			{#if styleExpanded}
				<div class="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
					<div class="p-4">
						<div class="mb-3 flex justify-end">
							<button
								onclick={() => copyToClipboard(generation.style, 'style')}
								class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700"
							>
								{#if styleCopied}
									<svg
										class="h-4 w-4 text-green-600 dark:text-green-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 13l4 4L19 7"
										/>
									</svg>
									Copied!
								{:else}
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
										/>
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
			<div
				class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
			>
				<button
					onclick={() => (lyricsExpanded = !lyricsExpanded)}
					class="flex w-full cursor-pointer items-center justify-between p-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
				>
					<div class="flex items-center gap-3">
						<svg
							class="h-5 w-5 text-indigo-600 dark:text-indigo-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Lyrics</h2>
					</div>
					<svg
						class="h-5 w-5 text-gray-400 transition-transform {lyricsExpanded ? 'rotate-180' : ''}"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</button>
				{#if lyricsExpanded}
					<div class="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
						<div class="p-4">
							<div class="mb-3 flex justify-end">
								<button
									onclick={() => copyToClipboard(generation.lyrics || '', 'lyrics')}
									class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700"
								>
									{#if lyricsCopied}
										<svg
											class="h-4 w-4 text-green-600 dark:text-green-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M5 13l4 4L19 7"
											/>
										</svg>
										Copied!
									{:else}
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
											/>
										</svg>
										Copy
									{/if}
								</button>
							</div>
							<p class="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
								{generation.lyrics}
							</p>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Cover Image Section -->
		{#if song.imageUrl}
			<div
				class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="p-4">
					<div class="mb-3 flex items-center gap-3">
						<svg
							class="h-5 w-5 text-indigo-600 dark:text-indigo-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
							/>
						</svg>
						<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Cover Art</h2>
					</div>
					<img src={song.imageUrl} alt={song.title} class="w-full rounded-lg object-cover" />
				</div>
			</div>
		{/if}
	</div>
</div>
