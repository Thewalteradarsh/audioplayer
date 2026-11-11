import { useAppStore } from '../store/useAppStore';
import { syncMediaSession } from './MediaSessionSync';
import { OfflineStorage } from './OfflineStorage';
import { getAudioStreamUrl } from '../utils/audioHelper';
import { api } from '../utils/apiClient';

class AudioEngineSingleton {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    // Removed crossOrigin="anonymous" to avoid CORS preflight rejection by JioSaavn CDN (aac.saavncdn.com)
    this.audio.volume = useAppStore.getState().playbackState.volume ?? 1;
    
    // Internal state
    this.currentTrackId = null;
    this._loadSeq = 0;
    this.historyTimer = null;
    this.historyLogged = false;
    this.animationFrameId = null;
    this.lastUpdateTime = 0;
    this.consecutiveFailures = 0;

    this._bindEvents();
    this._subscribeToStore();
    this.currentObjectUrl = null;
  }

  _bindEvents() {
    this.audio.addEventListener('playing', () => {
      this.consecutiveFailures = 0;
      useAppStore.getState().setStatus('PLAYING');
      if (!this.historyLogged) {
        this._startHistoryTimer();
      }
    });

    this.audio.addEventListener('pause', () => {
      if (!this.audio.ended) {
        useAppStore.getState().setStatus('PAUSED');
      }
      this._pauseHistoryTimer();
    });

    this.audio.addEventListener('waiting', () => {
      useAppStore.getState().setStatus('LOADING');
      this._pauseHistoryTimer();
    });

    this.audio.addEventListener('ended', () => {
      this._clearHistoryTimer();
      useAppStore.getState().playNext();
    });

    this.audio.addEventListener('canplay', () => {
      console.info('[AudioEngine] Can play track:', this.audio.src);
    });

    this.audio.addEventListener('error', (e) => {
      if (!this.audio.getAttribute('src')) return;
      const mediaErr = this.audio.error;
      console.error("[AudioEngine] Playback Error:", {
        code: mediaErr?.code,
        message: mediaErr?.message,
        src: this.audio.src,
        event: e
      });

      // Fallback Strategy: If 320kbps fails, drop to 160kbps, then 96kbps
      if (this.audio.src && this.audio.src.includes('_320.')) {
         console.warn("[AudioEngine] 320kbps stream failed. Falling back to 160kbps stream...");
         this.audio.src = this.audio.src.replace('_320.', '_160.');
         this.audio.load();
         this.audio.play().catch(err => {
           if (err.name === 'AbortError') return;
           console.error("[AudioEngine] 160kbps fallback play failed:", err);
           this._handleFatalError(err);
         });
      } else if (this.audio.src && this.audio.src.includes('_160.')) {
         console.warn("[AudioEngine] 160kbps stream failed. Falling back to 96kbps stream...");
         this.audio.src = this.audio.src.replace('_160.', '_96.');
         this.audio.load();
         this.audio.play().catch(err => {
           if (err.name === 'AbortError') return;
           console.error("[AudioEngine] 96kbps fallback play failed:", err);
           this._handleFatalError(err);
         });
      } else {
         this._handleFatalError(e);
      }
    });

    // Update duration from audio.duration with fallback to store/API duration
    this.audio.addEventListener('loadedmetadata', () => {
      const dur = this.audio.duration;
      const currentTrack = useAppStore.getState().playbackState.currentTrack;
      if (Number.isFinite(dur) && dur > 0) {
        useAppStore.getState().setDuration(dur);
      } else if (currentTrack?.duration && Number(currentTrack.duration) > 0) {
        useAppStore.getState().setDuration(Number(currentTrack.duration));
      }
    });

    this.audio.addEventListener('durationchange', () => {
      const dur = this.audio.duration;
      if (Number.isFinite(dur) && dur > 0) {
        useAppStore.getState().setDuration(dur);
      }
    });

    // Native timeupdate listener ensures backgrounded tabs and lock screen reflect accurate time
    this.audio.addEventListener('timeupdate', () => {
      if (Number.isFinite(this.audio.currentTime)) {
        useAppStore.getState().setProgress(this.audio.currentTime);
      }
      if (
        !this.audio.paused &&
        !this.audio.ended &&
        this.audio.readyState >= 2 &&
        useAppStore.getState().playbackState.status === 'LOADING'
      ) {
        useAppStore.getState().setStatus('PLAYING');
      }
    });

    // Throttled UI progress updater for high-frequency smooth rendering
    const updateProgress = (timestamp) => {
      if (timestamp - this.lastUpdateTime > 250) {
        useAppStore.getState().setProgress(this.audio.currentTime);
        this.lastUpdateTime = timestamp;
      }
      if (!this.audio.paused) {
        this.animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    this.audio.addEventListener('play', () => {
      this.animationFrameId = requestAnimationFrame(updateProgress);
    });

    this.audio.addEventListener('pause', () => {
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    });
  }

  _handleFatalError(_e) {
      this.consecutiveFailures++;
      useAppStore.getState().setStatus('ERROR');
      this._clearHistoryTimer();
      
      if (this.consecutiveFailures >= 3) {
        console.error("[AudioEngine] Playback halted due to 3 consecutive failures.");
        return;
      }
      
      // Auto-advance out of the dead-end after 2 seconds
      setTimeout(() => {
        console.info("[AudioEngine] Auto-advancing past failed track.");
        useAppStore.getState().playNext();
      }, 2000);
  }

  _stopAndClear() {
    this._loadSeq++;
    this.currentTrackId = null;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this._clearHistoryTimer();
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }

  _subscribeToStore() {
    // Listen for track changes OR explicit play/replay requests
    useAppStore.subscribe(
      (state) => `${state.playbackState.currentTrack?.id || ''}::${state.playbackState.playRequestId}`,
      () => {
        const newTrack = useAppStore.getState().playbackState.currentTrack;
        if (!newTrack) {
          this._stopAndClear();
          return;
        }
        this._loadAndPlay(newTrack);
      }
    );

    // Listen for rewind-to-zero triggers (SkipBack after >3s or Repeat One)
    useAppStore.subscribe(
      (state) => state.playbackState.seekZeroSeq,
      (seq) => {
        if (seq === 0) return;
        if (this.audio.getAttribute('src')) {
          this.audio.currentTime = 0;
          useAppStore.getState().setProgress(0);
          if (this.audio.paused && useAppStore.getState().playbackState.status === 'LOADING') {
            this.audio.play().catch(err => {
              if (err.name !== 'AbortError') {
                console.warn('[AudioEngine] Rewind play failed:', err);
              }
            });
          }
        }
      }
    );

    // Pause audio cleanly if playback state transitions to IDLE
    useAppStore.subscribe(
      (state) => state.playbackState.status,
      (status) => {
        if (status === 'IDLE' && !this.audio.paused) {
          this.audio.pause();
          this._pauseHistoryTimer();
        }
      }
    );

    // Listen for volume changes
    useAppStore.subscribe(
      (state) => state.playbackState.volume,
      (volume) => {
        const numeric = Number(volume);
        this.audio.volume = Math.max(0, Math.min(1, Number.isFinite(numeric) ? numeric : 1));
      }
    );
  }

  async _loadAndPlay(track) {
    if (!track) return;
    const loadId = ++this._loadSeq;
    this._clearHistoryTimer();
    this.historyLogged = false;

    // Fast path: if the same track is already loaded cleanly, just rewind and play
    if (
      this.currentTrackId === track.id &&
      this.audio.getAttribute('src') &&
      !this.audio.error &&
      this.audio.readyState >= 1
    ) {
      this.audio.currentTime = 0;
      useAppStore.getState().setProgress(0);
      useAppStore.getState().setStatus(this.audio.readyState >= 3 ? 'PLAYING' : 'LOADING');
      try {
        await this.audio.play();
      } catch (err) {
        if (err.name !== 'AbortError' && !err.message?.includes('interrupted')) {
          console.error('[AudioEngine] Re-trigger play() failed:', err);
        }
      }
      return;
    }

    this.currentTrackId = track.id;

    // Reset progress to 0 and set loading status
    useAppStore.getState().setProgress(0);
    useAppStore.getState().setStatus('LOADING');

    // Pre-set duration from track metadata if available
    const initialDuration = Number(track.duration) || 0;
    useAppStore.getState().setDuration(initialDuration > 0 ? initialDuration : 0);

    // Clean up previous object URL if any
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    // 1. Check Offline Storage First
    let streamUrl = null;
    try {
      const audioBlob = await OfflineStorage.getTrackAudio(track.id);
      if (loadId !== this._loadSeq) return;
      if (audioBlob) {
        streamUrl = URL.createObjectURL(audioBlob);
        this.currentObjectUrl = streamUrl;
      }
    } catch (e) {
      console.error("[AudioEngine] Error checking offline storage:", e);
    }

    if (loadId !== this._loadSeq) return;

    // 2. Extract valid stream URL from all API formats
    let activeTrack = track;
    if (!streamUrl) {
      streamUrl = getAudioStreamUrl(activeTrack);
    }

    // 3. If stream URL is missing, automatically fetch full song details via API
    if (!streamUrl && track.id) {
      console.info(`[AudioEngine] Stream URL missing for "${track.name || track.title}" (ID: ${track.id}). Fetching full details...`);
      try {
        const res = await api.getSong(track.id);
        if (loadId !== this._loadSeq) return;
        const fullTrack = Array.isArray(res.data) ? res.data[0] : (res.data?.results?.[0] || res.results?.[0] || res.data);
        if (fullTrack) {
          activeTrack = { ...track, ...fullTrack };
          streamUrl = getAudioStreamUrl(activeTrack);
          console.info(`[AudioEngine] Retrieved full track details. Resolved stream URL:`, streamUrl);
        }
      } catch (err) {
        console.warn(`[AudioEngine] Failed to fetch full song details for ID ${track.id}:`, err);
      }
    }

    if (loadId !== this._loadSeq) return;

    if (!streamUrl) {
      console.error("[AudioEngine] No valid stream URL found for track:", track);
      this._handleFatalError(new Error('No valid stream URL found'));
      return;
    }
    
    console.info(`[AudioEngine] Setting stream URL for "${activeTrack.name || activeTrack.title}":`, streamUrl);
    this.audio.src = streamUrl;
    this.audio.load();
    
    try {
      await this.audio.play();
      if (loadId !== this._loadSeq) return;
      console.info(`[AudioEngine] Playback started successfully for "${activeTrack.name || activeTrack.title}"`);
    } catch (err) {
      if (loadId !== this._loadSeq || err.name === 'AbortError' || err.message?.includes('interrupted')) {
        console.warn('[AudioEngine] Playback interrupted by rapid skipping. Ignoring.');
        return;
      }
      console.error("[AudioEngine] Playback play() failed:", err);
      useAppStore.getState().setStatus('ERROR');
      this._handleFatalError(err);
    }

    // Sync OS Media Session Metadata
    syncMediaSession(activeTrack);
  }

  // --- External Actions ---
  togglePlayPause() {
    const { currentTrack, status } = useAppStore.getState().playbackState;
    if (!currentTrack) return;

    const hasSrc = Boolean(this.audio.getAttribute('src'));
    if (!hasSrc || this.currentTrackId !== currentTrack.id || status === 'ERROR') {
      this._loadAndPlay(currentTrack);
      return;
    }
    
    if (this.audio.paused || this.audio.ended) {
      useAppStore.getState().setStatus(this.audio.readyState >= 3 ? 'PLAYING' : 'LOADING');
      this.audio.play().catch(err => {
        if (err.name === 'AbortError' || err.message?.includes('interrupted')) return;
        console.error('[AudioEngine] togglePlayPause resume failed:', err);
        useAppStore.getState().setStatus('PAUSED');
      });
    } else {
      this.audio.pause();
    }
  }

  seekTo(seconds) {
    if (!this.audio.getAttribute('src') || !Number.isFinite(seconds)) return;
    const currentTrack = useAppStore.getState().playbackState.currentTrack;
    const maxDur = Number.isFinite(this.audio.duration) && this.audio.duration > 0
      ? this.audio.duration
      : (Number(currentTrack?.duration) || seconds);
    const clamped = Math.max(0, Math.min(maxDur, seconds));
    this.audio.currentTime = clamped;
    useAppStore.getState().setProgress(clamped);
  }

  // --- History Tracker Logic (30-Second Rule) ---
  _startHistoryTimer() {
    if (this.historyTimer) return;
    
    // Require 30 seconds of cumulative playing time
    this.historyTimer = setTimeout(() => {
      const currentTrack = useAppStore.getState().playbackState.currentTrack;
      if (currentTrack) {
        useAppStore.getState().addTrackToHistory(currentTrack);
        this.historyLogged = true;
        console.debug(`[AudioEngine] Logged "${currentTrack.name || currentTrack.title}" to persistent history.`);
      }
    }, 30000); 
  }

  _pauseHistoryTimer() {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
  }

  _clearHistoryTimer() {
    this._pauseHistoryTimer();
  }
}

// Export singleton instance.
export const AudioEngine = new AudioEngineSingleton();
