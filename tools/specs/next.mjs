#!/usr/bin/env node
// Prints the next N models to collect, as a block to paste into PROMPT.md.
//
//   node tools/specs/next.mjs [count]        default 8
//
// "Next" means: still in backlog.json, not already collected in data/, and not
// already curated by hand in carSpecs.js. That is what lets each run pick up
// where the last one stopped without anybody tracking it in a spreadsheet.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const DATA_DIR = join(HERE, 'data');

const count = Number(process.argv[2]) || 8;
const norm = (s) => (s || '').toLowerCase().replace(/[-\s]+/g, '');
const key = (make, model) => `${norm(make)}|${norm(model)}`;

const backlog = JSON.parse(readFileSync(join(HERE, 'backlog.json'), 'utf8')).models;

// Already collected, in any batch.
const done = new Set();
if (existsSync(DATA_DIR)) {
  for (const f of readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))) {
    const doc = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
    for (const r of (Array.isArray(doc) ? doc : doc.specs) || []) done.add(key(r.make, r.model));
  }
}

// Already curated by hand. Those rows win over anything collected, so asking
// for them again wastes a run.
const curated = new Set();
const specs = readFileSync(join(ROOT, 'src', 'utils', 'carSpecs.js'), 'utf8');
const head = specs.includes('BEGIN') ? specs.slice(0, specs.indexOf('─── generated from')) : specs;
for (const m of head.matchAll(/make:\s*"([^"]+)",\s*model:\s*"([^"]+)"/g)) curated.add(key(m[1], m[2]));

const remaining = backlog.filter((b) => !done.has(key(b.make, b.model)) && !curated.has(key(b.make, b.model)));
const batch = remaining.slice(0, count);

console.log(`# ${done.size} collected, ${curated.size} already curated, ${remaining.length} of ${backlog.length} left\n`);
console.log('<targets>');
for (const b of batch) {
  const regs = b.regs ? `${b.regs.toLocaleString()} registrations 2023-Jul 2026` : 'no JPJ registrations under this name';
  const codes = b.chassis_codes?.length ? ` | known chassis codes: ${b.chassis_codes.join(' ')}` : ' | no chassis codes known - do not invent any';
  console.log(`- ${b.make} ${b.model}  (${regs})${codes}`);
}
console.log('</targets>');
console.log(`\n# after this batch: ${Math.max(0, remaining.length - batch.length)} models left`);
