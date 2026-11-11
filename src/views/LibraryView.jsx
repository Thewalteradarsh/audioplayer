import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import PlaylistCover from '../components/library/PlaylistCover';
import PlaylistImporter from '../components/library/PlaylistImporter';
import { Heart, Plus, Download, CheckCircle2, WifiOff, Play, Trash2, Loader2 } from 'lucide-react';
import { DownloadManager } from '../services/DownloadManager';

export default function LibraryView() {
  const { playlists, likedSongs } = useAppStore(state => state.library);
  const { isOfflineMode, downloadedTracks, downloadQueue } = useAppStore(state => state.offlineMode);
  const toggleOfflineMode = useAppStore(state => state.toggleOfflineMode);
  const currentTrackId = useAppStore(state => state.playbackState.currentTrack?.id);

  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState('liked');

  // Filter for offline mode
  const displayLikedSongs = useMemo(() => {
    if (!isOfflineMode) return likedSongs;
    return likedSongs.filter(t => downloadedTracks.includes(t.id));
  }, [likedSongs, isOfflineMode, downloadedTracks]);

  const displayPlaylists = useMemo(() => {
    if (!isOfflineMode) return playlists;
    return playlists.map(p => ({
      ...p,
      tracks: p.tracks.filter(t => downloadedTracks.includes(t.id))
    })).filter(p => p.tracks.length > 0);
  }, [playlists, isOfflineMode, downloadedTracks]);

  const handlePlayLiked = (e) => {
    e?.stopPropagation?.();
    if (displayLikedSongs.length > 0) {
      useAppStore.getState().playTrack(displayLikedSongs[0], displayLikedSongs);
    }
  };

  const handlePlayPlaylist = (e, playlist) => {
    e?.stopPropagation?.();
    if (playlist.tracks.length > 0) {
      useAppStore.getState().playTrack(playlist.tracks[0], playlist.tracks);
    }
  };

  const handleDownloadLiked = (e) => {
    e.stopPropagation();
    if (displayLikedSongs.length > 0) {
      DownloadManager.downloadPlaylist(displayLikedSongs);
    }
  };

  const handleDownloadPlaylist = (e, playlist) => {
    e.stopPropagation();
    if (playlist.tracks.length > 0) {
      DownloadManager.downloadPlaylist(playlist.tracks);
    }
  };

  const handleDeletePlaylist = (e, playlistId) => {
    e.stopPropagation();
    useAppStore.getState().removePlaylist(playlistId);
    if (selectedCollectionId === playlistId) {
      setSelectedCollectionId('liked');
    }
  };

  const isLikedFullyDownloaded = likedSongs.length > 0 && likedSongs.every(t => downloadedTracks.includes(t.id));
  const isLikedDownloading = likedSongs.some(t => downloadQueue.includes(t.id));

  const selectedCollection = selectedCollectionId === 'liked'
    ? { id: 'liked', name: 'Liked Songs', tracks: displayLikedSongs, isLiked: true }
    : displayPlaylists.find(p => p.id === selectedCollectionId) || { id: 'liked', name: 'Liked Songs', tracks: displayLikedSongs, isLiked: true };

  return (
    <div className="pt-4 md:pt-6 px-4 md:px-8 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4 mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Your Library</h1>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <button 
            type="button"
            onClick={toggleOfflineMode}
            className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full font-bold transition-colors text-xs md:text-sm cursor-pointer ${isOfflineMode ? 'bg-primary text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            <WifiOff size={16} /> {isOfflineMode ? 'Offline ON' : 'Offline OFF'}
          </button>
          <button 
            type="button"
            onClick={() => setIsImporterOpen(true)}
            className="flex items-center gap-1.5 md:gap-2 bg-white/10 hover:bg-white/20 px-3 md:px-4 py-1.5 md:py-2 rounded-full font-bold transition-colors text-xs md:text-sm cursor-pointer"
          >
            <Plus size={16} /> Import Playlist
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 md:gap-6">
        {/* Pinned Liked Songs Card */}
        <div 
          className={`col-span-2 bg-gradient-to-br from-indigo-700 to-purple-800 p-5 md:p-6 rounded-md hover:scale-[1.01] transition-transform cursor-pointer group relative flex flex-col justify-end min-h-[160px] md:min-h-[240px] border-2 ${
            selectedCollection.id === 'liked' ? 'border-white/50' : 'border-transparent'
          }`}
          onClick={() => {
            setSelectedCollectionId('liked');
            if (displayLikedSongs.length > 0) {
              handlePlayLiked();
            }
          }}
        >
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
          
          <div className="absolute top-4 right-4 z-20">
             {isLikedDownloading ? (
                <div className="p-2 bg-black/40 rounded-full"><Loader2 className="animate-spin text-primary" size={20} /></div>
             ) : isLikedFullyDownloaded ? (
                <div className="p-2 bg-black/40 rounded-full"><CheckCircle2 className="text-primary" size={22} /></div>
             ) : (
                <button
                  type="button"
                  aria-label="Download Liked Songs"
                  onClick={handleDownloadLiked}
                  disabled={displayLikedSongs.length === 0}
                  className="p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors cursor-pointer disabled:opacity-40"
                >
                   <Download size={20} className="text-white" />
                </button>
             )}
          </div>

          <div className="z-10 mt-auto">
            <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">Liked Songs <Heart className="fill-white" size={24} /></h2>
            <p className="text-white/80 font-medium">{displayLikedSongs.length} {isOfflineMode ? 'downloaded' : 'liked'} tracks</p>
          </div>
          
          {displayLikedSongs.length > 0 && (
            <button
              type="button"
              aria-label="Play Liked Songs"
              onClick={handlePlayLiked}
              className="absolute bottom-5 right-5 md:bottom-6 md:right-6 w-12 h-12 md:w-14 md:h-14 bg-primary rounded-full flex items-center justify-center opacity-100 md:opacity-0 md:translate-y-4 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-300 shadow-2xl z-20 cursor-pointer hover:scale-105"
            >
              <Play size={24} className="fill-black text-black ml-0.5" />
            </button>
          )}
        </div>

        {/* Saved Playlists hydrated with 2x2 Covers */}
        {displayPlaylists.map(playlist => {
          const isFullyDownloaded = playlist.tracks.length > 0 && playlist.tracks.every(t => downloadedTracks.includes(t.id));
          const isPlaylistDownloading = playlist.tracks.some(t => downloadQueue.includes(t.id));
          const isSelected = selectedCollection.id === playlist.id;
          return (
            <div 
              key={playlist.id} 
              className={`bg-[#181818] p-3 md:p-4 rounded-md hover:bg-[#282828] transition-colors cursor-pointer group flex flex-col min-h-[200px] md:min-h-[240px] border relative ${
                isSelected ? 'border-primary/60' : 'border-transparent hover:border-[#333]'
              }`}
              onClick={() => setSelectedCollectionId(playlist.id)}
            >
              <div className="w-full aspect-square mb-3 md:mb-4 relative shadow-lg group-hover:shadow-xl transition-shadow rounded-md overflow-hidden">
                 <PlaylistCover tracks={playlist.tracks} fallbackImage="https://via.placeholder.com/500/121212/ffffff?text=Music" />
                 
                 <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 opacity-95 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {isPlaylistDownloading ? (
                       <div className="p-1.5 bg-black/70 rounded-full"><Loader2 className="animate-spin text-primary" size={16} /></div>
                    ) : isFullyDownloaded ? (
                       <div className="p-1.5 bg-black/70 rounded-full"><CheckCircle2 className="text-primary" size={16} /></div>
                    ) : (
                       <button
                         type="button"
                         aria-label={`Download ${playlist.name}`}
                         onClick={(e) => handleDownloadPlaylist(e, playlist)}
                         className="p-1.5 bg-black/70 hover:bg-black rounded-full transition-colors text-white cursor-pointer"
                       >
                          <Download size={16} />
                       </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Delete ${playlist.name}`}
                      onClick={(e) => handleDeletePlaylist(e, playlist.id)}
                      className="p-1.5 bg-black/70 hover:bg-red-600 rounded-full transition-colors text-white cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                 </div>

                 <button
                   type="button"
                   aria-label={`Play ${playlist.name}`}
                   onClick={(e) => handlePlayPlaylist(e, playlist)}
                   className="absolute bottom-2 right-2 w-10 h-10 md:w-12 md:h-12 bg-primary rounded-full flex items-center justify-center opacity-95 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-300 shadow-xl z-20 cursor-pointer hover:scale-105"
                 >
                    <Play size={20} className="fill-black text-black ml-0.5" />
                 </button>
              </div>
              <h3 className="font-bold text-white text-base truncate mb-1">{playlist.name}</h3>
              <p className="text-sm text-grayText truncate">{playlist.tracks.length} tracks</p>
            </div>
          );
        })}
      </div>

      {/* Selected Collection Tracklist */}
      <div className="mt-10 bg-[#181818] border border-[#282828] rounded-xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">{selectedCollection.name}</h2>
            <p className="text-xs text-grayText">{selectedCollection.tracks.length} tracks</p>
          </div>
          {selectedCollection.tracks.length > 0 && (
            <button
              type="button"
              onClick={() => useAppStore.getState().playTrack(selectedCollection.tracks[0], selectedCollection.tracks)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-black font-bold text-xs hover:scale-105 transition-transform cursor-pointer"
            >
              <Play size={14} className="fill-current" /> Play All
            </button>
          )}
        </div>

        {selectedCollection.tracks.length === 0 ? (
          <p className="text-sm text-grayText py-6 text-center">
            {selectedCollection.isLiked
              ? 'No liked songs yet. Tap the heart icon on any track to save it here.'
              : 'No tracks available in this view.'}
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {selectedCollection.tracks.map((track, index) => {
              const active = track.id === currentTrackId;
              const isDownloaded = downloadedTracks.includes(track.id);
              const isDownloading = downloadQueue.includes(track.id);
              const thumb =
                track.album?.cover_medium ||
                track.album?.cover_xl ||
                track.image?.[1]?.url ||
                track.image?.[0]?.url ||
                'https://via.placeholder.com/100';
              const trackTitle = track.title || track.name || 'Unknown Track';
              const trackArtist = track.artist?.name || track.primaryArtists || track.artists || 'Unknown Artist';
              const isLiked = likedSongs.some(t => t.id === track.id);

              return (
                <div
                  key={`${track.id}_${index}`}
                  onClick={() => useAppStore.getState().playTrack(track, selectedCollection.tracks)}
                  className={`flex items-center gap-3 py-2.5 px-2 rounded-md cursor-pointer transition-colors ${
                    active ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="w-6 text-center text-xs text-grayText font-medium">{index + 1}</span>
                  <img src={thumb} alt={trackTitle} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${active ? 'text-primary' : 'text-white'}`}>
                      {trackTitle}
                    </p>
                    <p className="text-xs text-grayText truncate">{trackArtist}</p>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      aria-label={isLiked ? 'Unlike track' : 'Like track'}
                      onClick={() => useAppStore.getState().toggleLikeTrack(track)}
                      className="p-1.5 text-grayText hover:text-white cursor-pointer"
                    >
                      <Heart size={16} className={isLiked ? 'fill-primary text-primary' : ''} />
                    </button>
                    {isDownloading ? (
                      <div className="p-1.5"><Loader2 size={16} className="animate-spin text-primary" /></div>
                    ) : isDownloaded ? (
                      <div className="p-1.5"><CheckCircle2 size={16} className="text-primary" /></div>
                    ) : (
                      <button
                        type="button"
                        aria-label="Download track"
                        onClick={() => DownloadManager.downloadTrack(track)}
                        className="p-1.5 text-grayText hover:text-white cursor-pointer"
                      >
                        <Download size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Crash-Proof Importer Modal */}
      <PlaylistImporter isOpen={isImporterOpen} onClose={() => setIsImporterOpen(false)} />
    </div>
  );
}
