#!/usr/bin/env node
// SOCIAL-1 (Threads part): post the owner's APPROVED drafts to Threads through Meta's official
// Threads API (never a logged-in browser: that breaks Meta's terms and gets the
// account flagged). Runbook: tools/social/README.md.
//
//   node tools/social/threads.mjs whoami             check the token, print the account
//   node tools/social/threads.mjs due                list approved posts whose time has come
//   node tools/social/threads.mjs publish [--live]   post the due ones (dry run without --live)
//   node tools/social/threads.mjs insights           views/likes/replies for posted ones
//   node tools/social/threads.mjs refresh            renew the 60-day token, print the new one
//
// Secrets come from the environment ONLY: THREADS_ACCESS_TOKEN (+ THREADS_USER_ID,
// else "me"). Never put a token in this folder: the repo is public.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const API = 'https://graph.threads.net/v1.0';
const MAX_CHARS = 500; // Threads' limit per post
const QUEUE = join(dirname(fileURLToPath(import.meta.url)), 'queue.json');

const token = process.env.THREADS_ACCESS_TOKEN;
const userId = process.env.THREADS_USER_ID || 'me';

function readQueue() {
  return JSON.parse(readFileSync(QUEUE, 'utf8'));
}
function writeQueue(q) {
  writeFileSync(QUEUE, JSON.stringify(q, null, 2) + '\n');
}

// A post is due when a human approved it and its time has passed. Drafts never post.
export function duePosts(queue, now = new Date()) {
  return queue.posts.filter(
    (p) => p.status === 'approved' && (!p.post_at || new Date(p.post_at) <= now),
  );
}

export function checkText(text) {
  if (!text || !text.trim()) return 'empty';
  if ([...text].length > MAX_CHARS) return `over ${MAX_CHARS} characters`;
  if (/xdrive/i.test(text)) return 'says XDrive (the brand is Drevo now)';
  return null;
}

async function call(method, path, params = {}) {
  if (!token) throw new Error('THREADS_ACCESS_TOKEN is not set');
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${API}${path}?${qs}`, { method });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new Error(`${method} ${path}: ${body.error?.message || res.status}`);
  }
  return body;
}

async function publishOne(text) {
  // Two steps: make a container, then publish it. Meta advises a short wait between.
  const { id: creationId } = await call('POST', `/${userId}/threads`, {
    media_type: 'TEXT',
    text,
  });
  await new Promise((r) => setTimeout(r, 5000));
  const { id } = await call('POST', `/${userId}/threads_publish`, {
    creation_id: creationId,
  });
  return id;
}

async function main() {
  const [cmd, ...flags] = process.argv.slice(2);
  const live = flags.includes('--live');

  if (cmd === 'whoami') {
    console.log(await call('GET', `/${userId}`, { fields: 'id,username' }));
    console.log(
      await call('GET', `/${userId}/threads_publishing_limit`, {
        fields: 'quota_usage,config',
      }),
    );
    return;
  }

  if (cmd === 'refresh') {
    const body = await call('GET', '/refresh_access_token', {
      grant_type: 'th_refresh_token',
    });
    // Print only how long it lasts; the caller saves the token as a secret.
    console.log(`New token valid ${Math.round(body.expires_in / 86400)} days.`);
    console.log(body.access_token);
    return;
  }

  const queue = readQueue();

  if (cmd === 'due' || cmd === 'publish') {
    const due = duePosts(queue);
    if (!due.length) return console.log('Nothing due.');
    for (const p of due) {
      const problem = checkText(p.text);
      if (problem) {
        console.log(`SKIP ${p.id}: ${problem}`);
        continue;
      }
      if (cmd === 'due' || !live) {
        console.log(`${live ? '' : '[dry run] '}${p.id}: ${p.text.slice(0, 80)}`);
        continue;
      }
      try {
        p.threads_id = await publishOne(p.text);
        p.status = 'posted';
        p.posted_at = new Date().toISOString();
        console.log(`POSTED ${p.id} -> ${p.threads_id}`);
      } catch (e) {
        p.error = e.message;
        console.log(`FAILED ${p.id}: ${e.message}`);
      }
      writeQueue(queue); // after each post, so a crash never double-posts
    }
    return;
  }

  if (cmd === 'insights') {
    for (const p of queue.posts.filter((x) => x.threads_id)) {
      const { data } = await call('GET', `/${p.threads_id}/insights`, {
        metric: 'views,likes,replies,reposts,quotes,shares',
      });
      p.insights = Object.fromEntries(data.map((m) => [m.name, m.values?.[0]?.value ?? m.total_value?.value]));
      p.insights_at = new Date().toISOString();
      console.log(p.id, p.insights);
    }
    writeQueue(queue);
    return;
  }

  console.log('Commands: whoami | due | publish [--live] | insights | refresh');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
