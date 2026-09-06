#!/usr/bin/env node
// Reads every collected batch in tools/specs/data, validates it, and rewrites
// the generated block of src/utils/carSpecs.js.
//
// The JSON files are the master. This file is a projection of them, so a bad
// row is fixed in the batch and regenerated, never hand-edited in the output -
// the next run would overwrite the correction and nobody would notice.
//
//   node tools/specs/generate.mjs [--check]
//
// --check validates and reports without writing, which is what CI wants.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRows, toCarSpecsRow } from './lib/validate.mjs';
import { decodeChassis } from '../../src/utils/chassisDecode.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const DATA_DIR = join(HERE, 'data');
const TARGET = join(ROOT, 'src', 'utils', 'carSpecs.js');
const DECODER = join(ROOT, 'src', 'utils', 'chassisDecode.js');

const BEGIN = '  // ─── generated from tools/specs/data — do not edit by hand ─── BEGIN';
const END   = '  // ─── generated ─── END';

const checkOnly = process.argv.includes('--check');

function loadBatches() {
  if (!existsSync(DATA_DIR)) return [];
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).sort();
  const rows = [];
  for (const f of files) {
    let doc;
    try {
      doc = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
    } catch (e) {
      console.error(`${f}: not valid JSON - ${e.message}`);
      process.exit(1);
    }
    const specs = Array.isArray(doc) ? doc : doc.specs;
    if (!Array.isArray(specs)) {
      console.error(`${f}: expected an array, or an object with a "specs" array`);
      process.exit(1);
    }
    specs.forEach((r, i) => rows.push({ ...r, _file: basename(f), _index: i }));
  }
  return rows;
}

// The hand-curated rows above the marker. They are the ones a person wrote and
// checked, so on a collision they win and the generated row is dropped.
//
// yearTo is read as well as yearFrom because the validator needs the whole
// range: an exact yearFrom match is a designed skip, but a collected row that
// merely OVERLAPS a curated one is a dead row and has to fail the run.
function handRows(text) {
  const head = text.includes(BEGIN) ? text.slice(0, text.indexOf(BEGIN)) : text;
  const out = [];
  const re = /make:\s*"([^"]+)",\s*model:\s*"([^"]+)",\s*yearFrom:\s*(\d+),\s*yearTo:\s*(\d+)/g;
  let m;
  while ((m = re.exec(head))) {
    out.push({ make: m[1], model: m[2], yearFrom: Number(m[3]), yearTo: Number(m[4]) });
  }
  return out;
}

const norm = (s) => (s || '').toLowerCase().replace(/[-\s]+/g, '');
const key = (make, model, yearFrom) => `${norm(make)}|${norm(model)}|${yearFrom}`;

function fmt(v) {
  if (v === null || v === undefined) return 'null';
  return typeof v === 'string' ? JSON.stringify(v) : String(v);
}

function renderRow(r) {
  return (
    `  { make:${fmt(r.make)}, model:${fmt(r.model)}, yearFrom:${r.yearFrom}, yearTo:${r.yearTo}, ` +
    `engine_cc:${fmt(r.engine_cc)}, cylinders:${fmt(r.cylinders)}, transmission:${fmt(r.transmission)}, ` +
    `fuel_type:${fmt(r.fuel_type)}, body_type:${fmt(r.body_type)}, horsepower:${fmt(r.horsepower)}, ` +
    `doors:${fmt(r.doors)}, seats:${fmt(r.seats)}, fuel_consumption:${fmt(r.fuel_consumption)} },`
  );
}

// Chassis codes are collected but carSpecs.js has nowhere to put them. Report
// the ones the app cannot resolve rather than patching it: a code may need an
// `alt` (Type R, hybrid, 450h) and getting that wrong makes the decoder fill
// the wrong specs, which is the one outcome worse than filling nothing.
//
// Ask decodeChassis itself. Grepping chassisDecode.js for the key misses every
// European code, because those live in chassisCodes.js and are resolved through
// chassisSearch - which reported all 18 BMW codes as missing when the index
// already held most of them. A report that cries wolf gets ignored.
function chassisGaps(rows) {
  const gaps = [];
  for (const r of rows) {
    const missing = (r.chassis_codes || []).filter((c) => !decodeChassis(c));
    if (missing.length) gaps.push({ make: r.make, model: r.model, year_from: r.year_from, missing });
  }
  return gaps;
}

const rows = loadBatches();
if (!rows.length) {
  console.log('No batches in tools/specs/data - nothing to generate.');
  process.exit(0);
}

// Read carSpecs.js before validating, not after: the curated rows are an input
// to the check, not just to the collision skip below.
const text = readFileSync(TARGET, 'utf8');
const handList = handRows(text);

const { errors, warnings, ok } = validateRows(rows, handList);
for (const w of warnings) console.log(`  warn  ${w}`);
if (!ok) {
  console.error(`\n${errors.length} error(s) - nothing was written:\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

const hand = new Set(handList.map((r) => key(r.make, r.model, r.yearFrom)));

const kept = [];
const skipped = [];
const seen = new Set();
for (const r of rows) {
  const out = toCarSpecsRow(r);
  const k = key(out.make, out.model, out.yearFrom);
  if (hand.has(k)) { skipped.push(`${out.make} ${out.model} ${out.yearFrom} - already curated by hand`); continue; }
  if (seen.has(k)) { skipped.push(`${out.make} ${out.model} ${out.yearFrom} - duplicate across batches`); continue; }
  seen.add(k);
  kept.push(out);
}

kept.sort((a, b) =>
  a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.yearFrom - b.yearFrom);

const block = [BEGIN, ...kept.map(renderRow), END].join('\n');

let next;
if (text.includes(BEGIN)) {
  const start = text.indexOf(BEGIN);
  const stop = text.indexOf(END) + END.length;
  next = text.slice(0, start) + block + text.slice(stop);
} else {
  const close = text.lastIndexOf('\n];');
  if (close === -1) { console.error('Could not find the end of the SPECS array in carSpecs.js'); process.exit(1); }
  next = text.slice(0, close) + '\n\n' + block + text.slice(close);
}

const gaps = chassisGaps(rows);

console.log(`\n${rows.length} collected row(s) across ${new Set(rows.map((r) => r._file)).size} batch file(s)`);
console.log(`${kept.length} written to carSpecs.js, ${skipped.length} skipped`);
for (const s of skipped) console.log(`  skip  ${s}`);

if (gaps.length) {
  console.log(`\nChassis codes the decoder does not know (add to src/utils/chassisDecode.js by hand):`);
  for (const g of gaps) console.log(`  ${g.make} ${g.model} ${g.year_from}: ${g.missing.join(', ')}`);
}

if (checkOnly) {
  const same = next === text;
  console.log(`\n--check: carSpecs.js is ${same ? 'up to date' : 'STALE - run npm run specs:build'}`);
  process.exit(same ? 0 : 1);
}

if (next === text) {
  console.log('\ncarSpecs.js already up to date.');
} else {
  writeFileSync(TARGET, next);
  console.log(`\nWrote ${kept.length} generated row(s) into src/utils/carSpecs.js`);
}
