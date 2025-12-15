<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	let {
		audioUrl,
		height = 100,
		color = '#6366f1',
		backgroundColor = '#e5e7eb',
		progressColor = '#818cf8',
		currentTime = 0,
		duration = 0,
		onSeek
	}: {
		audioUrl: string;
		height?: number;
		color?: string;
		backgroundColor?: string;
		progressColor?: string;
		currentTime?: number;
		duration?: number;
		onSeek?: (time: number) => void;
	} = $props();

	let container: HTMLDivElement | undefined = $state();
	let waveformData: number[] = $state([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	async function loadWaveform() {
		try {
			isLoading = true;
			error = null;

			const audioContext = new AudioContext();
			const response = await fetch(audioUrl);
			const arrayBuffer = await response.arrayBuffer();
			const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

			// Get the audio data from both channels and merge them
			const channelData = audioBuffer.getChannelData(0);
			const samples = 300; // More samples for smoother visualization
			const blockSize = Math.floor(channelData.length / samples);

			const peaks: number[] = [];
			for (let i = 0; i < samples; i++) {
				let max = 0;
				for (let j = 0; j < blockSize; j++) {
					const val = Math.abs(channelData[i * blockSize + j]);
					if (val > max) max = val;
				}
				peaks.push(max);
			}

			// Normalize peaks
			const maxPeak = Math.max(...peaks);
			waveformData = peaks.map((p) => (maxPeak > 0 ? p / maxPeak : 0));
			isLoading = false;

			// Draw the waveform
			drawWaveform();
		} catch (err) {
			console.error('Error loading waveform:', err);
			error = 'Failed to load waveform';
			isLoading = false;
		}
	}

	function drawWaveform() {
		if (!container || waveformData.length === 0) return;

		// Clear previous SVG
		d3.select(container).selectAll('svg').remove();

		const containerWidth = container.clientWidth;
		const margin = { top: 4, right: 0, bottom: 4, left: 0 };
		const innerHeight = height - margin.top - margin.bottom;

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', containerWidth)
			.attr('height', height)
			.attr('class', 'cursor-pointer rounded-lg');

		const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

		// Scales
		const xScale = d3
			.scaleLinear()
			.domain([0, waveformData.length - 1])
			.range([0, containerWidth]);

		const yScale = d3.scaleLinear().domain([0, 1]).range([innerHeight / 2, 0]);

		// Calculate progress
		const progress = duration > 0 ? currentTime / duration : 0;
		const progressX = progress * containerWidth;

		// Define gradient for played/unplayed sections
		const defs = svg.append('defs');

		const gradient = defs
			.append('linearGradient')
			.attr('id', 'waveform-gradient')
			.attr('gradientUnits', 'userSpaceOnUse')
			.attr('x1', 0)
			.attr('x2', containerWidth);

		gradient
			.append('stop')
			.attr('offset', progress)
			.attr('stop-color', color);

		gradient
			.append('stop')
			.attr('offset', progress)
			.attr('stop-color', backgroundColor);

		// Create area generators for upper and lower half
		const upperArea = d3
			.area<number>()
			.x((_: number, i: number) => xScale(i))
			.y0(innerHeight / 2)
			.y1((d: number) => yScale(d))
			.curve(d3.curveBasis);

		const lowerArea = d3
			.area<number>()
			.x((_: number, i: number) => xScale(i))
			.y0(innerHeight / 2)
			.y1((d: number) => innerHeight / 2 + (innerHeight / 2 - yScale(d)))
			.curve(d3.curveBasis);

		// Draw background waveform (subtle)
		g.append('path')
			.datum(waveformData)
			.attr('d', upperArea)
			.attr('fill', backgroundColor)
			.attr('opacity', 0.5);

		g.append('path')
			.datum(waveformData)
			.attr('d', lowerArea)
			.attr('fill', backgroundColor)
			.attr('opacity', 0.5);

		// Draw main waveform with gradient
		g.append('path')
			.datum(waveformData)
			.attr('d', upperArea)
			.attr('fill', 'url(#waveform-gradient)');

		g.append('path')
			.datum(waveformData)
			.attr('d', lowerArea)
			.attr('fill', 'url(#waveform-gradient)');

		// Draw progress line
		if (progress > 0) {
			g.append('line')
				.attr('x1', progressX)
				.attr('x2', progressX)
				.attr('y1', 0)
				.attr('y2', innerHeight)
				.attr('stroke', color)
				.attr('stroke-width', 2)
				.attr('opacity', 0.8);
		}

		// Click handler for seeking
		svg.on('click', function (event: MouseEvent) {
			if (duration === 0) return;
			const [x] = d3.pointer(event);
			const seekProgress = x / containerWidth;
			const newTime = seekProgress * duration;
			onSeek?.(newTime);
		});

		// Hover effect
		svg
			.on('mouseenter', function (this: SVGSVGElement) {
				d3.select(this).style('opacity', 0.9);
			})
			.on('mouseleave', function (this: SVGSVGElement) {
				d3.select(this).style('opacity', 1);
			});
	}

	onMount(() => {
		loadWaveform();

		// Redraw on window resize
		const handleResize = () => {
			if (!isLoading && waveformData.length > 0) {
				drawWaveform();
			}
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	// Redraw when currentTime changes
	$effect(() => {
		if (currentTime !== undefined && !isLoading) {
			drawWaveform();
		}
	});
</script>

{#if isLoading}
	<div class="flex items-center justify-center" style="height: {height}px;">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
			<span class="text-sm text-gray-500 dark:text-gray-400">Loading waveform...</span>
		</div>
	</div>
{:else if error}
	<div class="flex items-center justify-center" style="height: {height}px;">
		<div class="flex items-center gap-2 text-red-500">
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span class="text-sm">{error}</span>
		</div>
	</div>
{:else}
	<div bind:this={container} class="w-full" style="height: {height}px;"></div>
{/if}
