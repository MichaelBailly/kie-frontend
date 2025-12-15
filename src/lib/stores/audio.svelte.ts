import { browser } from '$app/environment';

export interface AudioTrack {
	id: string; // Unique identifier (audio_id from generation)
	generationId: number;
	projectId: number;
	title: string;
	imageUrl: string | null;
	streamUrl: string | null;
	audioUrl: string | null;
	duration: number | null;
}

interface AudioState {
	currentTrack: AudioTrack | null;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	isMuted: boolean;
}

function createAudioStore() {
	const state = $state<AudioState>({
		currentTrack: null,
		isPlaying: false,
		currentTime: 0,
		duration: 0,
		volume: 1,
		isMuted: false
	});

	// Reference to the actual audio element (set by GlobalAudioPlayer)
	let audioElement: HTMLAudioElement | null = null;

	// Track pending URL swap for streaming → final transition
	let pendingUrlSwap: { url: string; resumeTime: number } | null = null;

	return {
		get state() {
			return state;
		},

		get currentTrack() {
			return state.currentTrack;
		},

		get isPlaying() {
			return state.isPlaying;
		},

		get currentTime() {
			return state.currentTime;
		},

		get duration() {
			return state.duration;
		},

		get volume() {
			return state.volume;
		},

		get isMuted() {
			return state.isMuted;
		},

		/**
		 * Register the audio element from GlobalAudioPlayer
		 */
		setAudioElement(element: HTMLAudioElement | null) {
			audioElement = element;
		},

		/**
		 * Play a track. If it's the same track, just resume. If different, load and play.
		 */
		play(track: AudioTrack) {
			if (!audioElement || !browser) return;

			const currentSrc = state.currentTrack?.audioUrl || state.currentTrack?.streamUrl;
			const newSrc = track.audioUrl || track.streamUrl;

			if (state.currentTrack?.id === track.id && currentSrc) {
				// Same track, just resume
				audioElement.play();
			} else {
				// Different track, load and play
				state.currentTrack = track;
				state.currentTime = 0;
				state.duration = track.duration || 0;

				if (newSrc) {
					audioElement.src = newSrc;
					audioElement.load();
					audioElement.play();
				}
			}
		},

		/**
		 * Pause playback
		 */
		pause() {
			if (!audioElement) return;
			audioElement.pause();
		},

		/**
		 * Toggle play/pause
		 */
		toggle() {
			if (!audioElement) return;
			if (state.isPlaying) {
				audioElement.pause();
			} else {
				audioElement.play();
			}
		},

		/**
		 * Seek to a specific time
		 */
		seek(time: number) {
			if (!audioElement) return;
			audioElement.currentTime = time;
			state.currentTime = time;
		},

		/**
		 * Set volume (0-1)
		 */
		setVolume(volume: number) {
			if (!audioElement) return;
			state.volume = Math.max(0, Math.min(1, volume));
			audioElement.volume = state.volume;
			state.isMuted = state.volume === 0;
		},

		/**
		 * Toggle mute
		 */
		toggleMute() {
			if (!audioElement) return;
			state.isMuted = !state.isMuted;
			audioElement.muted = state.isMuted;
		},

		/**
		 * Stop playback and clear current track
		 */
		stop() {
			if (!audioElement) return;
			audioElement.pause();
			audioElement.currentTime = 0;
			state.currentTrack = null;
			state.currentTime = 0;
			state.duration = 0;
			state.isPlaying = false;
		},

		/**
		 * Update track URLs (e.g., when generation completes and final URLs are available).
		 * If the updated track is currently playing, swap the source seamlessly.
		 */
		updateTrackUrls(
			trackId: string,
			updates: { streamUrl?: string | null; audioUrl?: string | null; duration?: number | null }
		) {
			if (!state.currentTrack || state.currentTrack.id !== trackId) return;

			const wasPlaying = state.isPlaying;
			const resumeTime = state.currentTime;

			// Update track data
			state.currentTrack = {
				...state.currentTrack,
				streamUrl: updates.streamUrl ?? state.currentTrack.streamUrl,
				audioUrl: updates.audioUrl ?? state.currentTrack.audioUrl,
				duration: updates.duration ?? state.currentTrack.duration
			};

			// If we now have a final audioUrl and were using streamUrl, swap sources
			if (updates.audioUrl && audioElement && wasPlaying) {
				const currentSrc = audioElement.src;
				const wasUsingStream =
					state.currentTrack.streamUrl && currentSrc.includes(state.currentTrack.streamUrl);

				if (wasUsingStream || !currentSrc) {
					// Store pending swap info
					pendingUrlSwap = { url: updates.audioUrl, resumeTime };

					// Pause current playback
					audioElement.pause();

					// Load new source
					audioElement.src = updates.audioUrl;
					audioElement.load();

					// The onloadedmetadata handler in GlobalAudioPlayer will handle resumption
				}
			}
		},

		/**
		 * Handle URL swap completion (called by GlobalAudioPlayer when metadata loads)
		 */
		handleUrlSwapReady() {
			if (!pendingUrlSwap || !audioElement) return;

			const { resumeTime } = pendingUrlSwap;
			audioElement.currentTime = resumeTime;
			audioElement.play();
			pendingUrlSwap = null;
		},

		/**
		 * Check if there's a pending URL swap
		 */
		hasPendingUrlSwap() {
			return pendingUrlSwap !== null;
		},

		// Event handlers for the audio element (called by GlobalAudioPlayer)
		onTimeUpdate(time: number) {
			state.currentTime = time;
		},

		onDurationChange(duration: number) {
			state.duration = duration;
		},

		onPlay() {
			state.isPlaying = true;
		},

		onPause() {
			state.isPlaying = false;
		},

		onEnded() {
			state.isPlaying = false;
			state.currentTime = 0;
		},

		/**
		 * Check if a specific track is currently playing
		 */
		isTrackPlaying(trackId: string): boolean {
			return state.currentTrack?.id === trackId && state.isPlaying;
		},

		/**
		 * Check if a specific track is the current track (playing or paused)
		 */
		isCurrentTrack(trackId: string): boolean {
			return state.currentTrack?.id === trackId;
		}
	};
}

export const audioStore = createAudioStore();
