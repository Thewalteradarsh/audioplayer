import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AudioEngine } from '../services/AudioEngine';
import FullScreenPlayer from './player/FullScreenPlayer';
import { Play, Pause, SkipBack, SkipForward, Heart, Loader2, Shuffle, Repeat, Repeat1, Volume2, VolumeX } from 'lucide-react';

export default function MiniPlayer() {
  const { currentTrack, status, progress, duration, volume, isShuffle, repeatMode } =
    useAppStore(state => state.playbackState);
  const likedSongs = useAppStore(state => state.library.likedSongs);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);
  
  if (!currentTrack) return null;

  const isPlaying = status === 'PLAYING';
  const isLoading = status === 'LOADING';
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;
  const isLiked = likedSongs.some(t => t.id === currentTrack.id);

  const formatImage = (track) => {
    return track.album?.cover_xl || 
           track.album?.cover_medium || 
           track.album?.cover || 
           (Array.isArray(track.image) ? (track.image[2]?.url || track.image[2]?.link || track.image[0]?.url || track.image[0]?.link) : (typeof track.image === 'string' ? track.image : '')) || 
           'https://via.placeholder.com/150';
  };

  const title = currentTrack.title || currentTrack.name || 'Unknown Track';
  const artist = currentTrack.artist?.name || currentTrack.primaryArtists || currentTrack.artists || 'Unknown Artist';

  const toggleLike = (e) => {
    e.stopPropagation(); // prevent opening full screen
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

  return (
    <>
      <div 
        onClick={() => setIsFullscreen(true)}
        className="fixed bottom-[calc(4.35rem+env(safe-area-inset-bottom))] md:bottom-0 left-2 right-2 md:left-64 md:right-0 h-16 md:h-[72px] bg-[#1e1e1e]/95 md:bg-[#181818] backdrop-blur-lg md:backdrop-blur-none rounded-xl md:rounded-none border border-white/10 md:border-0 md:border-t md:border-[#282828] flex items-center px-3 md:px-4 z-[60] shadow-[0_8px_24px_rgba(0,0,0,0.65)] md:shadow-[0_-10px_20px_rgba(0,0,0,0.5)] cursor-pointer hover:bg-[#242424] transition-colors overflow-hidden"
      >
        {/* Progress Bar */}
        <div
          className="absolute top-0 left-0 right-0 h-2 md:top-[-3px] cursor-pointer group z-10"
          onClick={(e) => { 
            e.stopPropagation();
            if (!duration || duration <= 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            AudioEngine.seekTo(percent * duration); 
          }}
        >
          <div className="w-full h-[3px] md:h-1 bg-white/15 md:bg-[#282828] md:mt-[2px]">
            <div className="h-full bg-primary transition-all duration-100" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="flex items-center w-full gap-2.5 md:gap-4">
          {/* Track Info & Like */}
          <div className="flex items-center gap-2.5 md:gap-3 flex-1 min-w-0">
            <img src={formatImage(currentTrack)} alt="Artwork" className="w-11 h-11 md:w-12 md:h-12 rounded-lg md:rounded-md object-cover shadow-md flex-shrink-0" />
            <div className="min-w-0 flex-1 pr-1">
              <h4 className="text-white text-xs sm:text-sm font-bold truncate">{title}</h4>
              <p className="text-grayText text-[11px] sm:text-xs truncate">{artist}</p>
            </div>
            <button
              type="button"
              aria-label={isLiked ? 'Unlike track' : 'Like track'}
              onClick={toggleLike}
              className="p-1.5 md:p-2 md:ml-1 cursor-pointer flex-shrink-0"
            >
              <Heart size={18} className={isLiked ? "fill-primary text-primary" : "text-grayText hover:text-white"} />
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-5 justify-center flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Toggle shuffle"
              onClick={() => useAppStore.getState().toggleShuffle()}
              className={`hidden md:block transition-colors cursor-pointer ${isShuffle ? 'text-primary' : 'text-grayText hover:text-white'}`}
              title={isShuffle ? 'Shuffle On' : 'Shuffle Off'}
            >
              <Shuffle size={17} />
            </button>

            <button
              type="button"
              aria-label="Previous track"
              onClick={() => useAppStore.getState().playPrevious()}
              className="text-grayText hover:text-white transition-colors cursor-pointer p-1"
            >
              <SkipBack size={18} className="fill-current md:w-5 md:h-5" />
            </button>
            
            <button
              type="button"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={() => AudioEngine.togglePlayPause()}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-transform shadow-[0_0_10px_rgba(255,255,255,0.2)] cursor-pointer"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin text-black" />
              ) : isPlaying ? (
                <Pause size={18} className="fill-current" />
              ) : (
                <Play size={18} className="fill-current ml-0.5" />
              )}
            </button>
            
            <button
              type="button"
              aria-label="Next track"
              onClick={() => useAppStore.getState().playNext()}
              className="text-grayText hover:text-white transition-colors cursor-pointer p-1"
            >
              <SkipForward size={18} className="fill-current md:w-5 md:h-5" />
            </button>

            <button
              type="button"
              aria-label="Cycle repeat mode"
              onClick={() => useAppStore.getState().toggleRepeat()}
              className={`hidden md:block transition-colors cursor-pointer ${repeatMode !== 'OFF' ? 'text-primary' : 'text-grayText hover:text-white'}`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'ONE' ? <Repeat1 size={17} /> : <Repeat size={17} />}
            </button>
          </div>
          
          {/* Desktop Volume Control */}
          <div className="hidden md:flex flex-1 justify-end items-center gap-2 pr-2" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              aria-label={volume === 0 ? 'Unmute' : 'Mute'}
              onClick={handleToggleMute}
              className="text-grayText hover:text-white transition-colors cursor-pointer p-1"
            >
              {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              aria-label="Volume"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => useAppStore.getState().setVolume(parseFloat(e.target.value))}
              className="w-24 h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>
      </div>

      <FullScreenPlayer isOpen={isFullscreen} onClose={() => setIsFullscreen(false)} />
    </>
  );
}
