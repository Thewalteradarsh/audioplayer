import { JioSaavnDirect, normalizeSong, normalizePlaylist, normalizeAlbum } from './jiosaavnDirect.js';

const MIRRORS = [
  { name: 'Primary v2 API', base: 'https://saavn.dev/api' },
  { name: 'Secondary v2 Mirror', base: 'https://saavan-music-api.vercel.app/api' },
  { name: 'Legacy/v1 Mirror', base: 'https://jiosaavn-api-lemon.vercel.app' }
];

/**
 * Checks if response data has non-empty results
 */
function hasValidResults(endpoint, data) {
  if (!data || typeof data !== 'object') return false;

  // If endpoint is playlists or albums, check for songs array
  if (endpoint.includes('playlists') || endpoint.includes('albums')) {
    const songs = data.data?.songs || data.songs || data.data?.list || data.list || [];
    if (Array.isArray(songs) && songs.length > 0) return true;
    // Check if data itself has songs or results
    if (Array.isArray(data.data) && data.data.length > 0) return true;
    return false;
  }

  // If search or songs
  const results = data.data?.results || data.results || (Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []));
  if (Array.isArray(results) && results.length > 0) return true;

  // Single item details (e.g. songs/:id or object)
  if (data.data && typeof data.data === 'object' && (data.data.id || data.data.title || data.data.name)) return true;

  return false;
}

/**
 * Normalizes any response data from mirrors (v1 or v2 format)
 */
function normalizeMirrorResponse(endpoint, data) {
  if (!data || typeof data !== 'object') return data;

  // Normalize search/songs or songs/:id
  if (endpoint.includes('songs') || endpoint === 'search' || endpoint.startsWith('search')) {
    let rawList = data.data?.results || data.results || (Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : null));
    if (Array.isArray(rawList)) {
      const normalized = rawList.map(normalizeSong).filter(Boolean);
      return {
        status: 'SUCCESS',
        message: null,
        data: {
          total: Number(data.data?.total || normalized.length),
          start: Number(data.data?.start || 1),
          results: normalized
        },
        results: normalized
      };
    }
  }

  // Normalize playlists
  if (endpoint.includes('playlists')) {
    const rawPlaylist = data.data || data;
    const normalized = normalizePlaylist(rawPlaylist);
    if (normalized) {
      return {
        status: 'SUCCESS',
        data: normalized,
        results: normalized.songs
      };
    }
  }

  // Normalize albums
  if (endpoint.includes('albums')) {
    const rawAlbum = data.data || data;
    const normalized = normalizeAlbum(rawAlbum);
    if (normalized) {
      return {
        status: 'SUCCESS',
        data: normalized,
        results: normalized.songs
      };
    }
  }

  return data;
}

/**
 * Core Request Handler with Multi-Instance Fallback
 * 
 * Flow:
 * 1. Primary v2 API: https://saavn.dev/api
 * 2. Secondary v2 Mirror: https://saavan-music-api.vercel.app/api
 * 3. Legacy/v1 Mirror: https://jiosaavn-api-lemon.vercel.app
 * 4. Direct Serverless Fallback: https://www.jiosaavn.com/api.php with pure-JS DES-ECB
 */
export async function executeJioSaavnRequest(endpoint, queryParams = {}, signal) {
  const cleanEndpoint = endpoint.replace(/^\/+/, '').replace(/\/+$/, '');
  const params = new URLSearchParams();

  Object.entries(queryParams).forEach(([k, v]) => {
    if (v !== undefined && v !== null && k !== 'endpoint') {
      params.append(k, String(v));
    }
  });

  // 1-3: Try remote mirrors first
  for (const mirror of MIRRORS) {
    try {
      const targetUrl = new URL(mirror.base);
      targetUrl.pathname = `${targetUrl.pathname === '/' ? '' : targetUrl.pathname}/${cleanEndpoint}`;
      params.forEach((value, key) => targetUrl.searchParams.append(key, value));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800); // 1.8s fast timeout per mirror to avoid serverless timeout

      const res = await fetch(targetUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        },
        signal: signal || controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`[Mirror Fallback] ${mirror.name} returned HTTP ${res.status}`);
        continue;
      }

      const text = await res.text();
      if (text.startsWith('<')) {
        console.warn(`[Mirror Fallback] ${mirror.name} returned HTML instead of JSON`);
        continue;
      }

      const json = JSON.parse(text);
      if (hasValidResults(cleanEndpoint, json)) {
        return normalizeMirrorResponse(cleanEndpoint, json);
      } else {
        console.warn(`[Mirror Fallback] ${mirror.name} returned empty or invalid results`);
      }
    } catch (err) {
      console.warn(`[Mirror Fallback] ${mirror.name} failed:`, err.message);
    }
  }

  // 4: Direct Serverless Fallback (JioSaavn Official API + DES-ECB decryption)
  console.log(`[JioSaavn Fallback] Routing "${cleanEndpoint}" to Direct Serverless Fallback...`);
  return executeDirectFallback(cleanEndpoint, params, signal);
}

/**
 * Dispatches to JioSaavnDirect methods
 */
async function executeDirectFallback(endpoint, params, signal) {
  const query = params.get('query') || params.get('q') || '';
  const page = parseInt(params.get('page') || params.get('p') || '1', 10);
  const limit = parseInt(params.get('limit') || params.get('n') || '20', 10);
  const id = params.get('id') || params.get('ids') || '';

  // 1. Search Songs
  if (endpoint === 'search/songs' || endpoint === 'search/song') {
    return JioSaavnDirect.searchSongs(query, page, limit, signal);
  }

  // 2. Search Playlists
  if (endpoint === 'search/playlists' || endpoint === 'search/playlist') {
    return JioSaavnDirect.searchPlaylists(query, page, limit, signal);
  }

  // 3. Search Albums
  if (endpoint === 'search/albums' || endpoint === 'search/album') {
    return JioSaavnDirect.searchAlbums(query, page, limit, signal);
  }

  // 4. Search Artists
  if (endpoint === 'search/artists' || endpoint === 'search/artist') {
    return JioSaavnDirect.searchArtists(query, page, limit, signal);
  }

  // 5. Global Search
  if (endpoint === 'search') {
    if (query) {
      // Both global search and songs fallback
      const globalRes = await JioSaavnDirect.searchGlobal(query, signal);
      if (globalRes.data?.songs?.length > 0) {
        return globalRes;
      }
      return JioSaavnDirect.searchSongs(query, page, limit, signal);
    }
    return { status: 'SUCCESS', data: { results: [] }, results: [] };
  }

  // 6. Song Suggestions (e.g. songs/123/suggestions or endpoint=songs/suggestions with id)
  if (endpoint.includes('/suggestions') || endpoint === 'songs/suggestions') {
    const songId = endpoint.split('/')[1] || id;
    return JioSaavnDirect.getSongSuggestions(songId, limit, signal);
  }

  // 7. Song Lyrics (e.g. songs/123/lyrics or endpoint=songs/lyrics with id)
  if (endpoint.includes('/lyrics') || endpoint === 'songs/lyrics') {
    const songId = endpoint.split('/')[1] || id;
    return JioSaavnDirect.getSongLyrics(songId, signal);
  }

  // 8. Song Details by ID (e.g. songs/123 or songs?id=123 or songs?ids=123)
  if (endpoint.startsWith('songs/') || endpoint === 'songs' || endpoint === 'song') {
    const songId = endpoint.startsWith('songs/') ? endpoint.replace('songs/', '') : id;
    return JioSaavnDirect.getSongDetails(songId, signal);
  }

  // 9. Playlists
  if (endpoint.startsWith('playlists') || endpoint.startsWith('playlist')) {
    const playlistId = endpoint.startsWith('playlists/') ? endpoint.replace('playlists/', '') : id;
    const link = params.get('link');

    let resolvedId = playlistId;
    if (!resolvedId && link) {
      // Extract playlist ID or token from link
      const match = link.match(/\/featured\/[^/]+\/([a-zA-Z0-9-_]+)/) || link.match(/listid=([0-9]+)/);
      if (match) resolvedId = match[1];
    }

    if (resolvedId) {
      const plData = await JioSaavnDirect.getPlaylistDetails(resolvedId, signal);
      // If songs array is empty, fallback to search/songs
      if (!plData.data?.songs || plData.data.songs.length === 0) {
        console.warn(`[Playlist Fallback] Playlist ${resolvedId} returned empty songs. Falling back to search/songs...`);
        const searchRes = await JioSaavnDirect.searchSongs(plData.data?.name || 'Top hits', 1, 20, signal);
        if (plData.data) {
          plData.data.songs = searchRes.data?.results || [];
          plData.results = plData.data.songs;
        }
      }
      return plData;
    }

    if (query) {
      return JioSaavnDirect.searchPlaylists(query, page, limit, signal);
    }
  }

  // 10. Albums
  if (endpoint.startsWith('albums') || endpoint.startsWith('album')) {
    const albumId = endpoint.startsWith('albums/') ? endpoint.replace('albums/', '') : id;
    if (albumId) {
      return JioSaavnDirect.getAlbumDetails(albumId, signal);
    }
    if (query) {
      return JioSaavnDirect.searchAlbums(query, page, limit, signal);
    }
  }

  // 11. Artists
  if (endpoint.startsWith('artists') || endpoint.startsWith('artist')) {
    const parts = endpoint.split('/');
    const artistId = parts[1] || id;
    const subRoute = parts[2]; // songs, albums, etc.

    if (artistId) {
      const artistData = await JioSaavnDirect.getArtistDetails(artistId, page, limit, signal);
      if (subRoute === 'songs') {
        return {
          status: 'SUCCESS',
          data: { results: artistData.data?.topSongs || [] },
          results: artistData.data?.topSongs || []
        };
      }
      if (subRoute === 'albums') {
        return {
          status: 'SUCCESS',
          data: { results: artistData.data?.topAlbums || [] },
          results: artistData.data?.topAlbums || []
        };
      }
      return artistData;
    }

    if (query) {
      return JioSaavnDirect.searchArtists(query, page, limit, signal);
    }
  }

  // Generic fallback: Try search songs with any query
  if (query) {
    return JioSaavnDirect.searchSongs(query, page, limit, signal);
  }

  return {
    status: 'SUCCESS',
    data: { results: [] },
    results: []
  };
}

