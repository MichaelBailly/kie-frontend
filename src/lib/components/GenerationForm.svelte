<script lang="ts">
	import AudioPlayer from './AudioPlayer.svelte';

	let {
		title = $bindable(''),
		style = $bindable(''),
		lyrics = $bindable(''),
		onNewGeneration
	}: {
		title: string;
		style: string;
		lyrics: string;
		onNewGeneration: (title: string, style: string, lyrics: string) => void;
	} = $props();

	let isSubmitting = $state(false);

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
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
		<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Create New Song</h2>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		<!-- Generation form -->
		<form onsubmit={handleSubmit} class="space-y-5">
			<div>
				<label
					for="title"
					class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
				>
					Title
				</label>
				<input
					type="text"
					id="title"
					bind:value={title}
					placeholder="Enter song title..."
					maxlength="80"
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-500 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
				/>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{title.length}/80 characters</p>
			</div>

			<div>
				<label
					for="style"
					class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
				>
					Style Prompt
				</label>
				<textarea
					id="style"
					bind:value={style}
					placeholder="Describe the musical style (e.g., 'Upbeat pop, catchy melody, female vocals, 120 bpm')..."
					rows="3"
					maxlength="1000"
					class="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-500 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
				></textarea>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{style.length}/1000 characters</p>
			</div>

			<div>
				<label
					for="lyrics"
					class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
				>
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
					class="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-mono text-sm text-gray-900 placeholder-gray-500 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
				></textarea>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{lyrics.length}/5000 characters</p>
			</div>

			<div class="pt-2">
				<button
					type="submit"
					disabled={isSubmitting || !title.trim() || !style.trim() || !lyrics.trim()}
					class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
				>
					{#if isSubmitting}
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
						Generating...
					{:else}
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
							/>
						</svg>
						Generate Song
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>
