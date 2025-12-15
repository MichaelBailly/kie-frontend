<script lang="ts">
	let {
		src,
		title = 'Audio Track',
		imageUrl = '',
		duration = 0
	}: {
		src: string;
		title?: string;
		imageUrl?: string;
		duration?: number;
	} = $props();

	let audio: HTMLAudioElement | undefined = $state();
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let audioDuration = $state(0);
	let volume = $state(1);
	let isMuted = $state(false);

	// Sync duration from props
	$effect(() => {
		if (duration > 0) {
			audioDuration = duration;
		}
	});

	function togglePlay() {
		if (!audio) return;
		if (isPlaying) {
			audio.pause();
		} else {
			audio.play();
		}
	}

	function handleTimeUpdate() {
		if (!audio) return;
		currentTime = audio.currentTime;
	}

	function handleLoadedMetadata() {
		if (!audio) return;
		audioDuration = audio.duration;
	}

	function handleSeek(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!audio) return;
		audio.currentTime = parseFloat(target.value);
	}

	function handleVolumeChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!audio) return;
		volume = parseFloat(target.value);
		audio.volume = volume;
		isMuted = volume === 0;
	}

	function toggleMute() {
		if (!audio) return;
		isMuted = !isMuted;
		audio.muted = isMuted;
	}

	function formatTime(seconds: number): string {
		if (!seconds || isNaN(seconds)) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<div
	class="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
>
	<audio
		bind:this={audio}
		{src}
		onplay={() => (isPlaying = true)}
		onpause={() => (isPlaying = false)}
		ontimeupdate={handleTimeUpdate}
		onloadedmetadata={handleLoadedMetadata}
		onended={() => (isPlaying = false)}
		preload="metadata"
	></audio>

	{#if imageUrl}
		<img src={imageUrl} alt={title} class="h-16 w-16 shrink-0 rounded-lg object-cover" />
	{:else}
		<div
			class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600"
		>
			<svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
				/>
			</svg>
		</div>
	{/if}

	<div class="min-w-0 flex-1">
		<h4 class="truncate font-medium text-gray-900 dark:text-gray-100">{title}</h4>
		<div class="mt-2 flex items-center gap-3">
			<!-- Play/Pause button -->
			<button
				onclick={togglePlay}
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-700"
			>
				{#if isPlaying}
					<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
						<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
					</svg>
				{:else}
					<svg class="h-5 w-5 pl-0.5" fill="currentColor" viewBox="0 0 24 24">
						<path d="M8 5v14l11-7z" />
					</svg>
				{/if}
			</button>

			<!-- Progress bar -->
			<div class="flex flex-1 items-center gap-2">
				<span class="w-10 text-xs text-gray-500 dark:text-gray-400">
					{formatTime(currentTime)}
				</span>
				<input
					type="range"
					min="0"
					max={audioDuration || 100}
					value={currentTime}
					oninput={handleSeek}
					class="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600 dark:bg-gray-700"
				/>
				<span class="w-10 text-xs text-gray-500 dark:text-gray-400">
					{formatTime(audioDuration)}
				</span>
			</div>

			<!-- Volume control -->
			<div class="flex items-center gap-2">
				<button onclick={toggleMute} class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
					{#if isMuted || volume === 0}
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
							/>
						</svg>
					{:else}
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
							/>
						</svg>
					{/if}
				</button>
				<input
					type="range"
					min="0"
					max="1"
					step="0.1"
					value={volume}
					oninput={handleVolumeChange}
					class="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600 sm:block dark:bg-gray-700"
				/>
			</div>
		</div>
	</div>
</div>
