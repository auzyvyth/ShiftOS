/* eslint-env node */
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /invites?dealership=Xdrive
router.get('/', async (req, res) => {
  try {
    const { dealership } = req.query;
    if (!dealership) return res.status(400).json({ message: 'Missing dealership' });

    const { data, error } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('role', 'salesman')
      .eq('dealership', dealership)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ message: error.message });
    res.json({ invites: data || [] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch team' });
  }
});

// POST /invites — create salesman auth + profile
router.post('/', async (req, res) => {
  try {
    const { full_name, email, phone, dealership, slug, password } = req.body;

    // Validate
    if (!full_name || !email || !slug || !dealership || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    if (!/^[a-z0-9]+$/.test(slug)) {
      return res.status(400).json({ message: 'Slug can only contain lowercase letters and numbers' });
    }

    // Check slug uniqueness
    const { data: existing } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ message: 'That slug is already taken' });
    }

    // Create auth user
    const { data: userData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (authError) return res.status(400).json({ message: authError.message });

    const userId = userData.user.id;

    // Insert profile into Supabase
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .insert({
        id: userId,
        full_name,
        email,
        phone: phone || null,
        dealership,
        role: 'salesman',
        slug,
        is_active: true,
      })
      .select()
      .single();

    if (profileError) {
      // Rollback auth user
      try { await adminSupabase.auth.admin.deleteUser(userId); } catch (e) {}
      return res.status(500).json({ message: profileError.message });
    }

    res.status(201).json({ invite: profile });
  } catch (err) {
    console.error('[invites POST]', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /invites/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete auth user (cascades to profile via trigger, or delete manually)
    await adminSupabase.auth.admin.deleteUser(id);

    // Also delete profile row directly to be safe
    const { error } = await adminSupabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ message: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete salesman' });
  }
});

export default router;