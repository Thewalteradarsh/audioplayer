import { useEffect, useState } from 'react';
import { api } from '../utils/apiClient';
import TrackCardSkeleton from './skeletons/TrackCardSkeleton';
import { useAppStore } from '../store/useAppStore';
import TrackCard from './TrackCard';

export default function PlaylistRow({ categoryData }) {
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTracks = async (signal) => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch songs using /api/search/songs?query=<category_or_language>&page=1&limit=20
      let results = [];
      try {
        const res = await api.searchSongs(categoryData.apiQuery, 1, 20, { signal });
        results = res.data?.results || res.results || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        console.warn(`[PlaylistRow] search/songs for "${categoryData.apiQuery}" failed:`, e);
      }

      // 2. If results empty, fallback to /api/search/playlists?query=<category>&page=1&limit=20
      if (!results || results.length === 0) {
        try {
          const plRes = await api.searchPlaylists(categoryData.apiQuery, 1, 5, { signal });
          const playlists = plRes.data?.results || plRes.results || [];
          if (playlists.length > 0 && playlists[0].id) {
            const plDetail = await api.getPlaylist(playlists[0].id, { signal });
            results = plDetail.data?.songs || plDetail.results || plDetail.songs || [];
          }
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          console.warn(`[PlaylistRow] Playlist fallback failed:`, e);
        }
      }

      // 3. Language fallback if still empty
      if (!results || results.length === 0) {
        const fallbackQuery = categoryData.language ? `${categoryData.language} songs` : 'trending songs';
        const resFallback = await api.searchSongs(fallbackQuery, 1, 20, { signal });
        results = resFallback.data?.results || resFallback.results || [];
      }

      if (!results || results.length === 0) {
        throw new Error("No tracks found");
      }
      
      setTracks(results);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchTracks(controller.signal);
    return () => controller.abort();
  }, [categoryData.apiQuery]);

  const handlePlayContext = (track) => {
    useAppStore.getState().playTrack(track, tracks);
  };

  // Inline Error Recovery UI
  if (error) {
    return (
      <section className="mb-10 w-full">
        <h2 className="text-2xl font-bold mb-6">{categoryData.category}</h2>
        <div className="bg-[#181818] p-6 rounded-md flex flex-col items-center justify-center border border-red-500/20 shadow-md">
          <p className="text-grayText mb-4 text-center">Unable to load "{categoryData.category}" tracks.</p>
          <button 
            onClick={() => fetchTracks()} 
            className="px-6 py-2 rounded-full border border-grayText text-grayText hover:border-white hover:text-white transition-colors text-sm font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8 md:mb-10 w-full overflow-hidden">
      <div className="mb-4 md:mb-6 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h2
            onClick={() => tracks.length > 0 && handlePlayContext(tracks[0])}
            className="text-xl md:text-2xl font-bold hover:underline cursor-pointer truncate"
          >
            {categoryData.category}
          </h2>
          <p className="text-grayText text-xs md:text-sm mt-0.5 md:mt-1 truncate">{categoryData.subtitle}</p>
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
          /* Zero-Shift Skeletons */
          [...Array(6)].map((_, i) => <TrackCardSkeleton key={i} />)
        ) : (
          tracks.map((track) => (
            <TrackCard 
              key={track.id} 
              track={track} 
              onPlay={() => handlePlayContext(track)}
              className="min-w-[144px] max-w-[156px] sm:min-w-[160px] sm:max-w-[180px] flex-shrink-0 snap-start flex flex-col"
            />
          ))
        )}
      </div>
    </section>
  );
}
