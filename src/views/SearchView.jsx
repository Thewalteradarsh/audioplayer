import { useState, useEffect } from 'react';
import { api } from '../utils/apiClient';
import useDebounce from '../hooks/useDebounce';
import { useAppStore } from '../store/useAppStore';
import TrackCardSkeleton from '../components/skeletons/TrackCardSkeleton';
import TrackCard from '../components/TrackCard';
import { Search, X } from 'lucide-react';

const QUICK_TAGS = [
  'Trending Hindi',
  'Arijit Singh',
  'Global Pop',
  'Malayalam Hits',
  'Tamil Romance',
  'Punjabi Hits',
  'Classic Melodies',
];

export default function SearchView() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    
    const fetchSearch = async () => {
      setIsLoading(true);
      try {
        // JioSaavn /api/search/songs?query={q}&page=1&limit=30
        const res = await api.searchSongs(debouncedQuery, 1, 30, {
          signal: controller.signal
        });
        
        let rawTracks = res.data?.results || res.results || res.data?.data || (Array.isArray(res.data) ? res.data : []);
        
        if (rawTracks.length === 0) {
          const globalRes = await api.searchGlobal(debouncedQuery, { signal: controller.signal });
          rawTracks = globalRes.data?.songs || globalRes.results || [];
        }

        // Negative Filter for absolute quality control
        const negativePattern = /karaoke|cover|sped up|tribute|lofi|zzang|originally performed/i;
        rawTracks = rawTracks.filter(r => {
           const text = `${r.title} ${r.artist?.name || r.primaryArtists || ''}`.toLowerCase();
           return !negativePattern.test(text);
        });

        setResults(rawTracks);
      } catch (err) {
        if (err.name !== 'AbortError') console.error("Search failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSearch();
    // Re-typing before 300ms completes instantly aborts the stale API request.
    return () => controller.abort();
  }, [debouncedQuery]);

  const handlePlay = (track) => {
    useAppStore.getState().playTrack(track, results);
  };

  return (
    <div className="pt-4 md:pt-6 px-4 md:px-8 max-w-[1600px] mx-auto">
       <div className="sticky top-0 z-10 bg-[#121212]/95 backdrop-blur-md pb-3 md:pb-4 pt-1 md:pt-2">
         <div className="relative">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-grayText" size={18} />
           <input 
             type="text"
             placeholder="What do you want to listen to?"
             value={query}
             onChange={(e) => setQuery(e.target.value)}
             className="w-full bg-[#1a1a1a] text-white placeholder-grayText border border-[#333] rounded-full py-2.5 md:py-3 pl-11 pr-10 focus:outline-none focus:border-primary transition-colors text-base md:text-lg"
           />
           {query && (
             <button
               type="button"
               onClick={() => setQuery('')}
               aria-label="Clear search"
               className="absolute right-3.5 top-1/2 -translate-y-1/2 text-grayText hover:text-white cursor-pointer p-1"
             >
               <X size={18} />
             </button>
           )}
         </div>
       </div>

       <div className="mt-4 md:mt-6">
         {!debouncedQuery.trim() && !isLoading && (
           <div>
             <h2 className="text-sm font-bold uppercase tracking-wider text-grayText mb-3">Quick Searches</h2>
             <div className="flex flex-wrap gap-2">
               {QUICK_TAGS.map((tag) => (
                 <button
                   key={tag}
                   type="button"
                   onClick={() => setQuery(tag)}
                   className="px-4 py-2 rounded-full bg-[#1c1c1c] hover:bg-[#282828] border border-white/10 text-sm font-medium text-white cursor-pointer transition-colors"
                 >
                   {tag}
                 </button>
               ))}
             </div>
           </div>
         )}

         {isLoading && (
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
             {[...Array(12)].map((_, i) => <TrackCardSkeleton key={i} />)}
           </div>
         )}

         {!isLoading && results.length > 0 && (
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
             {results.map((track) => (
               <TrackCard 
                 key={track.id} 
                 track={track} 
                 onPlay={() => handlePlay(track)} 
                 className="flex flex-col"
               />
             ))}
           </div>
         )}
         
         {!isLoading && debouncedQuery && results.length === 0 && (
           <div className="text-center mt-16 md:mt-20 text-grayText px-4">
             <p className="text-lg md:text-xl font-bold text-white mb-2">No results found for "{debouncedQuery}"</p>
             <p className="text-sm">Please make sure your words are spelled correctly or use fewer keywords.</p>
           </div>
         )}
       </div>
    </div>
  );
}
