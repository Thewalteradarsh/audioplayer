import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../utils/apiClient';
import { getAudioStreamUrl } from '../../utils/audioHelper';
import PlaylistCover from './PlaylistCover';
import { Download, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function PlaylistImporter({ isOpen, onClose }) {
  const [playlistName, setPlaylistName] = useState('Imported Mix');
  const [inputText, setInputText] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, failed: 0 });
  const [importedPlaylist, setImportedPlaylist] = useState(null);

  const handleClose = () => {
    if (isImporting) return;
    setImportedPlaylist(null);
    setInputText('');
    setPlaylistUrl('');
    setPlaylistName('Imported Mix');
    setErrorMsg('');
    onClose();
  };

  const handleUrlFetch = async (url) => {
    if (!/(open\.spotify\.com\/(playlist|s|album)\/|spotify\.link\/|spoti\.fi\/|jiosaavn\.com\/)/i.test(url)) return;
    
    setIsFetchingUrl(true);
    setErrorMsg('');
    try {
      let tracksString = '';

      if (/(open\.spotify\.com\/(playlist|s|album)\/|spotify\.link\/|spoti\.fi\/)/i.test(url)) {
        const apiUrl = `/api/fetchPlaylist?format=json&playlistUrl=${encodeURIComponent(url)}`;
        const response = await fetch(apiUrl, {
          headers: { 'X-App-Client': 'HearApp' }
        });
        if (!response.ok) throw new Error(`Spotify fetch failed: ${response.status}`);
        const data = await response.json();
        if (data.name) setPlaylistName(data.name);
        if (Array.isArray(data.tracks)) {
          tracksString = data.tracks.map(t => `${t.title} - ${t.artists}`).join('\n');
        } else if (typeof data.tracks === 'string') {
          tracksString = data.tracks;
        }
      } else if (url.includes('jiosaavn.com/')) {
        const res = await api.get('playlists', { params: { link: url } });
        const playlistData = res?.data || res;
        if (playlistData?.title || playlistData?.name) {
          setPlaylistName(playlistData.title || playlistData.name);
        }
        const songs = playlistData?.songs || res?.results || [];
        if (songs.length > 0) {
          tracksString = songs.map(s => `${s.title || s.name} - ${s.primaryArtists || s.artist?.name || ''}`).join('\n');
        } else {
          throw new Error("Could not parse songs from JioSaavn playlist.");
        }
      }

      if (tracksString) {
        setInputText(prev => prev ? prev + '\n' + tracksString : tracksString);
        setPlaylistUrl('');
      }
    } catch (err) {
      console.error("Failed to fetch playlist", err);
      setErrorMsg(err.message || 'Could not load playlist from URL.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleImport = async () => {
    if (!inputText.trim() || isImporting) return;
    
    const lines = inputText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    setIsImporting(true);
    setErrorMsg('');
    setProgress({ current: 0, total: lines.length, failed: 0 });
    const resolvedTracks = [];
    let failures = 0;

    for (const [index, line] of lines.entries()) {
      try {
        let query = line;
        let artistHint = '';
        if (line.includes('-')) {
          const parts = line.split('-');
          query = parts[0].trim();
          artistHint = parts[1].trim().toLowerCase();
        }

        const data = await api.searchSongs(query, 1, 10);
        const results = data?.data?.results || data?.results || data?.data || [];
        
        // Negative Keyword Filter
        const negativePattern = /karaoke|cover|sped up|tribute|lofi|zzang|originally performed|instrumental/i;
        const filteredResults = results.filter(r => {
           const title = r.title || r.name || '';
           const artist = r.artist?.name || r.primaryArtists || '';
           const text = `${title} ${artist}`.toLowerCase();
           return !negativePattern.test(text);
        });

        // Precision Artist Validation
        let finalTrack = filteredResults[0] || results[0];
        if (artistHint && filteredResults.length > 0) {
           const exactMatch = filteredResults.find(r => {
             const artists = (r.artist?.name || r.primaryArtists || '').toLowerCase();
             return artists.includes(artistHint) || artistHint.includes(artists);
           });
           if (exactMatch) finalTrack = exactMatch;
        }

        if (finalTrack) {
           const resolvedUrl = getAudioStreamUrl(finalTrack);
           const img500 = finalTrack.album?.cover_xl || finalTrack.album?.cover || finalTrack.image?.[2]?.url || finalTrack.image?.[2]?.link || finalTrack.image?.[0]?.url || finalTrack.image?.[0]?.link || '';
           const normalizedTrack = {
             ...finalTrack,
             id: finalTrack.id,
             title: finalTrack.title || finalTrack.name,
             name: finalTrack.title || finalTrack.name,
             artist: { name: finalTrack.artist?.name || finalTrack.primaryArtists },
             primaryArtists: finalTrack.artist?.name || finalTrack.primaryArtists,
             album: { 
               title: finalTrack.album?.title || finalTrack.album?.name || '',
               name: finalTrack.album?.title || finalTrack.album?.name || '',
               cover_medium: finalTrack.album?.cover_medium || img500,
               cover_xl: img500,
               cover: img500
             },
             image: finalTrack.image,
             downloadUrl: finalTrack.downloadUrl,
             preview: resolvedUrl || finalTrack.preview || ''
           };
           resolvedTracks.push(normalizedTrack);
        } else {
           failures++;
        }
      } catch (err) {
        console.error(`[Importer] Failed on track "${line}":`, err);
        failures++;
      }
      
      setProgress({ current: index + 1, total: lines.length, failed: failures });
    }

    if (resolvedTracks.length > 0) {
       const newPlaylist = {
         id: `imported_${Date.now()}`,
         name: playlistName.trim() || "Imported Mix",
         tracks: resolvedTracks
       };
       useAppStore.getState().savePlaylist(newPlaylist);
       setImportedPlaylist(newPlaylist);
    } else {
       setErrorMsg('No matching tracks could be resolved. Try simplifying track titles.');
    }
    
    setIsImporting(false);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[130] flex items-center justify-center p-3 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="bg-[#121212] border border-[#282828] w-full max-w-lg rounded-2xl sm:rounded-xl shadow-2xl p-5 sm:p-6 relative flex flex-col max-h-[85dvh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 text-grayText hover:text-white cursor-pointer disabled:opacity-40 z-10"
          disabled={isImporting}
          aria-label="Close importer"
        >
           <X size={22} />
        </button>

        <div className="flex-shrink-0 pr-8">
          <h2 className="text-xl sm:text-2xl font-bold mb-1.5 flex items-center gap-2">
            <Download className="text-primary" size={22} /> Import Playlist
          </h2>
          <p className="text-grayText text-xs sm:text-sm mb-4">
            Paste a Spotify or JioSaavn playlist URL, or paste tracks (Song - Artist) below.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-0.5">
          {errorMsg && (
            <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {errorMsg}
            </div>
          )}

          {!isImporting && !importedPlaylist && (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-2.5 text-white text-sm focus:border-primary focus:outline-none placeholder-grayText/50"
                placeholder="Playlist Name"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
              />

              <div className="relative">
                <input 
                  type="text" 
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-md p-3 pr-10 text-white text-sm focus:border-primary focus:outline-none placeholder-grayText/50"
                  placeholder="Enter Spotify or JioSaavn Playlist URL..."
                  value={playlistUrl}
                  onChange={(e) => {
                    setPlaylistUrl(e.target.value);
                    if (/(open\.spotify\.com\/(playlist|s|album)\/|spotify\.link\/|spoti\.fi\/|jiosaavn\.com\/)/i.test(e.target.value)) {
                      handleUrlFetch(e.target.value);
                    }
                  }}
                />
                {isFetchingUrl && (
                  <div className="absolute right-3 top-3 text-primary animate-spin">
                    <Loader2 size={20} />
                  </div>
                )}
              </div>

              <textarea 
                className="w-full h-28 sm:h-36 bg-[#1a1a1a] border border-[#333] rounded-md p-3 text-white text-sm custom-scrollbar focus:border-primary focus:outline-none placeholder-grayText/50 resize-none"
                placeholder={`Blinding Lights - The Weeknd\nShape of You - Ed Sheeran\n...`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>
          )}

          {isImporting && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
               <div className="w-12 h-12 rounded-full border-4 border-[#282828] border-t-primary animate-spin"></div>
               <p className="font-bold text-base sm:text-lg text-center">Matching track {progress.current} of {progress.total}...</p>
               <p className="text-xs sm:text-sm text-grayText font-medium">({progress.failed} failed/skipped via negative filters)</p>
               <div className="w-full h-2 bg-[#282828] rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-200" style={{ width: `${(progress.current / progress.total) * 100}%`}}></div>
               </div>
            </div>
          )}

          {!isImporting && importedPlaylist && (
            <div className="flex flex-col items-center py-4 gap-3 text-center animate-in zoom-in duration-300">
               <CheckCircle size={48} className="text-green-500" />
               <h3 className="text-xl sm:text-2xl font-bold">Import Successful!</h3>
               <p className="text-grayText text-sm font-medium">{importedPlaylist.tracks.length} tracks matched and saved to "{importedPlaylist.name}".</p>
               
               {progress.failed > 0 && (
                  <p className="text-xs sm:text-sm text-yellow-500 flex items-center justify-center gap-1 bg-yellow-500/10 py-2 px-3 rounded-md w-full"><AlertCircle size={14}/> {progress.failed} tracks were skipped due to missing streams or karaoke matches.</p>
               )}
               
               <div className="w-36 h-36 sm:w-40 sm:h-40 mt-2 mb-1">
                  <PlaylistCover tracks={importedPlaylist.tracks} />
               </div>
            </div>
          )}
        </div>

        {!isImporting && !importedPlaylist && (
          <div className="flex-shrink-0 pt-3">
            <button 
              type="button"
              disabled={!inputText.trim() || isFetchingUrl}
              onClick={handleImport}
              className={`w-full py-3 rounded-full font-bold text-sm sm:text-base transition-all ${
                inputText.trim() && !isFetchingUrl
                  ? 'bg-primary text-black hover:scale-[1.02] cursor-pointer'
                  : 'bg-[#2a2a2a] text-[#777] cursor-not-allowed'
              }`}
            >
              Start Hardened Import
            </button>
          </div>
        )}

        {!isImporting && importedPlaylist && (
          <div className="flex-shrink-0 pt-3">
            <button 
              type="button"
              onClick={handleClose}
              className="w-full py-3 rounded-full bg-[#282828] text-white font-bold hover:bg-[#333] transition-colors cursor-pointer"
            >
              Close & View Library
            </button>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}
