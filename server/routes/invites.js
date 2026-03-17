/* eslint-env node */
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'invites.json');

async function ensureDataFile() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.access(dataFile);
  } catch (err) {
    await fs.writeFile(dataFile, '[]', 'utf8');
  }
}

async function readInvites() {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

async function writeInvites(invites) {
  await fs.writeFile(dataFile, JSON.stringify(invites, null, 2), 'utf8');
}

router.get('/', async (req, res) => {
  try {
    const { dealership } = req.query;
    let invites = await readInvites();
    if (dealership) invites = invites.filter(i => i.dealership === dealership);
    res.json({ invites });
  } catch (err) {
    res.status(500).json({ message: 'Failed to read invites' });
  }
});

router.post('/', async (req, res) => {
  try {
    const invite = req.body;
    if (!invite || !invite.id || !invite.email) return res.status(400).json({ message: 'Missing invite fields' });
    const invites = await readInvites();
    const exists = invites.find(i => i.id === invite.id || (invite.email && i.email === invite.email) || (invite.slug && i.slug === invite.slug));
    if (exists) return res.status(409).json({ message: 'Invite already exists' });
    invite.created_at = invite.created_at || new Date().toISOString();
    invites.unshift(invite);
    await writeInvites(invites);
    res.status(201).json({ invite });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create invite' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let invites = await readInvites();
    const before = invites.length;
    invites = invites.filter(i => i.id !== id);
    if (invites.length === before) return res.status(404).json({ message: 'Invite not found' });
    await writeInvites(invites);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete invite' });
  }
});

export default router;
