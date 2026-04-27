/* eslint-env node */
import express from 'express';

const router = express.Router();

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const REMOVEBG_KEY  = process.env.REMOVEBG_API_KEY;

// ── POST /ai/messages — proxy to Anthropic, supports streaming ─────────────────
router.post('/messages', async (req, res) => {
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });

  const payload  = req.body || {};
  const isStream = payload.stream === true;

  let resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[anthropic proxy] fetch error', err);
    return res.status(500).json({ error: 'Anthropic proxy failed' });
  }

  if (isStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    // resp.body is a WHATWG ReadableStream — read with a reader, not .on()
    const reader = resp.body.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); break; }
          res.write(Buffer.from(value));
        }
      } catch (err) {
        console.error('[anthropic stream]', err);
        res.end();
      }
    };
    pump();
    return;
  }

  const text = await resp.text();
  try {
    return res.status(resp.status).json(JSON.parse(text));
  } catch {
    return res.status(resp.status).json({ raw: text });
  }
});

// ── POST /ai/removebg — proxy to remove.bg ────────────────────────────────────
router.post('/removebg', async (req, res) => {
  if (!REMOVEBG_KEY) return res.status(500).json({ error: 'Server missing REMOVEBG_API_KEY' });

  const { image_base64, size = 'auto' } = req.body || {};
  if (!image_base64) return res.status(400).json({ error: 'Missing image_base64' });

  try {
    const resp = await fetch('https://api.remove.bg/v1.0/removebg', {
      method:  'POST',
      headers: {
        'X-Api-Key':    REMOVEBG_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_file_b64: image_base64, size }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: err?.errors?.[0]?.title || `remove.bg error ${resp.status}` });
    }

    res.setHeader('Content-Type', 'image/png');
    const reader = resp.body.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); break; }
          res.write(Buffer.from(value));
        }
      } catch (err) {
        console.error('[removebg proxy]', err);
        res.end();
      }
    };
    pump();
  } catch (err) {
    console.error('[removebg proxy] error', err);
    res.status(500).json({ error: 'remove.bg proxy failed' });
  }
});

export default router;
