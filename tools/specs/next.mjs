#!/usr/bin/env node
// Prints the next N models to collect, as a block to paste into PROMPT.md.
//
//   node tools/specs/next.mjs [count]        default 4
//
// Schema 3.0 collects every trim of every generation, so a model is ~5x the
// output it was in 2.0 - hence 4 models a run, not 8.
//
// "Next" means: not yet collected in a 3.0 batch. Models on the `priority`
// list in backlog.json (what dealers actually list) come first, then the
// registration-ranked backlog. Curated carSpecs.js rows no longer exclude a
// model: they hold one trim per generation, and 3.0 is exactly the re-collect
// that gives them the rest.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, 'data');

const count = Number(process.argv[2]) || 4;
const norm = (s) => (s || '').toLowerCase().replace(/[-\s]+/g, '');
const key = (make, model) => `${norm(make)}|${norm(model)}`;

const { models: backlog, priority = [] } = JSON.parse(readFileSync(join(HERE, 'backlog.json'), 'utf8'));

// Already collected with every trim. A 2.0 batch does not count.
const done = new Set();
if (existsSync(DATA_DIR)) {
  for (const f of readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))) {
    const doc = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
    if (Array.isArray(doc) || String(doc.schema_version) !== '3.0') continue;
    for (const r of doc.specs || []) done.add(key(r.make, r.model));
    for (const s of doc.skipped || []) if (s.whole_model) done.add(key(s.make, s.model));
  }
}

const byKey = new Map(backlog.map((b) => [key(b.make, b.model), b]));
const ordered = [];
const queued = new Set();
for (const m of [...priority, ...backlog]) {
  const k = key(m.make, m.model);
  if (queued.has(k)) continue;
  queued.add(k);
  ordered.push({ ...byKey.get(k), ...m, priority: priority.some((p) => key(p.make, p.model) === k) });
}

const remaining = ordered.filter((m) => !done.has(key(m.make, m.model)));
const batch = remaining.slice(0, count);

console.log(`# 3.0 catalogue: ${done.size} models collected, ${remaining.length} of ${ordered.length} left\n`);
console.log('<targets>');
for (const b of batch) {
  const why = b.priority ? 'listed by dealers on the platform'
    : b.regs ? `${b.regs.toLocaleString()} registrations 2023-Jul 2026` : 'no JPJ registrations under this name';
  const codes = b.chassis_codes?.length ? ` | known chassis codes: ${b.chassis_codes.join(' ')}` : '';
  console.log(`- ${b.make} ${b.model}  (${why})${codes}`);
}
console.log('</targets>');
console.log(`\n# after this batch: ${Math.max(0, remaining.length - batch.length)} models left`);
