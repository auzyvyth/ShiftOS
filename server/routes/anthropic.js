/* eslint-env node */
import express from 'express';
import { guardAiRequest } from '../../lib/aiGuard.js';

const router = express.Router();

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// ── POST /ai/messages — proxy to Anthropic, supports streaming ─────────────────
// Hardened: requires a valid Supabase session, resolves dealer scope (every
// sub-role shares its parent dealer's quota + assistant), pins model/max_tokens
// server-side per feature, enforces shared per-dealer daily quota.
// See lib/aiGuard.js for the policy shared with the Vercel twin + edge function.
router.post('/messages', async (req, res) => {
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });

  const { feature, system, messages } = req.body || {};

  const guard = await guardAiRequest(req, feature);
  if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

  const finalSystem = system ? `${guard.roleContext}\n\n${system}` : guard.roleContext;
  const isStream = guard.stream;

  const payload = {
    model: guard.model,
    max_tokens: guard.maxTokens,
    system: finalSystem,
    messages,
    ...(isStream ? { stream: true } : {}),
  };

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

export default router;
