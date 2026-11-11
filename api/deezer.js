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
  let endpoint = req.query?.endpoint || parsedUrl.searchParams.get('endpoint');

  if (!endpoint) {
    res.status(400).json({ error: 'Missing Deezer endpoint parameter' });
    return;
  }

  parsedUrl.searchParams.delete('endpoint');
  const qs = parsedUrl.searchParams.toString();
  if (qs) {
    endpoint += (endpoint.includes('?') ? '&' : '?') + qs;
  }

  try {
    const deezerRes = await fetch(`https://api.deezer.com/${endpoint}`);
    const data = await deezerRes.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

