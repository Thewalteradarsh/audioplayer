import { executeJioSaavnRequest } from '../functions/api/jiosaavnRouter.js';

function setCors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-app-client, X-App-Client, *');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const parsedUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const endpoint =
    req.query?.endpoint ||
    parsedUrl.searchParams.get('endpoint') ||
    parsedUrl.pathname.replace(/^\/api\/jiosaavn\/?/, '').replace(/^\/api\/?/, '');

  if (!endpoint) {
    res.status(400).json({ error: 'Missing endpoint parameter' });
    return;
  }

  const queryParams = {};
  parsedUrl.searchParams.forEach((value, key) => {
    if (key !== 'endpoint') {
      queryParams[key] = value;
    }
  });
  if (req.query && typeof req.query === 'object') {
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'endpoint' && value !== undefined) {
        queryParams[key] = Array.isArray(value) ? value[0] : value;
      }
    });
  }

  try {
    const data = await executeJioSaavnRequest(String(endpoint), queryParams);
    res.status(200).json(data);
  } catch (err) {
    console.error('[Vercel JioSaavn API Error]:', err);
    res.status(502).json({
      error: 'Failed to fetch music data from all JioSaavn API instances.',
      details: err.message,
    });
  }
}
