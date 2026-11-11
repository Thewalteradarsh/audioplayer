import { decryptDesEcb } from './desEcb.js';

const JIOSAAVN_BASE = 'https://www.jiosaavn.com/api.php?_format=json&_marker=0&api_version=4&ctx=web6dot0';

/**
 * Unescapes HTML entities commonly returned by JioSaavn
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
 * Build multi-resolution image array (50x50, 150x150, 500x500)
 */
export function formatImages(imageUrl) {
  if (!imageUrl) {
    const placeholder = 'https://via.placeholder.com/500';
    return [
      { quality: '50x50', url: placeholder, link: placeholder },
      { quality: '150x150', url: placeholder, link: placeholder },
      { quality: '500x500', url: placeholder, link: placeholder }
    ];
  }

  // Handle case where imageUrl is already an array of image objects
  if (Array.isArray(imageUrl)) {
    return imageUrl.map(img => {
      const u = img.url || img.link || '';
      return {
        quality: img.quality || '500x500',
        url: u,
        link: u
      };
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
 * Generate 320kbps, 160kbps, 96kbps, 48kbps, 12kbps downloadUrl array from decrypted media URL
 */
export function formatMediaStreams(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return [];

  // saavn media URLs typically end in _96.mp4 or _96.m4a
  const extMatch = rawUrl.match(/(_96)?\.(mp4|m4a)$/i);
  const ext = extMatch ? extMatch[2] : 'mp4';
  const base = rawUrl.replace(/(_12|_48|_96|_160|_320)?\.(mp4|m4a)$/i, '');

  const url12 = `${base}_12.${ext}`;
  const url48 = `${base}_48.${ext}`;
  const url96 = `${base}_96.${ext}`;
  const url160 = `${base}_160.${ext}`;
  const url320 = `${base}_320.${ext}`;

  return [
    { quality: '12kbps', url: url12, link: url12 },
    { quality: '48kbps', url: url48, link: url48 },
    { quality: '96kbps', url: url96, link: url96 },
    { quality: '160kbps', url: url160, link: url160 },
    { quality: '320kbps', url: url320, link: url320 }
  ];
}

/**
 * Normalizes raw JioSaavn song into a universal track object compatible with:
 * - v2 format (`data.results[i]`, `downloadUrl[i].url`, `name`, `primaryArtists`)
 * - v1 format (`results[i]`, `downloadUrl[i].link`, `title`)
 * - Existing socialserv components (TrackCard, FullScreenPlayer, MiniPlayer, AudioEngine, DownloadManager)
 */
export function normalizeSong(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Title / Name
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

  // Streams / Audio URLs
  let downloadUrls = [];
  if (raw.more_info?.encrypted_media_url) {
    const decrypted = decryptDesEcb(raw.more_info.encrypted_media_url);
    if (decrypted) {
      downloadUrls = formatMediaStreams(decrypted);
    }
  } else if (raw.encrypted_media_url) {
    const decrypted = decryptDesEcb(raw.encrypted_media_url);
    if (decrypted) {
      downloadUrls = formatMediaStreams(decrypted);
    }
  }

  // If downloadUrl was already provided by an upstream v1/v2 API
  if (downloadUrls.length === 0 && Array.isArray(raw.downloadUrl)) {
    downloadUrls = raw.downloadUrl.map(d => {
      const u = d.url || d.link || '';
      return {
        quality: d.quality || '320kbps',
        url: u,
        link: u
      };
    });
  }

  // Highest quality stream
  const highRes = downloadUrls.find(u => u.quality === '320kbps');
  const stdRes = downloadUrls.find(u => u.quality === '160kbps');
  const bestAudioUrl = highRes?.url || highRes?.link || stdRes?.url || stdRes?.link || downloadUrls[downloadUrls.length - 1]?.url || raw.preview || raw.media_url || '';

  // Duration in seconds
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
    has_lyrics: String(raw.more_info?.has_lyrics || raw.has_lyrics || 'false'),
    lyrics_id: raw.more_info?.lyrics_id || raw.lyrics_id || null,
    copyright_text: decodeHtml(raw.more_info?.copyright_text || raw.copyright || '')
  };
}

/**
 * Normalizes playlist object
 */
export function normalizePlaylist(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const title = decodeHtml(raw.title || raw.name || raw.listname || '');
  const images = formatImages(raw.image);
  const rawSongs = raw.songs || raw.more_info?.songs || raw.list || [];
  const songs = Array.isArray(rawSongs) ? rawSongs.map(normalizeSong).filter(Boolean) : [];

  return {
    id: String(raw.id || raw.listid || ''),
    title,
    name: title,
    subtitle: decodeHtml(raw.subtitle || raw.header_desc || ''),
    type: 'playlist',
    image: images,
    songCount: songs.length || Number(raw.more_info?.song_count || raw.song_count || 0),
    songs,
    firstname: raw.firstname || '',
    follower_count: raw.follower_count || '0'
  };
}

/**
 * Normalizes album object
 */
export function normalizeAlbum(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const title = decodeHtml(raw.title || raw.name || '');
  const images = formatImages(raw.image);
  const rawSongs = raw.songs || raw.more_info?.songs || raw.list || [];
  const songs = Array.isArray(rawSongs) ? rawSongs.map(normalizeSong).filter(Boolean) : [];

  return {
    id: String(raw.id || ''),
    title,
    name: title,
    subtitle: decodeHtml(raw.subtitle || raw.header_desc || ''),
    header_desc: decodeHtml(raw.header_desc || ''),
    type: 'album',
    year: String(raw.year || ''),
    primaryArtists: decodeHtml(raw.more_info?.artistMap?.primary_artists?.map(a => a.name).join(', ') || raw.primaryArtists || ''),
    image: images,
    songCount: songs.length || Number(raw.more_info?.song_count || 0),
    songs
  };
}

/**
 * Helper to execute a direct call to JioSaavn
 */
async function callJioSaavn(params, signal) {
  const url = new URL(JIOSAAVN_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.append(k, String(v));
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'
    },
    signal
  });

  if (!response.ok) {
    throw new Error(`JioSaavn direct HTTP ${response.status}`);
  }

  const text = await response.text();
  if (text.startsWith('<')) {
    throw new Error('JioSaavn returned HTML');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Failed to parse JioSaavn direct JSON');
  }
}

/**
 * Direct JioSaavn Methods with normalization
 */
export const JioSaavnDirect = {
  // Search Songs
  async searchSongs(query, page = 1, limit = 20, signal) {
    const data = await callJioSaavn({
      __call: 'search.getResults',
      q: query,
      p: page,
      n: limit
    }, signal);

    const rawList = data?.results || (Array.isArray(data) ? data : []);
    const normalized = rawList.map(normalizeSong).filter(Boolean);

    return {
      status: 'SUCCESS',
      message: null,
      data: {
        total: Number(data?.total || normalized.length),
        start: Number(data?.start || 1),
        results: normalized
      },
      results: normalized
    };
  },

  // Search Playlists
  async searchPlaylists(query, page = 1, limit = 20, signal) {
    const data = await callJioSaavn({
      __call: 'search.getPlaylistResults',
      q: query,
      p: page,
      n: limit
    }, signal);

    const rawList = data?.results || (Array.isArray(data) ? data : []);
    const normalized = rawList.map(normalizePlaylist).filter(Boolean);

    return {
      status: 'SUCCESS',
      message: null,
      data: {
        total: Number(data?.total || normalized.length),
        start: Number(data?.start || 1),
        results: normalized
      },
      results: normalized
    };
  },

  // Search Albums
  async searchAlbums(query, page = 1, limit = 20, signal) {
    const data = await callJioSaavn({
      __call: 'search.getAlbumResults',
      q: query,
      p: page,
      n: limit
    }, signal);

    const rawList = data?.results || (Array.isArray(data) ? data : []);
    const normalized = rawList.map(normalizeAlbum).filter(Boolean);

    return {
      status: 'SUCCESS',
      message: null,
      data: {
        total: Number(data?.total || normalized.length),
        start: Number(data?.start || 1),
        results: normalized
      },
      results: normalized
    };
  },

  // Search Artists
  async searchArtists(query, page = 1, limit = 20, signal) {
    const data = await callJioSaavn({
      __call: 'search.getArtistResults',
      q: query,
      p: page,
      n: limit
    }, signal);

    const rawList = data?.results || (Array.isArray(data) ? data : []);
    const normalized = rawList.map(r => ({
      id: String(r.id || ''),
      name: decodeHtml(r.name || r.title || ''),
      role: r.role || 'artist',
      image: formatImages(r.image),
      type: 'artist'
    }));

    return {
      status: 'SUCCESS',
      message: null,
      data: {
        total: Number(data?.total || normalized.length),
        start: Number(data?.start || 1),
        results: normalized
      },
      results: normalized
    };
  },

  // Global Search / Autocomplete
  async searchGlobal(query, signal) {
    const data = await callJioSaavn({
      __call: 'autocomplete.get',
      query
    }, signal);

    const songs = (data?.songs?.data || []).map(normalizeSong).filter(Boolean);
    const albums = (data?.albums?.data || []).map(normalizeAlbum).filter(Boolean);
    const playlists = (data?.playlists?.data || []).map(normalizePlaylist).filter(Boolean);
    const artists = (data?.artists?.data || []).map(r => ({
      id: String(r.id || ''),
      name: decodeHtml(r.title || r.name || ''),
      image: formatImages(r.image),
      type: 'artist'
    }));

    return {
      status: 'SUCCESS',
      data: {
        songs,
        albums,
        playlists,
        artists
      },
      results: songs
    };
  },

  // Song Details by ID or IDs
  async getSongDetails(ids, signal) {
    const pids = Array.isArray(ids) ? ids.join(',') : String(ids);
    const data = await callJioSaavn({
      __call: 'song.getDetails',
      pids
    }, signal);

    const rawList = data?.songs || Object.values(data || {}).filter(item => item && typeof item === 'object' && item.id);
    const normalized = rawList.map(normalizeSong).filter(Boolean);

    return {
      status: 'SUCCESS',
      data: normalized,
      results: normalized
    };
  },

  // Playlist Details
  async getPlaylistDetails(id, signal) {
    const data = await callJioSaavn({
      __call: 'playlist.getDetails',
      listid: id
    }, signal);

    const normalized = normalizePlaylist(data);
    return {
      status: 'SUCCESS',
      data: normalized,
      results: normalized?.songs || []
    };
  },

  // Album Details
  async getAlbumDetails(id, signal) {
    const data = await callJioSaavn({
      __call: 'content.getAlbumDetails',
      albumid: id
    }, signal);

    const normalized = normalizeAlbum(data);
    return {
      status: 'SUCCESS',
      data: normalized,
      results: normalized?.songs || []
    };
  },

  // Song Suggestions / Recommendations
  async getSongSuggestions(id, limit = 20, signal) {
    try {
      const data = await callJioSaavn({
        __call: 'reco.getreco',
        pid: id
      }, signal);

      if (Array.isArray(data) && data.length > 0) {
        const normalized = data.map(normalizeSong).filter(Boolean);
        return {
          status: 'SUCCESS',
          data: normalized.slice(0, limit),
          results: normalized.slice(0, limit)
        };
      }
    } catch {
      // Fallback below
    }

    // High reliability fallback: Get song details, search by artist
    try {
      const songData = await this.getSongDetails(id, signal);
      const song = songData.data?.[0];
      if (song) {
        const query = song.primaryArtists?.split(',')[0]?.trim() || song.album?.name || song.title;
        const res = await this.searchSongs(query, 1, limit + 1, signal);
        const filtered = (res.data?.results || []).filter(s => s.id !== id).slice(0, limit);
        return {
          status: 'SUCCESS',
          data: filtered,
          results: filtered
        };
      }
    } catch (e) {
      console.error('[JioSaavnDirect Suggestions Error]:', e);
    }

    return { status: 'SUCCESS', data: [], results: [] };
  },

  // Song Lyrics
  async getSongLyrics(id, signal) {
    try {
      // First get song details to check lyrics_id
      const songData = await this.getSongDetails(id, signal);
      const song = songData.data?.[0];
      const lyricsId = song?.lyrics_id || song?.id || id;

      const data = await callJioSaavn({
        __call: 'lyrics.getLyrics',
        lyrics_id: lyricsId
      }, signal);

      if (data?.lyrics) {
        return {
          status: 'SUCCESS',
          data: {
            lyrics: data.lyrics,
            snippet: data.snippet || '',
            copyright: data.copyright || ''
          }
        };
      }
    } catch (e) {
      console.error('[JioSaavnDirect Lyrics Error]:', e);
    }

    return {
      status: 'SUCCESS',
      data: {
        lyrics: 'Lyrics not available for this track.',
        snippet: '',
        copyright: ''
      }
    };
  },

  // Artist Details
  async getArtistDetails(id, page = 1, limit = 20, signal) {
    const data = await callJioSaavn({
      __call: 'artist.getArtistPageDetails',
      artistId: id,
      p: page,
      n_song: limit
    }, signal);

    const name = decodeHtml(data.name || data.artistName || '');
    const songs = (data.topSongs || data.songs || []).map(normalizeSong).filter(Boolean);
    const albums = (data.topAlbums || data.albums || []).map(normalizeAlbum).filter(Boolean);

    return {
      status: 'SUCCESS',
      data: {
        id: String(data.artistId || id),
        name,
        image: formatImages(data.image),
        follower_count: data.follower_count || '0',
        topSongs: songs,
        songs,
        topAlbums: albums,
        albums
      }
    };
  }
};

