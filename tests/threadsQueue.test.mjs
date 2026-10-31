import assert from 'node:assert/strict';
import { duePosts, checkText } from '../tools/threads/threads.mjs';

const now = new Date('2026-11-01T10:00:00Z');
const q = {
  posts: [
    { id: 'a', status: 'draft', post_at: null, text: 'x' },
    { id: 'b', status: 'approved', post_at: '2026-11-01T09:00:00Z', text: 'x' },
    { id: 'c', status: 'approved', post_at: '2026-11-02T09:00:00Z', text: 'x' },
    { id: 'd', status: 'posted', post_at: null, text: 'x' },
    { id: 'e', status: 'approved', post_at: null, text: 'x' },
  ],
};
assert.deepEqual(duePosts(q, now).map((p) => p.id), ['b', 'e']); // never drafts, never future, never twice

assert.equal(checkText('Hello'), null);
assert.equal(checkText('  '), 'empty');
assert.match(checkText('a'.repeat(501)), /over 500/);
assert.equal(checkText('😀'.repeat(500)), null); // counted as characters, not bytes
assert.match(checkText('Cari kereta di XDrive'), /Drevo/);

console.log('threads queue: ok');
