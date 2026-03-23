/* eslint-env node */
import express from 'express';

const router = express.Router();

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;

router.post('/messages', async (req, res) => {
  try {
    if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });

    const payload = req.body || {};
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANTHROPIC_KEY}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    // Try to parse JSON, otherwise return raw text
    try {
      const json = JSON.parse(text);
      return res.status(resp.status).json(json);
    } catch (e) {
      return res.status(resp.status).json({ raw: text });
    }
  } catch (err) {
    console.error('[anthropic proxy] error', err);
    return res.status(500).json({ error: 'Anthropic proxy failed' });
  }
});

export default router;
