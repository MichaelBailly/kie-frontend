<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import GlobalAudioPlayer from '$lib/components/GlobalAudioPlayer.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<GlobalAudioPlayer />
{@render children()}
