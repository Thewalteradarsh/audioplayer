import { executeJioSaavnRequest } from './jiosaavnRouter.js';

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-app-client, X-App-Client, *',
    'Access-Control-Max-Age': '86400',
  };
}

export async function onRequest(context) {
  const { request } = context;
  const corsHeaders = getCorsHeaders(request);
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const endpoint = url.searchParams.get('endpoint') || url.pathname.replace(/^\/api\/jiosaavn\/?/, '') || url.pathname.replace(/^\/api\/?/, '');
  
  if (!endpoint) {
    return Response.json({ error: 'Missing endpoint parameter' }, { status: 400, headers: corsHeaders });
  }

  // Collect all search params except 'endpoint'
  const queryParams = {};
  url.searchParams.forEach((value, key) => {
    if (key !== 'endpoint') {
      queryParams[key] = value;
    }
  });

  try {
    const data = await executeJioSaavnRequest(endpoint, queryParams);
    return Response.json(data, { headers: corsHeaders });
  } catch (err) {
    console.error('[JioSaavn API Error]:', err);
    return Response.json({ 
      error: 'Failed to fetch music data from all JioSaavn API instances.',
      details: err.message 
    }, { status: 502, headers: corsHeaders });
  }
}
