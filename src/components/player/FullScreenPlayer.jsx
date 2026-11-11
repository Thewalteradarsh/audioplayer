import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AudioEngine } from '../../services/AudioEngine';
import { DownloadManager } from '../../services/DownloadManager';
import useSwipe from '../../hooks/useSwipe';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  Heart,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  Volume1,
  VolumeX,
  ListMusic,
  Download,
  CheckCircle2,
  Loader2,
  X
} from 'lucide-react';

export default function FullScreenPlayer({ isOpen, onClose }) {
  const { currentTrack, status, progress, duration, queue, repeatMode, isShuffle, volume } =
    useAppStore(state => state.playbackState);
  const likedSongs = useAppStore(state => state.library.likedSongs);
  const { downloadedTracks, downloadQueue } = useAppStore(state => state.offlineMode);

  const [showQueue, setShowQueue] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);
  const isDraggingRef = useRef(false);
  const seekBarRef = useRef(null);

  // Hardware-Accelerated Gesture Bindings
  const handleClose = () => {
    setShowQueue(false);
    onClose();
  };

  const swipeHandlers = useSwipe({
    onSwipeDown: () => {
      if (showQueue) {
        setShowQueue(false);
      } else {
        handleClose();
      }
    },
    onSwipeLeft: () => {
      if (!showQueue) useAppStore.getState().playNext();
    },
    onSwipeRight: () => {
      if (!showQueue) useAppStore.getState().playPrevious();
    },
    threshold: 50
  });

  // Allow Escape key to close queue drawer or full screen player
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showQueue) {
          setShowQueue(false);
        } else {
          setShowQueue(false);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showQueue, onClose]);

  if (!currentTrack) return null;

  const isPlaying = status === 'PLAYING';
  const isLoading = status === 'LOADING';
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;
  const isLiked = likedSongs.some(t => t.id === currentTrack.id);
  const isDownloaded = downloadedTracks.includes(currentTrack.id);
  const isDownloading = downloadQueue.includes(currentTrack.id);

  const formatImage = (track) => {
    return track.album?.cover_xl || 
           track.album?.cover_medium || 
           track.album?.cover || 
           (Array.isArray(track.image) ? (track.image[2]?.url || track.image[2]?.link || track.image[0]?.url || track.image[0]?.link) : (typeof track.image === 'string' ? track.image : '')) || 
           'https://via.placeholder.com/500';
  };

  const imageUrl = formatImage(currentTrack);
  const title = currentTrack.title || currentTrack.name || 'Unknown Track';
  const artist = currentTrack.artist?.name || currentTrack.primaryArtists || currentTrack.artists || 'Unknown Artist';

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const seekFromClientX = (clientX) => {
    if (!seekBarRef.current || !duration || duration <= 0) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    AudioEngine.seekTo(percent * duration);
  };

  const handleSeekPointerDown = (e) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    seekFromClientX(e.clientX);
  };

  const handleSeekPointerMove = (e) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    seekFromClientX(e.clientX);
  };

  const handleSeekPointerUp = (e) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const toggleLike = (e) => {
    e.stopPropagation();
    useAppStore.getState().toggleLikeTrack(currentTrack);
  };

  const handleToggleMute = (e) => {
    e.stopPropagation();
    if (volume > 0) {
      setPrevVolume(volume);
      useAppStore.getState().setVolume(0);
    } else {
      useAppStore.getState().setVolume(prevVolume > 0 ? prevVolume : 1);
    }
  };

  const handleDownloadTrack = (e) => {
    e.stopPropagation();
    if (!isDownloaded && !isDownloading) {
      DownloadManager.downloadTrack(currentTrack);
    }
  };

  const stopTouch = (e) => e.stopPropagation();

  return (
    <div 
      className={`fixed inset-0 z-[100] bg-black transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}
    >
      {/* Background Blur */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30 blur-3xl scale-110"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/80 to-black pointer-events-none" />

      {/* Touch Target Container */}
      <div className="relative z-10 flex flex-col h-full max-w-2xl mx-auto px-5 sm:px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] md:py-8" {...swipeHandlers}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <button
            type="button"
            aria-label="Minimize player"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="p-2.5 text-white/80 hover:text-white transition-colors cursor-pointer rounded-full bg-black/30 hover:bg-black/50"
          >
            <ChevronDown size={28} />
          </button>
          <span className="text-xs uppercase font-bold tracking-widest text-white/70 text-center">
            {showQueue ? 'Playing Queue' : 'Now Playing'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Download track for offline listening"
              onClick={handleDownloadTrack}
              disabled={isDownloaded || isDownloading}
              className="p-2.5 text-white/80 hover:text-white transition-colors cursor-pointer rounded-full bg-black/30 hover:bg-black/50 disabled:cursor-default"
              title={isDownloaded ? 'Downloaded offline' : isDownloading ? 'Downloading...' : 'Download offline'}
            >
              {isDownloading ? (
                <Loader2 size={22} className="animate-spin text-primary" />
              ) : isDownloaded ? (
                <CheckCircle2 size={22} className="text-primary" />
              ) : (
                <Download size={22} />
              )}
            </button>
            <button
              type="button"
              aria-label="Toggle queue"
              onClick={(e) => {
                e.stopPropagation();
                setShowQueue(prev => !prev);
              }}
              className={`p-2.5 transition-colors cursor-pointer rounded-full bg-black/30 hover:bg-black/50 ${showQueue ? 'text-primary' : 'text-white/80 hover:text-white'}`}
              title="Up Next Queue"
            >
              <ListMusic size={22} />
            </button>
          </div>
        </div>

        {/* Center Area: Artwork OR Queue Drawer */}
        {showQueue ? (
          <div
            className="flex-1 overflow-y-auto custom-scrollbar mb-6 bg-black/40 border border-white/10 rounded-xl p-4"
            onTouchStart={stopTouch}
            onTouchMove={stopTouch}
            onTouchEnd={stopTouch}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/70">
                Up Next ({queue.length} tracks)
              </h3>
              <button
                type="button"
                onClick={() => setShowQueue(false)}
                className="p-1 text-white/60 hover:text-white cursor-pointer"
                aria-label="Close queue"
              >
                <X size={18} />
              </button>
            </div>
            {queue.length === 0 ? (
              <p className="text-white/50 text-sm py-8 text-center">No upcoming tracks in queue.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {queue.map((track, idx) => {
                  const active = track.id === currentTrack.id;
                  const itemTitle = track.title || track.name || 'Unknown Track';
                  const itemArtist = track.artist?.name || track.primaryArtists || track.artists || 'Unknown Artist';
                  return (
                    <button
                      key={`${track.id}_${idx}`}
                      type="button"
                      onClick={() => useAppStore.getState().playTrack(track, queue)}
                      className={`flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                        active ? 'bg-white/15 border border-primary/40' : 'hover:bg-white/10'
                      }`}
                    >
                      <img
                        src={formatImage(track)}
                        alt={itemTitle}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate ${active ? 'text-primary' : 'text-white'}`}>
                          {itemTitle}
                        </p>
                        <p className="text-xs text-white/60 truncate">{itemArtist}</p>
                      </div>
                      {active && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          Playing
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center mb-4 sm:mb-6 min-h-0">
            <img 
              src={imageUrl} 
              alt="Album Art" 
              className="w-full max-w-[260px] sm:max-w-[320px] md:max-w-[360px] max-h-[40dvh] aspect-square object-cover rounded-xl shadow-[0_30px_60px_rgba(0,0,0,0.6)]" 
            />
          </div>
        )}

        {/* Metadata & Liked Toggle */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="min-w-0 pr-4">
            <h2 className="text-xl md:text-2xl font-bold text-white truncate mb-1">{title}</h2>
            <p className="text-base md:text-lg text-white/70 truncate">{artist}</p>
          </div>
          <button
            type="button"
            aria-label={isLiked ? 'Unlike track' : 'Like track'}
            onClick={toggleLike}
            className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
          >
            <Heart size={28} className={isLiked ? "fill-primary text-primary" : "text-white/70"} />
          </button>
        </div>

        {/* Seek Bar */}
        <div
          className="mb-6"
          onTouchStart={stopTouch}
          onTouchMove={stopTouch}
          onTouchEnd={stopTouch}
        >
          <div
            ref={seekBarRef}
            role="slider"
            aria-label="Seek track position"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration || 0)}
            aria-valuenow={Math.round(progress || 0)}
            tabIndex={0}
            className="py-3 -my-3 cursor-pointer group select-none touch-none"
            onPointerDown={handleSeekPointerDown}
            onPointerMove={handleSeekPointerMove}
            onPointerUp={handleSeekPointerUp}
          >
            <div className="h-1.5 bg-white/20 rounded-full relative overflow-visible">
              <div 
                className="h-full bg-white group-hover:bg-primary transition-colors rounded-full relative"
                style={{ width: `${progressPercent}%` }}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-white shadow-md absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
          <div className="flex justify-between text-xs text-white/50 mt-2 font-medium tracking-wide">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-between md:justify-center md:gap-8 mb-4">
          <button
            type="button"
            aria-label="Toggle shuffle"
            onClick={(e) => {
              e.stopPropagation();
              useAppStore.getState().toggleShuffle();
            }}
            className={`p-2 transition-colors cursor-pointer ${isShuffle ? 'text-primary' : 'text-white/60 hover:text-white'}`}
            title={isShuffle ? 'Shuffle On' : 'Shuffle Off'}
          >
            <Shuffle size={22} />
          </button>

          <button
            type="button"
            aria-label="Previous track"
            onClick={(e) => {
              e.stopPropagation();
              useAppStore.getState().playPrevious();
            }}
            className="text-white/85 hover:text-white active:scale-95 transition-all p-2 cursor-pointer"
          >
            <SkipBack size={34} className="fill-current" />
          </button>
          
          <button 
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={(e) => {
              e.stopPropagation();
              AudioEngine.togglePlayPause();
            }}
            className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)] cursor-pointer"
          >
            {isLoading ? (
              <Loader2 size={34} className="animate-spin text-black" />
            ) : isPlaying ? (
              <Pause size={36} className="fill-current" />
            ) : (
              <Play size={36} className="fill-current ml-1.5" />
            )}
          </button>
          
          <button
            type="button"
            aria-label="Next track"
            onClick={(e) => {
              e.stopPropagation();
              useAppStore.getState().playNext();
            }}
            className="text-white/85 hover:text-white active:scale-95 transition-all p-2 cursor-pointer"
          >
            <SkipForward size={34} className="fill-current" />
          </button>

          <button
            type="button"
            aria-label="Cycle repeat mode"
            onClick={(e) => {
              e.stopPropagation();
              useAppStore.getState().toggleRepeat();
            }}
            className={`p-2 transition-colors cursor-pointer relative ${repeatMode !== 'OFF' ? 'text-primary' : 'text-white/60 hover:text-white'}`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'ONE' ? <Repeat1 size={22} /> : <Repeat size={22} />}
            {repeatMode !== 'OFF' && (
              <span className="w-1 h-1 rounded-full bg-primary absolute bottom-0.5 left-1/2 -translate-x-1/2" />
            )}
          </button>
        </div>

        {/* Volume Control */}
        <div
          className="flex items-center justify-center gap-3 pb-4 md:pb-6 max-w-xs mx-auto w-full"
          onTouchStart={stopTouch}
          onTouchMove={stopTouch}
          onTouchEnd={stopTouch}
        >
          <button
            type="button"
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
            onClick={handleToggleMute}
            className="text-white/60 hover:text-white transition-colors cursor-pointer p-1"
          >
            {volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            aria-label="Volume"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => useAppStore.getState().setVolume(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>
    </div>
  );
}
