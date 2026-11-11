import { create } from 'zustand';
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';
import { StorageEngine } from '../services/StorageEngine.js';
import { api as musicApi } from '../utils/apiClient.js';

// Helper to shuffle an array using Fisher-Yates (Unbiased algorithm)
function shuffleArray(array) {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

// 1. Preferences Slice (Persisted)
const createPreferencesSlice = (set) => ({
  userPreferences: {
    languages: [], 
    theme: 'dark',
    streamingQuality: 'high',
  },
  setLanguages: (languages) => set((state) => ({
    userPreferences: { ...state.userPreferences, languages }
  })),
  setTheme: (theme) => set((state) => ({
    userPreferences: { ...state.userPreferences, theme }
  })),
  clearPreferences: () => set(() => ({
    userPreferences: { languages: [], theme: 'dark', streamingQuality: 'high' }
  }))
});

// 2. Playback Slice (Strict Finite State Machine)
let lastSkipTime = 0;

const createPlaybackSlice = (set, get) => ({
  playbackState: {
    status: 'IDLE', // 'IDLE' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'ERROR'
    currentTrack: null,
    queue: [],
    originalQueue: [], // Maintained for unshuffling
    history: [], // Tracks played in current session (for back navigation)
    repeatMode: 'OFF', // 'OFF' | 'ALL' | 'ONE'
    isShuffle: false,
    volume: 1,
    progress: 0, // In seconds
    duration: 0, // In seconds
    playRequestId: 0, // Incremented on explicit play/retrigger actions
    seekZeroSeq: 0, // Incremented when AudioEngine should rewind to 0:00
  },

  setStatus: (status) => set((state) => ({
    playbackState: { ...state.playbackState, status }
  })),
  
  setProgress: (progress) => set((state) => ({
    playbackState: { ...state.playbackState, progress }
  })),

  setDuration: (duration) => set((state) => ({
    playbackState: { ...state.playbackState, duration }
  })),

  setVolume: (volume) => set((state) => ({
    playbackState: { ...state.playbackState, volume: Math.max(0, Math.min(1, Number(volume) || 0)) }
  })),

  /**
   * Initializes playback of a specific track. 
   * If a new queue context is passed, it overrides the current originalQueue.
   */
  playTrack: (track, queueContext = []) => {
    if (!track) return;
    const prevState = get().playbackState;
    const originalQueue = queueContext.length > 0 ? queueContext : prevState.originalQueue;
    let newQueue = [...originalQueue];

    // Ensure clicked track exists in queue if originalQueue was empty
    if (newQueue.length === 0) {
      newQueue = [track];
    }

    // Apply shuffle logic if active
    if (prevState.isShuffle) {
       const trackIndex = newQueue.findIndex(t => t.id === track.id);
       const before = trackIndex !== -1 ? newQueue.slice(0, trackIndex) : [];
       const after = trackIndex !== -1 ? newQueue.slice(trackIndex + 1) : newQueue;
       // Push current track to front, shuffle the rest
       newQueue = [track, ...shuffleArray([...before, ...after])];
    }

    const updatedHistory = prevState.currentTrack && prevState.currentTrack.id !== track.id
      ? [...prevState.history, prevState.currentTrack].slice(-50)
      : prevState.history;

    set((state) => ({
      playbackState: { 
        ...state.playbackState, 
        currentTrack: track, 
        queue: newQueue,
        originalQueue: originalQueue.length > 0 ? originalQueue : newQueue,
        history: updatedHistory,
        status: 'LOADING',
        progress: 0,
        playRequestId: state.playbackState.playRequestId + 1,
      }
    }));
  },

  /**
   * Advances the playback state machine to the next logical track.
   */
  playNext: async () => {
    const now = Date.now();
    if (now - lastSkipTime < 150) return;
    lastSkipTime = now;

    const state = get().playbackState;
    const { currentTrack, queue, repeatMode, history } = state;

    if (!currentTrack) return;

    if (repeatMode === 'ONE') {
      // Re-trigger the same track (handled via seekZeroSeq & playRequestId in AudioEngine)
      set((s) => ({
        playbackState: {
          ...s.playbackState,
          progress: 0,
          status: 'LOADING',
          seekZeroSeq: s.playbackState.seekZeroSeq + 1,
          playRequestId: s.playbackState.playRequestId + 1,
        }
      }));
      return;
    }

    const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
    let nextTrack = null;

    if (currentIndex !== -1 && currentIndex < queue.length - 1) {
      nextTrack = queue[currentIndex + 1];
    } else if (currentIndex === -1 && queue.length > 0) {
      nextTrack = queue[0];
    } else if (repeatMode === 'ALL' && queue.length > 0) {
      nextTrack = queue[0];
    }

    if (nextTrack) {
      set((s) => ({
        playbackState: {
          ...s.playbackState,
          currentTrack: nextTrack,
          history: [...history, currentTrack].slice(-50),
          status: 'LOADING',
          progress: 0,
          playRequestId: s.playbackState.playRequestId + 1,
        }
      }));
      return;
    }

    // Reached end of queue with repeat OFF: auto-fetch JioSaavn recommendations
    if (currentTrack.id) {
      const originTrackId = currentTrack.id;
      set((s) => ({
        playbackState: { ...s.playbackState, status: 'LOADING' }
      }));

      try {
        const res = await musicApi.getSongSuggestions(originTrackId, 15);
        const suggestions = res.data?.results || res.results || (Array.isArray(res.data) ? res.data : []);
        const existingIds = new Set(get().playbackState.queue.map(t => t.id));
        const freshSuggestions = suggestions.filter(t => t && t.id && !existingIds.has(t.id));

        // Guard against user changing track while suggestions were fetching
        if (get().playbackState.currentTrack?.id === originTrackId && freshSuggestions.length > 0) {
          const recommendedNext = freshSuggestions[0];
          set((s) => ({
            playbackState: {
              ...s.playbackState,
              currentTrack: recommendedNext,
              queue: [...s.playbackState.queue, ...freshSuggestions],
              originalQueue: [...s.playbackState.originalQueue, ...freshSuggestions],
              history: [...s.playbackState.history, currentTrack].slice(-50),
              status: 'LOADING',
              progress: 0,
              playRequestId: s.playbackState.playRequestId + 1,
            }
          }));
          return;
        }
      } catch (err) {
        console.warn('[PlaybackSlice] Auto-suggestions fetch failed:', err?.message || err);
      }
    }

    // Fallback when no suggestions are available (e.g., offline)
    set((s) => ({
      playbackState: { ...s.playbackState, status: 'IDLE', progress: 0 }
    }));
  },

  /**
   * Rewinds the current track, or pops the history stack / steps backward in queue.
   */
  playPrevious: () => {
    const now = Date.now();
    if (now - lastSkipTime < 150) return;
    lastSkipTime = now;

    const state = get().playbackState;
    const { currentTrack, history, queue } = state;

    if (!currentTrack) return;

    // If > 3 seconds elapsed, acts as a rewind to 0:00
    if (state.progress > 3) {
      set((s) => ({
        playbackState: {
          ...s.playbackState,
          progress: 0,
          seekZeroSeq: s.playbackState.seekZeroSeq + 1,
        }
      }));
      return;
    }

    if (history.length > 0) {
      const newHistory = [...history];
      const prevTrack = newHistory.pop();
      set((s) => ({
        playbackState: {
          ...s.playbackState,
          currentTrack: prevTrack,
          history: newHistory,
          status: 'LOADING',
          progress: 0,
          playRequestId: s.playbackState.playRequestId + 1,
        }
      }));
      return;
    }

    const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
    if (currentIndex > 0) {
      const prevTrack = queue[currentIndex - 1];
      set((s) => ({
        playbackState: {
          ...s.playbackState,
          currentTrack: prevTrack,
          status: 'LOADING',
          progress: 0,
          playRequestId: s.playbackState.playRequestId + 1,
        }
      }));
      return;
    }

    // Restart current track at 0:00 when at beginning of queue with no history
    set((s) => ({
      playbackState: {
        ...s.playbackState,
        progress: 0,
        seekZeroSeq: s.playbackState.seekZeroSeq + 1,
      }
    }));
  },

  toggleShuffle: () => {
    const state = get().playbackState;
    const newIsShuffle = !state.isShuffle;
    
    let newQueue = [...state.originalQueue];
    
    if (newIsShuffle && state.currentTrack) {
       // Keep current track at index 0, shuffle the rest
       const trackIndex = newQueue.findIndex(t => t.id === state.currentTrack.id);
       const before = trackIndex !== -1 ? newQueue.slice(0, trackIndex) : [];
       const after = trackIndex !== -1 ? newQueue.slice(trackIndex + 1) : newQueue;
       newQueue = [state.currentTrack, ...shuffleArray([...before, ...after])];
    }

    set((state) => ({
      playbackState: { ...state.playbackState, isShuffle: newIsShuffle, queue: newQueue }
    }));
  },

  toggleRepeat: () => {
    const state = get().playbackState;
    const modes = ['OFF', 'ALL', 'ONE'];
    const nextMode = modes[(modes.indexOf(state.repeatMode) + 1) % modes.length];
    set((state) => ({
      playbackState: { ...state.playbackState, repeatMode: nextMode }
    }));
  },
});

// 3. History Slice (Persisted) - Acts as the data pipeline for Phase 4 AI Mixes
const createHistorySlice = (set) => ({
  recentHistory: [], // Max 50 tracks
  addTrackToHistory: (track) => set((state) => {
    // Deduplicate: remove if exists, then push to front
    const filteredHistory = state.recentHistory.filter(t => t.id !== track.id);
    const newHistory = [track, ...filteredHistory].slice(0, 50);
    return { recentHistory: newHistory };
  }),
});

// 4. Library Slice (Persisted)
const createLibrarySlice = (set) => ({
  library: { playlists: [], likedSongs: [] },
  savePlaylist: (playlist) => set((state) => ({
    library: { ...state.library, playlists: [playlist, ...state.library.playlists] }
  })),
  removePlaylist: (playlistId) => set((state) => ({
    library: { ...state.library, playlists: state.library.playlists.filter(p => p.id !== playlistId) }
  })),
  toggleLikeTrack: (track) => set((state) => {
    const isLiked = state.library.likedSongs.some(t => t.id === track.id);
    const newLiked = isLiked 
      ? state.library.likedSongs.filter(t => t.id !== track.id) 
      : [track, ...state.library.likedSongs];
    return { library: { ...state.library, likedSongs: newLiked } };
  }),
});

// 5. Offline Slice (Runtime & Persisted parts)
const createOfflineSlice = (set) => ({
  offlineMode: {
    isOfflineMode: false,
    downloadQueue: [],
    downloadedTracks: [] // Array of track IDs
  },
  toggleOfflineMode: () => set((state) => ({
    offlineMode: { ...state.offlineMode, isOfflineMode: !state.offlineMode.isOfflineMode }
  })),
  addDownloadQueue: (trackId) => set((state) => ({
    offlineMode: { ...state.offlineMode, downloadQueue: [...new Set([...state.offlineMode.downloadQueue, trackId])] }
  })),
  removeDownloadQueue: (trackId) => set((state) => ({
    offlineMode: { ...state.offlineMode, downloadQueue: state.offlineMode.downloadQueue.filter(id => id !== trackId) }
  })),
  addDownloadedTrack: (track) => set((state) => ({
    offlineMode: { ...state.offlineMode, downloadedTracks: [...new Set([...state.offlineMode.downloadedTracks, track.id])] }
  })),
  setDownloadedTracks: (trackIds) => set((state) => ({
    offlineMode: { ...state.offlineMode, downloadedTracks: trackIds }
  }))
});

// 6. UI Slice (Transient modals & overlays)
const createUISlice = (set) => ({
  ui: { activeModal: null }, // null | 'profile'
  openModal: (modal) => set(() => ({ ui: { activeModal: modal } })),
  closeModal: () => set(() => ({ ui: { activeModal: null } })),
});

// Combine slices into the main store
export const useAppStore = create(
  subscribeWithSelector(
    persist(
      (set, get, api) => ({
        ...createPreferencesSlice(set, get, api),
        ...createPlaybackSlice(set, get, api),
        ...createHistorySlice(set, get, api),
        ...createLibrarySlice(set, get, api),
        ...createOfflineSlice(set, get, api),
        ...createUISlice(set, get, api),
      }),
      {
        name: 'hear-app-storage',
        // Explicitly persist user preferences, recent history, and library
        partialize: (state) => ({ 
          userPreferences: state.userPreferences,
          recentHistory: state.recentHistory,
          library: state.library,
          offlineMode: {
            isOfflineMode: state.offlineMode.isOfflineMode,
            downloadedTracks: state.offlineMode.downloadedTracks,
            downloadQueue: [] // don't persist queue
          }
        }),
        storage: createJSONStorage(() => StorageEngine),
      }
    )
  )
);
