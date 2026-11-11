import { useEffect, useState } from 'react';
import { api } from '../utils/apiClient';
import TrackCardSkeleton from './skeletons/TrackCardSkeleton';
import { useAppStore } from '../store/useAppStore';
import TrackCard from './TrackCard';

export default function AIPlaylistRow({ categoryData }) {
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    
    const fetchAITracks = async () => {
      setIsLoading(true);

      const promises = categoryData.queries.map(async (query) => {
        try {
          const res = await api.searchSongs(query, 1, 1, { 
            signal: controller.signal
          });
          const results = res.data?.results || res.results || res.data?.data || (Array.isArray(res.data) ? res.data : []);
          if (results.length > 0) {
             return results[0]; // Safely grab top match
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
             console.warn(`[AIPlaylistRow] Failed to resolve query: ${query}`);
          }
        }
        return null;
      });

      const results = await Promise.all(promises);
      setTracks(results.filter(t => t !== null));
      setIsLoading(false);
    };

    if (categoryData?.queries?.length > 0) {
      fetchAITracks();
    } else {
      setIsLoading(false);
    }

    return () => controller.abort();
  }, [categoryData]);

  const handlePlayContext = (track) => {
    useAppStore.getState().playTrack(track, tracks);
  };

  // If AI generated a playlist but all tracks failed to resolve, silently hide it.
  if (!isLoading && tracks.length === 0) return null;

  return (
    <section className="mb-8 md:mb-10 w-full">
      <div className="mb-4 md:mb-6 flex items-center justify-between gap-2">
        <div className="min-w-0">
           <h2
             onClick={() => tracks.length > 0 && handlePlayContext(tracks[0])}
             className="text-xl md:text-2xl font-bold hover:underline cursor-pointer flex items-center gap-2 truncate"
           >
             <span className="text-primary text-lg md:text-xl flex-shrink-0">✦</span> <span className="truncate">{categoryData.category || categoryData.title}</span>
           </h2>
           <p className="text-grayText text-xs md:text-sm mt-0.5 md:mt-1 truncate">{categoryData.subtitle || categoryData.vibe}</p>
        </div>
        {!isLoading && tracks.length > 0 && (
          <button
            type="button"
            onClick={() => handlePlayContext(tracks[0])}
            className="text-xs font-bold text-grayText hover:text-white uppercase tracking-wider cursor-pointer transition-colors flex-shrink-0"
          >
            Play All
          </button>
        )}
      </div>

      <div className="flex overflow-x-auto custom-scrollbar gap-3.5 md:gap-6 pb-3 md:pb-4 -mx-4 px-4 md:-mx-2 md:px-2 snap-x">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <TrackCardSkeleton
              key={i}
              className="min-w-[144px] max-w-[156px] sm:min-w-[160px] sm:max-w-[180px] flex-shrink-0"
            />
          ))
        ) : (
          tracks.map((track) => (
            <TrackCard 
              key={track.id} 
              track={track} 
              onPlay={() => handlePlayContext(track)}
              className="min-w-[144px] max-w-[156px] sm:min-w-[160px] sm:max-w-[180px] flex-shrink-0 snap-start flex flex-col bg-[#1a1a1a] hover:bg-[#2a2a2a] border-[#333]"
            />
          ))
        )}
      </div>
    </section>
  );
}
