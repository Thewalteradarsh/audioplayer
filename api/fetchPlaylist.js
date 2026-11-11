import { fetchSpotifyPlaylist } from '../functions/api/spotifyPlaylist.js';

function setCors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-app-client, X-App-Client, *');
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const parsedUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const playlistUrl = req.query?.playlistUrl || parsedUrl.searchParams.get('playlistUrl');
  const format = req.query?.format || parsedUrl.searchParams.get('format') || 'text';

  try {
    const data = await fetchSpotifyPlaylist(playlistUrl, format);
    if (format === 'json') {
      res.status(200).json(data);
      return;
    }
    res.status(200).json({ tracks: data.tracks });
  } catch (error) {
    console.error('[Vercel API fetchPlaylist Error]:', error);
    res.status(error.status || 500).json({
      error: error.message || 'Internal server error while fetching playlist',
    });
  }
}
