<script lang="ts">
	import type { Generation } from '$lib/types';
	import { getStatusLabel, isGenerating } from '$lib/types';
	import AudioPlayer from './AudioPlayer.svelte';

	let { generation }: { generation: Generation } = $props();
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
		<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
			{generation.title}
		</h2>
		{#if isGenerating(generation.status)}
			<div class="mt-2 flex items-center gap-2">
				<div class="h-2 w-2 animate-pulse rounded-full bg-amber-500"></div>
				<span class="text-sm text-amber-600 dark:text-amber-400">
					{getStatusLabel(generation.status)}
				</span>
			</div>
			{#if generation.track1_stream_url || generation.track2_stream_url}
				<div class="mt-2 text-sm text-blue-600 dark:text-blue-400">
					💡 Preview available below while generation completes
				</div>
			{/if}
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		<!-- Status indicator for completed or error -->
		{#if generation.status === 'success'}
			<div
				class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
			>
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
		{:else if generation.status === 'error'}
			<div
				class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
			>
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
		{#if generation.track1_stream_url || generation.track1_audio_url}
			<div class="mb-6 space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
						{#if isGenerating(generation.status)}
							Preview (Generating...)
						{:else}
							Generated Tracks
						{/if}
					</h3>
					{#if isGenerating(generation.status) && (generation.track1_stream_url || generation.track2_stream_url)}
						<span class="text-xs text-gray-500 dark:text-gray-400">
							Final audio will be higher quality
						</span>
					{/if}
				</div>
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

		<!-- Song details (read-only) -->
		<div class="space-y-5">
			<div>
				<h4 class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
					Title
				</h4>
				<div
					class="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
				>
					{generation.title}
				</div>
			</div>

			<div>
				<h4 class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
					Style Prompt
				</h4>
				<div
					class="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
				>
					{generation.style}
				</div>
			</div>

			<div>
				<h4 class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
					Lyrics
				</h4>
				<div
					class="w-full whitespace-pre-wrap rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
				>
					{generation.lyrics}
				</div>
			</div>
		</div>
	</div>
</div>
