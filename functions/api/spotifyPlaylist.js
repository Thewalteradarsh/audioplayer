/**
 * Shared Spotify Playlist / Album embed scraper.
 * Used by Cloudflare Pages Functions, Vercel Serverless Functions, and Vite local dev proxy.
 */
export async function fetchSpotifyPlaylist(playlistUrl, format = 'text') {
  if (!playlistUrl || !/(open\.spotify\.com\/(playlist|s|album)\/|spotify\.link\/|spoti\.fi\/)/i.test(playlistUrl)) {
    const err = new Error('Invalid or missing Spotify URL');
    err.status = 400;
    throw err;
  }

  let finalUrl = playlistUrl.trim();

  // Resolve short links first
  if (finalUrl.includes('spotify.link/') || finalUrl.includes('spoti.fi/') || finalUrl.includes('open.spotify.com/s/')) {
    const redirectResponse = await fetch(finalUrl, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const location = redirectResponse.headers.get('location');
    if (!location) {
      const err = new Error('Failed to resolve short link: no location header found');
      err.status = 400;
      throw err;
    }
    finalUrl = location;
  }

  let embedUrl = finalUrl;
  if (finalUrl.includes('/playlist/')) {
    const match = finalUrl.match(/\/playlist\/([a-zA-Z0-9]+)/);
    if (!match) {
      const err = new Error('Invalid Spotify playlist URL');
      err.status = 400;
      throw err;
    }
    embedUrl = `https://open.spotify.com/embed/playlist/${match[1]}`;
  } else if (finalUrl.includes('/album/')) {
    const match = finalUrl.match(/\/album\/([a-zA-Z0-9]+)/);
    if (!match) {
      const err = new Error('Invalid Spotify album URL');
      err.status = 400;
      throw err;
    }
    embedUrl = `https://open.spotify.com/embed/album/${match[1]}`;
  } else {
    const err = new Error('Could not extract playlist or album ID from URL');
    err.status = 400;
    throw err;
  }

  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    const err = new Error(`Spotify API blocked the request: ${response.status} ${response.statusText}`);
    err.status = response.status;
    throw err;
  }

  const html = await response.text();
  const tagStart = '<script id="__NEXT_DATA__" type="application/json">';
  const startIdx = html.indexOf(tagStart);

  if (startIdx === -1) {
    const err = new Error('Metadata block not found in Spotify response');
    err.status = 500;
    throw err;
  }

  const jsonStart = startIdx + tagStart.length;
  const jsonEnd = html.indexOf('</script>', jsonStart);
  const rawJson = html.substring(jsonStart, jsonEnd);

  const parsed = JSON.parse(rawJson);
  const entity = parsed?.props?.pageProps?.state?.data?.entity;
  const trackList = entity?.trackList || [];

  if (trackList.length === 0) {
    const err = new Error('No tracks found in the playlist');
    err.status = 404;
    throw err;
  }

  const cleanText = (val) => String(val || '').replace(/\u00a0/g, ' ').trim();

  if (format === 'json') {
    const formattedJson = trackList.map((t, index) => ({
      rank: index + 1,
      id: t.uid || t.id || `track_${index}`,
      title: cleanText(t.title),
      artists: cleanText(t.subtitle),
      albumArt: t.coverArt?.sources?.[0]?.url || '',
      durationMs: t.duration || 0,
      previewUrl: t.audioPreview?.url || null,
    }));

    return {
      name: cleanText(entity?.name) || 'Playlist',
      tracks: formattedJson,
    };
  }

  const formattedTracks = trackList
    .map((t) => `${cleanText(t.title)} - ${cleanText(t.subtitle)}`)
    .filter((line) => line !== ' - ' && line !== '-')
    .join('\n');

  return {
    name: cleanText(entity?.name) || 'Playlist',
    tracks: formattedTracks,
  };
}

