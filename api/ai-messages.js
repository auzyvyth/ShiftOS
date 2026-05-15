/* eslint-env node */
// Vercel Node.js serverless function — Anthropic Messages API proxy
// Uses streaming to keep connection alive during long PDF analyses

export const config = {
  api: {
    bodyParser: { sizeLimit: '25mb' },
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

  const { betas, ...anthropicBody } = req.body || {};

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (betas?.length) headers['anthropic-beta'] = betas.join(',');

  let resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...anthropicBody, stream: true }),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Anthropic unreachable: ' + err.message });
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    return res.status(resp.status).json(err);
  }

  // Stream SSE events to client — keeps connection alive, bypasses gateway timeouts
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  const reader = resp.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch (err) {
    console.error('[ai-messages] stream error', err);
  }
  res.end();
}
