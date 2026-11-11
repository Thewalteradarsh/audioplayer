import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { executeJioSaavnRequest } from './functions/api/jiosaavnRouter.js'
import { fetchSpotifyPlaylist } from './functions/api/spotifyPlaylist.js'

// Helper for local development API handling
async function handleLocalApi(req, res) {
  const parsedUrl = new URL(req.url, 'http://localhost:5173');
  const origin = req.headers.origin || '*';
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-app-client, X-App-Client, *');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  const pathname = parsedUrl.pathname;

  // 1. Spotify playlist fetcher
  if (pathname === '/api/fetchPlaylist') {
    const playlistUrl = parsedUrl.searchParams.get('playlistUrl');
    const format = parsedUrl.searchParams.get('format') || 'text';
    try {
      const data = await fetchSpotifyPlaylist(playlistUrl, format);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(format === 'json' ? data : { tracks: data.tracks }));
      return true;
    } catch (err) {
      console.error('[Dev API fetchPlaylist Error]:', err);
      res.writeHead(err.status || 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // 2. Groq AI Mix Curator
  if (pathname === '/api/groqCurate') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsedBody = body ? JSON.parse(body) : {};
        const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
        if (!GROQ_API_KEY) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing GROQ_API_KEY in environment' }));
          return;
        }
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify(parsedBody)
        });
        const groqData = await groqRes.json();
        res.writeHead(groqRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(groqData));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return true;
  }

  // 3. Deezer API Proxy
  if (pathname === '/api/deezer') {
    let endpoint = parsedUrl.searchParams.get('endpoint');
    if (!endpoint) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing Deezer endpoint' }));
      return true;
    }
    parsedUrl.searchParams.delete('endpoint');
    const qs = parsedUrl.searchParams.toString();
    if (qs) endpoint += (endpoint.includes('?') ? '&' : '?') + qs;
    try {
      const deezerRes = await fetch(`https://api.deezer.com/${endpoint}`);
      const deezerData = await deezerRes.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(deezerData));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return true;
  }

  // 4. JioSaavn Multi-Instance APIs with Automatic Fallback (all other /api/* routes)
  try {
    let endpoint = parsedUrl.searchParams.get('endpoint');
    if (!endpoint) {
      // Strip leading /api or /api/
      endpoint = pathname.replace(/^\/api\/?/, '');
    }

    const queryParams = {};
    parsedUrl.searchParams.forEach((value, key) => {
      if (key !== 'endpoint') {
        queryParams[key] = value;
      }
    });

    const data = await executeJioSaavnRequest(endpoint, queryParams);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('[Dev Server API Fallback Error]:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
    return true;
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://saavn.dev/api',
        changeOrigin: true,
        secure: false,
        bypass: async (req, res) => {
          if (req.url && req.url.startsWith('/api')) {
            await handleLocalApi(req, res);
            return false; // Request handled, do not forward to target
          }
        }
      }
    }
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Hear Music',
        short_name: 'Hear',
        description: 'Stream high-bitrate music with offline playback',
        start_url: '/',
        scope: '/',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/hear-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2}', 'pwa-*.png'],
        // Exclude audio caching from workbox, we handle that in idb
        runtimeCaching: [],
        maximumFileSizeToCacheInBytes: 5242880 // 5 MiB
      }
    })
  ],
})
