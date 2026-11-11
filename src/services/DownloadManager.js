import { useAppStore } from '../store/useAppStore';
import { OfflineStorage } from './OfflineStorage';
import { getAudioStreamUrl } from '../utils/audioHelper';
import { api } from '../utils/apiClient';

class DownloadManagerSingleton {
  constructor() {
    this.activeDownloads = new Set();
  }

  /**
   * Helper to get best audio stream URL
   */
  _getStreamUrl(track) {
    return getAudioStreamUrl(track);
  }

  /**
   * Download a single track
   */
  async downloadTrack(track, retryCount = 0) {
    if (this.activeDownloads.has(track.id)) return;
    
    // Check if already downloaded
    const isDownloaded = await OfflineStorage.isTrackDownloaded(track.id);
    if (isDownloaded) {
      useAppStore.getState().addDownloadedTrack(track);
      return true;
    }

    let streamUrl = this._getStreamUrl(track);
    if (!streamUrl && track.id) {
      try {
        const res = await api.getSong(track.id);
        const fullTrack = Array.isArray(res.data) ? res.data[0] : (res.data?.results?.[0] || res.results?.[0] || res.data);
        if (fullTrack) {
          streamUrl = this._getStreamUrl({ ...track, ...fullTrack });
        }
      } catch (e) {
        console.warn('[DownloadManager] Failed to resolve full track URL:', e?.message || e);
      }
    }

    if (!streamUrl) {
      console.error('[DownloadManager] No stream URL for track:', track.id);
      return false;
    }

    this.activeDownloads.add(track.id);
    useAppStore.getState().addDownloadQueue(track.id);

    try {
      const response = await fetch(streamUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const blob = await response.blob();
      const success = await OfflineStorage.saveTrack(track, blob);
      
      if (success) {
        useAppStore.getState().addDownloadedTrack(track);
      }
      return success;
    } catch (e) {
      console.error(`[DownloadManager] Error downloading ${track.id}:`, e);
      if (retryCount < 2) {
        this.activeDownloads.delete(track.id);
        useAppStore.getState().removeDownloadQueue(track.id);
        return this.downloadTrack(track, retryCount + 1);
      }
      return false;
    } finally {
      this.activeDownloads.delete(track.id);
      useAppStore.getState().removeDownloadQueue(track.id);
    }
  }

  /**
   * Download an entire playlist (array of tracks)
   */
  async downloadPlaylist(tracks) {
    let successCount = 0;
    for (const track of tracks) {
      const success = await this.downloadTrack(track);
      if (success) successCount++;
    }
    return successCount;
  }
}

export const DownloadManager = new DownloadManagerSingleton();
