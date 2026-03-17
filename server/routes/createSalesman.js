/* eslint-env node */
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Uses the service role key — never expose this to the client
const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.post('/', async (req, res) => {
  try {
    const { email, password, profile } = req.body;

    if (!email || !password || !profile) {
      return res.status(400).json({ error: 'Missing email, password, or profile.' });
    }

    if (!profile.full_name || !profile.slug || !profile.dealership) {
      return res.status(400).json({ error: 'Profile must include full_name, slug, and dealership.' });
    }

    // Check slug uniqueness via admin client (bypasses RLS)
    const { data: existing, error: checkErr } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('slug', profile.slug)
      .maybeSingle();

    if (checkErr) {
      return res.status(500).json({ error: 'Failed to check slug uniqueness.' });
    }

    if (existing) {
      return res.status(409).json({ error: 'That slug is already taken. Try another one.' });
    }

    // Create the auth user without touching the client session
    const { data: userData, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: profile,
    });

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    const userId = userData.user.id;

    // Insert profile as admin — bypasses RLS entirely
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: profile.full_name,
        email,
        phone: profile.phone || null,
        dealership: profile.dealership,
        role: 'salesman',
        slug: profile.slug,
        is_active: true,
      });

    if (profileError) {
      // Rollback: delete the auth user we just created so nothing is orphaned
      try { await adminSupabase.auth.admin.deleteUser(userId); } catch (e) {}
      return res.status(500).json({ error: 'Account created but profile failed: ' + profileError.message });
    }

    res.status(201).json({ success: true, id: userId });
  } catch (err) {
    console.error('[create-salesman]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
