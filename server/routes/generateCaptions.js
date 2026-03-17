/* eslint-env node */
import express from 'express';

const router = express.Router();

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

router.post('/', async (req, res) => {
  try {
    if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });

    const { listing, hookText } = req.body || {};
    if (!listing) return res.status(400).json({ error: 'Missing listing data' });

    const prompt = `You are a professional automotive social media copywriter for a Malaysian car dealership called "${listing.dealership_name || 'the dealership'}".

Generate TikTok/Reels slide captions for this car listing:
- Brand & Model: ${listing.brand} ${listing.model} ${listing.variant || ''}
- Year: ${listing.year || 'N/A'}
- Condition: ${listing.condition}
- Mileage: ${listing.mileage ? Number(listing.mileage).toLocaleString() + ' km' : 'N/A'}
- Price: ${listing.selling_price ? 'RM ' + Number(listing.selling_price).toLocaleString() : 'N/A'}
- Location: ${listing.state || 'Malaysia'}
${hookText ? `- Manager's custom hook: "${hookText}"` : ''}

Generate captions in BOTH English and Bahasa Malaysia. Tone: professional, structured, dealership-branded. Keep each line SHORT (max 8 words). No hashtags. No emojis except in cta_sub.

Respond ONLY with this exact JSON (no markdown, no explanation):
{
  "en": {
    "hook": "short punchy hook line",
    "specs_headline": "short headline for specs slide",
    "price_headline": "short headline for price slide",
    "cta": "call to action line",
    "cta_sub": "sub line with emoji, e.g. DM us now 📲"
  },
  "bm": {
    "hook": "same in Bahasa Malaysia",
    "specs_headline": "same in Bahasa Malaysia",
    "price_headline": "same in Bahasa Malaysia",
    "cta": "same in Bahasa Malaysia",
    "cta_sub": "same in Bahasa Malaysia with emoji"
  }
}`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANTHROPIC_KEY}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const raw = await resp.text();

    // Try to extract JSON payload from the model response
    let parsed = null;
    try {
      // First try: response is JSON with a content field
      const obj = JSON.parse(raw);
      // find a text block inside the response
      let textBlock = '';
      if (Array.isArray(obj.content)) {
        textBlock = obj.content.find(c => c.type === 'text')?.text || obj.content.map(c => c.text || '').join('\n');
      } else if (obj?.messages) {
        textBlock = obj.messages.map(m => (m?.content || []).map(c => c.text || '').join('')).join('\n');
      } else if (obj?.completion) {
        textBlock = obj.completion;
      }
      if (!textBlock) textBlock = JSON.stringify(obj);
      const clean = textBlock.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      // fallback: maybe the raw text itself contains the JSON
      try {
        const clean = raw.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch (e2) {
        return res.status(500).json({ error: 'Failed to parse AI response', raw });
      }
    }

    return res.json({ result: parsed });
  } catch (err) {
    console.error('[generate-captions] error', err);
    return res.status(500).json({ error: 'Caption generation failed' });
  }
});

export default router;
