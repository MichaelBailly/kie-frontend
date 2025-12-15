<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { audioStore } from '$lib/stores/audio.svelte';

	let audio: HTMLAudioElement | undefined = $state();

	onMount(() => {
		if (audio) {
			audioStore.setAudioElement(audio);
		}
	});

	onDestroy(() => {
		audioStore.setAudioElement(null);
	});

	function handleTimeUpdate() {
		if (audio) {
			audioStore.onTimeUpdate(audio.currentTime);
		}
	}

	function handleDurationChange() {
		if (audio) {
			audioStore.onDurationChange(audio.duration);
		}
	}

	function handleLoadedMetadata() {
		if (audio) {
			audioStore.onDurationChange(audio.duration);
			// Check if we need to resume after a URL swap
			if (audioStore.hasPendingUrlSwap()) {
				audioStore.handleUrlSwapReady();
			}
		}
	}

	function handlePlay() {
		audioStore.onPlay();
	}

	function handlePause() {
		audioStore.onPause();
	}

	function handleEnded() {
		audioStore.onEnded();
	}
</script>

<!-- Hidden audio element that persists across navigation -->
<audio
	bind:this={audio}
	ontimeupdate={handleTimeUpdate}
	ondurationchange={handleDurationChange}
	onloadedmetadata={handleLoadedMetadata}
	onplay={handlePlay}
	onpause={handlePause}
	onended={handleEnded}
	preload="metadata"
	class="hidden"
></audio>
