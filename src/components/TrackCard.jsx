import React, { memo } from 'react';
import { Play, Pause, Heart, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { AudioEngine } from '../services/AudioEngine';

const TrackCard = memo(({ track, onPlay, className = '' }) => {
  const isCurrent = useAppStore(state => state.playbackState.currentTrack?.id === track.id);
  const currentStatus = useAppStore(state =>
    state.playbackState.currentTrack?.id === track.id ? state.playbackState.status : null
  );
  const isLiked = useAppStore(state => state.library.likedSongs.some(t => t.id === track.id));

  const isPlaying = isCurrent && currentStatus === 'PLAYING';
  const isLoading = isCurrent && currentStatus === 'LOADING';

  const formatImage = (t) => {
    return t.album?.cover_xl || 
           t.album?.cover_medium || 
           t.album?.cover || 
           (Array.isArray(t.image) ? (t.image[2]?.url || t.image[2]?.link || t.image[0]?.url || t.image[0]?.link) : (typeof t.image === 'string' ? t.image : '')) || 
           'https://via.placeholder.com/500';
  };

  const title = track.title || track.name || 'Unknown Track';
  const artistName = track.artist?.name || track.primaryArtists || track.artists || 'Unknown Artist';

  const handleCardAction = (e) => {
    e?.stopPropagation?.();
    if (isCurrent) {
      AudioEngine.togglePlayPause();
    } else {
      onPlay?.();
    }
  };

  const handleToggleLike = (e) => {
    e.stopPropagation();
    useAppStore.getState().toggleLikeTrack(track);
  };

  return (
    <div 
      className={`bg-[#181818] p-3 md:p-4 rounded-md hover:bg-[#282828] transition-colors cursor-pointer group border ${
        isCurrent ? 'border-primary/40 bg-[#222]' : 'border-transparent hover:border-[#333]'
      } ${className}`}
      onClick={handleCardAction}
    >
      <div className="w-full aspect-square bg-[#333] rounded-md mb-3 md:mb-4 shadow-lg group-hover:shadow-xl relative overflow-hidden flex-shrink-0">
        <img src={formatImage(track)} alt={title} className="w-full h-full object-cover" loading="lazy" />

        {/* Quick Like Button */}
        <button
          type="button"
          aria-label={isLiked ? 'Unlike track' : 'Like track'}
          onClick={handleToggleLike}
          className={`absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-all cursor-pointer ${
            isLiked ? 'opacity-100' : 'opacity-80 md:opacity-0 md:group-hover:opacity-100'
          }`}
        >
          <Heart size={15} className={isLiked ? 'fill-primary text-primary' : 'text-white'} />
        </button>

        {/* Play / Pause Floating Button */}
        <button
          type="button"
          aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
          onClick={handleCardAction}
          className={`absolute bottom-2 right-2 w-10 h-10 md:w-12 md:h-12 bg-primary rounded-full flex items-center justify-center transition-all duration-300 shadow-xl cursor-pointer hover:scale-105 ${
            isCurrent
              ? 'opacity-100 translate-y-0'
              : 'opacity-90 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0'
          }`}
        >
          {isLoading ? (
            <Loader2 size={20} className="animate-spin text-black" />
          ) : isPlaying ? (
            <Pause size={20} className="fill-black text-black" />
          ) : (
            <Play size={20} className="fill-black text-black ml-0.5" />
          )}
        </button>
      </div>
      <h3 className={`font-bold text-xs sm:text-sm truncate mb-0.5 md:mb-1 ${isCurrent ? 'text-primary' : 'text-white'}`}>{title}</h3>
      <p className="text-[11px] sm:text-xs text-grayText truncate line-clamp-2">{artistName}</p>
    </div>
  );
});

TrackCard.displayName = 'TrackCard';
export default TrackCard;
