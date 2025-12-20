<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';

	let {
		isOpen = $bindable(false),
		onClose
	}: {
		isOpen: boolean;
		onClose: () => void;
	} = $props();

	let taskId = $state('');
	let projectName = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');
	let inputElement: HTMLInputElement | undefined = $state();

	// Focus input when modal opens
	$effect(() => {
		if (isOpen) {
			setTimeout(() => inputElement?.focus(), 100);
		}
	});

	// Reset form when modal closes
	$effect(() => {
		if (!isOpen) {
			taskId = '';
			projectName = '';
			errorMessage = '';
			isLoading = false;
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();

		const trimmedTaskId = taskId.trim();
		if (!trimmedTaskId) {
			errorMessage = 'Please enter a Task ID';
			return;
		}

		isLoading = true;
		errorMessage = '';

		try {
			const response = await fetch('/api/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					taskId: trimmedTaskId,
					projectName: projectName.trim() || undefined
				})
			});

			const data = await response.json();

			if (!response.ok) {
				errorMessage = data.message || 'Failed to import song';
				return;
			}

			// Success! Navigate to the new project
			onClose();
			await invalidateAll();
			await goto(`/projects/${data.project.id}/generations/${data.generation.id}`);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
		onclick={handleBackdropClick}
		role="dialog"
		aria-modal="true"
		aria-labelledby="import-modal-title"
		tabindex="-1"
	>
		<!-- Modal -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="relative mx-4 w-full max-w-md rounded-xl bg-white shadow-2xl dark:bg-gray-800"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
			>
				<h2 id="import-modal-title" class="text-lg font-semibold text-gray-900 dark:text-gray-100">
					Import Existing Song
				</h2>
				<button
					onclick={onClose}
					class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
					aria-label="Close modal"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Body -->
			<form onsubmit={handleSubmit} class="p-6">
				<div class="space-y-4">
					<!-- Task ID field -->
					<div>
						<label
							for="task-id"
							class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Task ID <span class="text-red-500">*</span>
						</label>
						<input
							bind:this={inputElement}
							bind:value={taskId}
							type="text"
							id="task-id"
							placeholder="Enter the KIE task ID..."
							disabled={isLoading}
							class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-500 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
						/>
						<p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
							The unique identifier from a previous generation (e.g., from the KIE API response)
						</p>
					</div>

					<!-- Project name field -->
					<div>
						<label
							for="project-name"
							class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Project Name <span class="text-gray-400">(optional)</span>
						</label>
						<input
							bind:value={projectName}
							type="text"
							id="project-name"
							placeholder="My Imported Project"
							disabled={isLoading}
							class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-500 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
						/>
						<p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
							Leave empty to use the song title as the project name
						</p>
					</div>

					<!-- Error message -->
					{#if errorMessage}
						<div
							class="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/30"
						>
							<div class="flex items-start gap-2">
								<svg
									class="mt-0.5 h-4 w-4 shrink-0 text-red-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<p class="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
							</div>
						</div>
					{/if}

					<!-- Info box -->
					<div
						class="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/30"
					>
						<div class="flex items-start gap-2">
							<svg
								class="mt-0.5 h-4 w-4 shrink-0 text-blue-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<p class="text-sm text-blue-600 dark:text-blue-400">
								Importing a song will create a new project with the generated tracks. Only completed
								generations can be imported.
							</p>
						</div>
					</div>
				</div>

				<!-- Actions -->
				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={onClose}
						disabled={isLoading}
						class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isLoading || !taskId.trim()}
						class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isLoading}
							<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
							Importing...
						{:else}
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
								/>
							</svg>
							Import Song
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
