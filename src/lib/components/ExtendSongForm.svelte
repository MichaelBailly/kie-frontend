<script lang="ts">
	import type { Generation } from '$lib/types';
	import Waveform from './Waveform.svelte';
	import { audioStore, type AudioTrack } from '$lib/stores/audio.svelte';
	import { untrack } from 'svelte';

	let {
		generation,
		song,
		onExtend,
		onCancel
	}: {
		generation: Generation;
		song: {
			id: string;
			streamUrl: string | null;
			audioUrl: string | null;
			imageUrl: string | null;
			duration: number | null;
			title: string;
		};
		onExtend: (data: {
			title: string;
			style: string;
			lyrics: string;
			continueAt: number;
		}) => Promise<void>;
		onCancel: () => void;
	} = $props();

	// Initialize with props values - intentionally capturing initial values for form pre-fill
	let title = $state(untrack(() => generation.title));
	let style = $state(untrack(() => generation.style));
	let lyrics = $state(untrack(() => generation.lyrics));
	let continueAt = $state(untrack(() => (song.duration ? Math.floor(song.duration * 0.75) : 30)));
	let isSubmitting = $state(false);

	// For preview playback
	let isCurrentTrack = $derived(audioStore.isCurrentTrack(song.id));
	let isPlaying = $derived(audioStore.isTrackPlaying(song.id));
	let currentTime = $derived(isCurrentTrack ? audioStore.currentTime : 0);
	let duration = $derived(song.duration || 0);

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function handleWaveformSeek(time: number) {
		// When clicking on waveform, set the continueAt point instead of playing
		continueAt = Math.floor(time);
	}

	function handlePlayPreview() {
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

		if (isCurrentTrack) {
			audioStore.toggle();
		} else {
			audioStore.play(track);
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!title.trim() || !style.trim() || !lyrics.trim()) return;
		if (continueAt <= 0 || continueAt >= duration) return;

		isSubmitting = true;
		try {
			await onExtend({ title, style, lyrics, continueAt });
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="space-y-6">
	<div
		class="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/30"
	>
		<h3 class="mb-2 flex items-center gap-2 font-semibold text-indigo-900 dark:text-indigo-100">
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 5l7 7-7 7M5 5l7 7-7 7"
				/>
			</svg>
			Extend This Song
		</h3>
		<p class="text-sm text-indigo-700 dark:text-indigo-300">
			Create a continuation of this song starting from a specific point. The AI will generate new
			music that seamlessly continues from where you choose.
		</p>
	</div>

	<!-- Continue At Selection with Waveform -->
	<div
		class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
	>
		<label
			for="continue-at-slider"
			class="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300"
		>
			Continue From: <span class="font-bold text-indigo-600 dark:text-indigo-400"
				>{formatTime(continueAt)}</span
			>
		</label>

		<!-- Waveform with marker -->
		<div class="relative mb-4">
			{#if song.audioUrl || song.streamUrl}
				<Waveform
					audioUrl={song.audioUrl || song.streamUrl || ''}
					height={80}
					currentTime={continueAt}
					{duration}
					color="#6366f1"
					backgroundColor="#e5e7eb"
					onSeek={handleWaveformSeek}
				/>
				<!-- Continue point marker -->
				<div
					class="pointer-events-none absolute top-0 h-full w-0.5 bg-red-500"
					style="left: {(continueAt / duration) * 100}%"
				>
					<div
						class="absolute -top-1 left-1/2 -translate-x-1/2 rounded bg-red-500 px-1.5 py-0.5 text-xs font-medium text-white"
					>
						{formatTime(continueAt)}
					</div>
				</div>
			{:else}
				<div class="flex h-20 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
					<p class="text-sm text-gray-500 dark:text-gray-400">Audio not available</p>
				</div>
			{/if}
		</div>

		<!-- Slider for precise control -->
		<div class="flex items-center gap-3">
			<span class="text-sm text-gray-500 dark:text-gray-400">0:00</span>
			<input
				type="range"
				id="continue-at-slider"
				min="1"
				max={Math.floor(duration) - 1}
				bind:value={continueAt}
				class="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600 dark:bg-gray-700"
			/>
			<span class="text-sm text-gray-500 dark:text-gray-400">{formatTime(duration)}</span>
		</div>

		<!-- Play preview button -->
		<div class="mt-4 flex justify-center">
			<button
				type="button"
				onclick={handlePlayPreview}
				class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
			>
				{#if isPlaying}
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
					</svg>
					Pause Preview
				{:else}
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M8 5v14l11-7z" />
					</svg>
					Preview Original
				{/if}
			</button>
		</div>
	</div>

	<!-- Form fields -->
	<form onsubmit={handleSubmit} class="space-y-5">
		<div>
			<label
				for="extend-title"
				class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				Title
			</label>
			<input
				type="text"
				id="extend-title"
				bind:value={title}
				placeholder="Enter song title..."
				maxlength="80"
				class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-500 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
			/>
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{title.length}/80 characters</p>
		</div>

		<div>
			<label
				for="extend-style"
				class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				Style Prompt
			</label>
			<textarea
				id="extend-style"
				bind:value={style}
				placeholder="Describe the musical style..."
				rows="3"
				maxlength="1000"
				class="w-full resize-y rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-500 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
			></textarea>
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{style.length}/1000 characters</p>
		</div>

		<div>
			<label
				for="extend-lyrics"
				class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				Lyrics (how the song should continue)
			</label>
			<textarea
				id="extend-lyrics"
				bind:value={lyrics}
				placeholder="Write your continuation lyrics here..."
				rows="8"
				maxlength="5000"
				class="w-full resize-y rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-mono text-sm text-gray-900 placeholder-gray-500 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
			></textarea>
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{lyrics.length}/5000 characters</p>
		</div>

		<div class="flex gap-3 pt-2">
			<button
				type="button"
				onclick={onCancel}
				disabled={isSubmitting}
				class="flex-1 cursor-pointer rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={isSubmitting ||
					!title.trim() ||
					!style.trim() ||
					!lyrics.trim() ||
					continueAt <= 0 ||
					continueAt >= duration}
				class="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
			>
				{#if isSubmitting}
					<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Extending...
				{:else}
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 5l7 7-7 7M5 5l7 7-7 7"
						/>
					</svg>
					Extend Song
				{/if}
			</button>
		</div>
	</form>
</div>
