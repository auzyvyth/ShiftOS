/* eslint-env node */
// Vercel Node.js serverless function — Anthropic Messages API proxy
// maxDuration is set in vercel.json (300s) to handle long PDF analyses

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });
  }

  const body = req.body || {};
  const { betas, ...anthropicBody } = body;

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (betas && betas.length > 0) {
    headers['anthropic-beta'] = betas.join(',');
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(anthropicBody),
    });

    const text = await resp.text();
    try {
      return res.status(resp.status).json(JSON.parse(text));
    } catch {
      return res.status(resp.status).json({ raw: text });
    }
  } catch (err) {
    console.error('[ai-messages] proxy error', err);
    return res.status(500).json({ error: 'Anthropic proxy failed: ' + err.message });
  }
}
