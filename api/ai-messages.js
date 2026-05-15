/* eslint-env node */
// Vercel serverless function — proxies to Anthropic Messages API
// Handles large base64 PDF payloads (up to 20mb)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
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

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
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
