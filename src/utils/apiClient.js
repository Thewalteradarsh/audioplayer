import { appCache } from './lruCache.js';
import { getAudioStreamUrl } from './audioHelper.js';

// Configuration: Primary local proxy route + fallback remote mirrors
const API_ENDPOINTS = [
  '/api',
  'https://saavn.dev/api',
  'https://saavan-music-api.vercel.app/api',
  'https://jiosaavn-api-lemon.vercel.app'
];

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 300;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Decode common HTML entities
 */
export function decodeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Normalize multi-quality image array (500x500, 150x150, 50x50)
 */
export function formatImages(imageUrl) {
  const placeholder = 'https://via.placeholder.com/500';
  if (!imageUrl) {
    return [
      { quality: '50x50', url: placeholder, link: placeholder },
      { quality: '150x150', url: placeholder, link: placeholder },
      { quality: '500x500', url: placeholder, link: placeholder }
    ];
  }

  if (Array.isArray(imageUrl)) {
    return imageUrl.map(img => {
      const u = (img.url || img.link || '').replace(/http:\/\//, 'https://');
      return { quality: img.quality || '500x500', url: u, link: u };
    });
  }

  const raw = String(imageUrl).replace(/http:\/\//, 'https://');
  const img50 = raw.replace(/(50x50|150x150|500x500)\.jpg/, '50x50.jpg');
  const img150 = raw.replace(/(50x50|150x150|500x500)\.jpg/, '150x150.jpg');
  const img500 = raw.replace(/(50x50|150x150|500x500)\.jpg/, '500x500.jpg');

  return [
    { quality: '50x50', url: img50, link: img50 },
    { quality: '150x150', url: img150, link: img150 },
    { quality: '500x500', url: img500, link: img500 }
  ];
}

/**
 * Normalizes a single track object across v1, v2, and direct formats
 */
export function normalizeTrack(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const rawTitle = raw.title || raw.name || raw.song || '';
  const title = decodeHtml(rawTitle);

  // Artist resolution
  let artistName = '';
  if (typeof raw.primaryArtists === 'string' && raw.primaryArtists) {
    artistName = raw.primaryArtists;
  } else if (typeof raw.artists === 'string' && raw.artists) {
    artistName = raw.artists;
  } else if (raw.more_info?.artistMap?.primary_artists?.length > 0) {
    artistName = raw.more_info.artistMap.primary_artists.map(a => a.name).join(', ');
  } else if (raw.artist?.name) {
    artistName = raw.artist.name;
  } else if (typeof raw.artist === 'string' && raw.artist) {
    artistName = raw.artist;
  } else if (raw.more_info?.music) {
    artistName = raw.more_info.music;
  } else if (raw.subtitle) {
    artistName = raw.subtitle.split('-')[0].trim();
  }
  artistName = decodeHtml(artistName || 'Unknown Artist');

  // Album resolution
  const albumName = decodeHtml(raw.album?.name || raw.album?.title || raw.more_info?.album || raw.album || '');
  const albumId = raw.album?.id || raw.more_info?.album_id || '';

  // Images
  const rawImage = raw.image || raw.more_info?.image || raw.album?.cover_xl || '';
  const images = formatImages(rawImage);
  const img500 = images.find(i => i.quality === '500x500')?.url || images[images.length - 1]?.url || '';
  const img150 = images.find(i => i.quality === '150x150')?.url || images[0]?.url || '';

  // Audio streams
  let downloadUrls = [];
  if (Array.isArray(raw.downloadUrl)) {
    downloadUrls = raw.downloadUrl.map(d => {
      const u = (d.url || d.link || '').replace(/^http:\/\//i, 'https://');
      return { quality: d.quality || '320kbps', url: u, link: u };
    });
  }

  // Use centralized audio helper to resolve stream URL across all formats (including DES decryption)
  const bestAudioUrl = getAudioStreamUrl(raw) || 
                       raw.preview || 
                       raw.media_url || 
                       raw.url || 
                       '';

  if (downloadUrls.length === 0 && bestAudioUrl) {
    downloadUrls = [
      { quality: '96kbps', url: bestAudioUrl.replace(/_(320|160)\./i, '_96.'), link: bestAudioUrl.replace(/_(320|160)\./i, '_96.') },
      { quality: '160kbps', url: bestAudioUrl.replace(/_(320|96)\./i, '_160.'), link: bestAudioUrl.replace(/_(320|96)\./i, '_160.') },
      { quality: '320kbps', url: bestAudioUrl.replace(/_(160|96)\./i, '_320.'), link: bestAudioUrl.replace(/_(160|96)\./i, '_320.') },
    ];
  }

  let duration = 0;
  if (raw.duration) duration = Number(raw.duration);
  else if (raw.more_info?.duration) duration = Number(raw.more_info.duration);

  return {
    id: String(raw.id || raw.pid || ''),
    title,
    name: title,
    subtitle: decodeHtml(raw.subtitle || ''),
    header_desc: decodeHtml(raw.header_desc || ''),
    type: 'song',
    year: String(raw.year || raw.more_info?.year || ''),
    language: raw.language || raw.more_info?.language || '',
    duration: Number.isFinite(duration) ? duration : 0,
    primaryArtists: artistName,
    artists: artistName,
    artist: {
      name: artistName,
      id: raw.artist?.id || raw.more_info?.artistMap?.primary_artists?.[0]?.id || ''
    },
    album: {
      id: String(albumId),
      name: albumName,
      title: albumName,
      cover_xl: img500,
      cover_medium: img150,
      cover: img500,
      url: raw.more_info?.album_url || raw.album?.url || ''
    },
    image: images,
    downloadUrl: downloadUrls,
    preview: bestAudioUrl,
    media_url: bestAudioUrl,
    url: bestAudioUrl,
    encrypted_media_url: raw.encrypted_media_url || raw.more_info?.encrypted_media_url || '',
    has_lyrics: String(raw.more_info?.has_lyrics || raw.has_lyrics || 'false'),
    lyrics_id: raw.more_info?.lyrics_id || raw.lyrics_id || null
  };
}

/**
 * Normalizes all responses ensuring consistent structure across endpoints
 */
export function normalizeApiResponse(data) {
  if (!data || typeof data !== 'object') return data;

  // 1. If data has results array (search / songs)
  let rawList = null;
  if (Array.isArray(data.data?.results)) rawList = data.data.results;
  else if (Array.isArray(data.results)) rawList = data.results;
  else if (Array.isArray(data.data?.songs)) rawList = data.data.songs;
  else if (Array.isArray(data.songs)) rawList = data.songs;
  else if (Array.isArray(data.data)) rawList = data.data;
  else if (Array.isArray(data)) rawList = data;

  if (Array.isArray(rawList)) {
    const normalizedList = rawList.map(item => {
      if (item && (item.type === 'playlist' || item.songCount !== undefined)) {
        return item;
      }
      return normalizeTrack(item);
    }).filter(Boolean);

    // Provide universal access properties
    return {
      status: data.status || 'SUCCESS',
      data: {
        total: data.data?.total || normalizedList.length,
        start: data.data?.start || 1,
        results: normalizedList,
        data: normalizedList,
        songs: normalizedList
      },
      results: normalizedList,
      songs: normalizedList
    };
  }

  // 2. If data is a playlist or album object
  if (data.data && typeof data.data === 'object' && (data.data.songs || data.data.list)) {
    const rawSongs = data.data.songs || data.data.list || [];
    const normalizedSongs = Array.isArray(rawSongs) ? rawSongs.map(normalizeTrack).filter(Boolean) : [];
    data.data.songs = normalizedSongs;
    data.results = normalizedSongs;
    data.songs = normalizedSongs;
    return data;
  }

  return data;
}

/**
 * Advanced API Client with caching, retry logic, abort control, and API fallback pool.
 */
class ApiClient {
  constructor() {
    this.abortControllers = new Map();
    this.currentApiIndex = 0;
  }

  getBaseUrl() {
    return API_ENDPOINTS[this.currentApiIndex];
  }

  switchToNextApi() {
    this.currentApiIndex = (this.currentApiIndex + 1) % API_ENDPOINTS.length;
    console.warn(`[ApiClient] Switching API base to: ${this.getBaseUrl()}`);
  }

  /**
   * Universal fetch with automatic mirror fallback and normalization
   */
  async fetch(endpointPath, options = {}) {
    const { disableCache = false, abortKey = null, retries = MAX_RETRIES, params, ...nativeFetchOptions } = options;
    const cleanEndpoint = endpointPath.replace(/^\/+/, '');
    
    let attempt = 0;
    let lastError = null;

    while (attempt <= retries) {
      const baseUrl = this.getBaseUrl();
      let url;

      if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
        url = new URL(baseUrl);
        url.pathname = `${url.pathname === '/' ? '' : url.pathname}/${cleanEndpoint}`;
      } else {
        url = new URL(`${baseUrl}/${cleanEndpoint}`, window.location.origin);
      }

      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
        });
      }

      const isGet = !nativeFetchOptions.method || nativeFetchOptions.method.toUpperCase() === 'GET';
      const cacheKey = url.toString();

      // Check LRU Cache
      if (isGet && !disableCache) {
        const cached = appCache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // AbortController setup
      const reqKey = abortKey || cacheKey;
      if (this.abortControllers.has(reqKey)) {
        this.abortControllers.get(reqKey).abort("Cancelled by subsequent request");
      }
      
      const controller = new AbortController();
      this.abortControllers.set(reqKey, controller);
      
      const signal = nativeFetchOptions.signal || controller.signal;
      const finalOptions = {
        ...nativeFetchOptions,
        signal,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'x-app-client': 'HearApp',
          ...nativeFetchOptions.headers
        }
      };

      try {
        const response = await fetch(url.toString(), finalOptions);
        
        if (!response.ok) {
          throw new Error(`API HTTP ${response.status}`);
        }

        const text = await response.text();
        if (text.startsWith('<')) {
          throw new Error('API returned HTML instead of JSON');
        }

        const rawData = JSON.parse(text);
        const data = normalizeApiResponse(rawData);

        // Validate results
        const items = data.data?.results || data.results || (Array.isArray(data.data) ? data.data : []);
        if (cleanEndpoint.startsWith('search') && items.length === 0 && attempt < retries) {
          throw new Error('Empty search results, triggering mirror fallback');
        }

        if (isGet && !disableCache) {
          appCache.set(cacheKey, data);
        }
        
        this.abortControllers.delete(reqKey);
        return data;

      } catch (error) {
        if (error.name === 'AbortError' || error === "Cancelled by subsequent request") {
          throw error;
        }

        attempt++;
        lastError = error;
        this.abortControllers.delete(reqKey);
        
        console.warn(`[ApiClient] Attempt ${attempt}/${retries} failed on ${baseUrl}: ${error.message}`);
        
        if (attempt <= retries) {
          this.switchToNextApi();
          const waitTime = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await delay(waitTime);
        }
      }
    }

    throw lastError || new Error('All API instances failed to respond');
  }

  // --- Convenience Methods ---

  get(endpointPath, config = {}) {
    return this.fetch(endpointPath, { method: 'GET', ...config });
  }

  post(endpointPath, data, config = {}) {
    return this.fetch(endpointPath, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      ...config
    });
  }

  // Search Songs
  async searchSongs(query, page = 1, limit = 20, config = {}) {
    return this.get('search/songs', {
      params: { query, page, limit },
      ...config
    });
  }

  // Search Playlists
  async searchPlaylists(query, page = 1, limit = 20, config = {}) {
    return this.get('search/playlists', {
      params: { query, page, limit },
      ...config
    });
  }

  // Search Albums
  async searchAlbums(query, page = 1, limit = 20, config = {}) {
    return this.get('search/albums', {
      params: { query, page, limit },
      ...config
    });
  }

  // Search Artists
  async searchArtists(query, page = 1, limit = 20, config = {}) {
    return this.get('search/artists', {
      params: { query, page, limit },
      ...config
    });
  }

  // Global Search
  async searchGlobal(query, config = {}) {
    return this.get('search', {
      params: { query },
      ...config
    });
  }

  // Song Details
  async getSong(id, config = {}) {
    return this.get(`songs/${id}`, config);
  }

  async getSongs(ids, config = {}) {
    const pids = Array.isArray(ids) ? ids.join(',') : String(ids);
    return this.get('songs', { params: { ids: pids }, ...config });
  }

  // Song Suggestions
  async getSongSuggestions(id, limit = 20, config = {}) {
    return this.get(`songs/${id}/suggestions`, {
      params: { limit },
      ...config
    });
  }

  // Song Lyrics
  async getSongLyrics(id, config = {}) {
    return this.get(`songs/${id}/lyrics`, config);
  }

  // Playlists (with auto-fallback if songs empty)
  async getPlaylist(id, config = {}) {
    const res = await this.get('playlists', { params: { id }, ...config });
    const songs = res.data?.songs || res.results || [];
    if (songs.length === 0) {
      const plName = res.data?.name || res.data?.title || 'Top hits';
      const searchRes = await this.searchSongs(plName, 1, 20, config);
      const fallbackSongs = searchRes.data?.results || searchRes.results || [];
      if (res.data) {
        res.data.songs = fallbackSongs;
      }
      res.results = fallbackSongs;
      res.songs = fallbackSongs;
    }
    return res;
  }

  // Albums
  async getAlbum(id, config = {}) {
    return this.get('albums', { params: { id }, ...config });
  }

  // Artists
  async getArtist(id, config = {}) {
    return this.get(`artists/${id}`, config);
  }

  async getArtistSongs(id, page = 1, limit = 20, config = {}) {
    return this.get(`artists/${id}/songs`, { params: { page, limit }, ...config });
  }

  async getArtistAlbums(id, page = 1, limit = 20, config = {}) {
    return this.get(`artists/${id}/albums`, { params: { page, limit }, ...config });
  }
}

export const api = new ApiClient();
