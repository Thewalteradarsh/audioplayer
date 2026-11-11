import { fetchSpotifyPlaylist } from './spotifyPlaylist.js';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const origin = request.headers.get('Origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-app-client, X-App-Client, *'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const playlistUrl = url.searchParams.get('playlistUrl');
  const format = url.searchParams.get('format') || 'text';

  try {
    const data = await fetchSpotifyPlaylist(playlistUrl, format);
    if (format === 'json') {
      return Response.json(data, { headers: corsHeaders });
    }
    return Response.json({ tracks: data.tracks }, { headers: corsHeaders });
  } catch (error) {
    console.error('Server API Error:', error);
    return Response.json(
      { error: error.message || 'Internal server error while fetching playlist' },
      { status: error.status || 500, headers: corsHeaders }
    );
  }
}
