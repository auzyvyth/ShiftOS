/* eslint-env node */
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[auth] FATAL: JWT_SECRET env var is not set. Auth routes disabled.');
}

router.post('/login', (req, res) => {
  if (!JWT_SECRET) return res.status(503).json({ error: 'Auth not configured' });

  // This route is a legacy stub — production auth is handled by Supabase.
  // Enable only for local dev by setting JWT_SECRET and populating a real user store.
  return res.status(403).json({ error: 'Not available' });
});

export default router;
