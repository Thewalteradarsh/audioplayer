export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-app-client, X-App-Client, *'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  const GROQ_API_KEY = env?.GROQ_API_KEY || (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY : '');
  if (!GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing GROQ_API_KEY in environment" }), { status: 500, headers: corsHeaders });
  }

  try {
    const body = await request.json();

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      throw new Error(`Groq API Network Error: ${res.status}`);
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}
