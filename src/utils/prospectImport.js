// PROSPECT-IMPORT (2026-11-04): paste a hand-collected list into the console's
// Prospects tab. The owner finds advisors one by one in Facebook groups and
// TikTok lives and keeps them in a sheet; this turns pasted rows into prospect
// rows, and says which lines it skipped and why. Pure, no network:
// `npm run test:prospects`.
//
// It is NOT a scraper target: a paste is capped at MAX_PASTE rows, and every row
// is still a person the owner picked and will message one-to-one.

import { normalizePhone, isValidMyPhone } from "../lib/phone.js";

export const MAX_PASTE = 100;

// Mirror of SQL prospect_clean_url() (migration 20261104a). One person, one
// link: www./m./web., ?tracking and trailing slashes do not make a new person.
export function cleanProfileUrl(raw) {
  let u = String(raw ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^(www\.|m\.|web\.)/, "");
  if (!u) return null;
  const fb = u.match(/^([^/]+)\/profile\.php\?(?:.*&)?id=(\d+)/);
  if (fb) return `${fb[1]}/profile.php?id=${fb[2]}`;
  const tt = u.match(/^(tiktok\.com\/@[^/?#]+)/);
  if (tt) return tt[1];
  u = u.replace(/[?#].*$/, "").replace(/\/+$/, "");
  return u || null;
}

const looksLikeUrl = (s) => /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/|$)/i.test(s.trim());

// Which channel a link came from, so the console can say which one converts.
export function sourceFromUrl(url) {
  if (!url) return null;
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)/.test(url)) return "facebook";
  if (/(^|\.)tiktok\.com/.test(url)) return "tiktok";
  return "social";
}

function splitLine(line) {
  const sep = line.includes("\t") ? "\t" : line.includes("|") ? "|" : ",";
  return line.split(sep).map((c) => c.trim());
}

// Columns can come in any order and any can be missing: the link and the phone
// are found by what they look like; the rest are read in order as
// name, brand, area, note.
export function parseProspectLine(line) {
  const cells = splitLine(line).filter((c) => c !== "");
  let profile_url = null;
  let phone = null;
  const rest = [];
  for (const c of cells) {
    if (!profile_url && looksLikeUrl(c)) profile_url = cleanProfileUrl(c);
    else if (!phone && /\d{7,}/.test(c.replace(/[\s-]/g, "")) && isValidMyPhone(c)) phone = normalizePhone(c);
    else rest.push(c);
  }
  const [name = "", brand = "", area = "", ...note] = rest;
  return { name, profile_url, phone, brand: brand || null, area: area || null, notes: note.join(", ") || null };
}

// existing: the rows already in platform_prospects (with their stored, cleaned
// profile_url and canonical phone). Returns rows to insert + skipped lines.
export function parseProspectPaste(text, existing = [], { kind = "salesman" } = {}) {
  const byUrl = new Map();
  const byPhone = new Map();
  for (const r of existing) {
    if (r.profile_url) byUrl.set(r.profile_url, r);
    if (r.phone) byPhone.set(r.phone, r);
  }
  const rows = [];
  const skipped = [];
  const lines = String(text ?? "").split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const p = parseProspectLine(line);
    const n = i + 1;
    if (i === 0 && /^(name|nama)$/i.test(p.name)) return; // header row
    if (!p.name) return skipped.push({ line: n, text: line, reason: "No name" });
    if (!p.profile_url && !p.phone) return skipped.push({ line: n, text: line, reason: "No profile link or number" });
    const hit = (p.profile_url && byUrl.get(p.profile_url)) || (p.phone && byPhone.get(p.phone));
    if (hit) {
      return skipped.push({ line: n, text: line, reason: hit.do_not_contact ? "Asked not to be contacted" : hit.id ? `Already on the list (${hit.name})` : `Twice in this paste (${hit.name})` });
    }
    if (rows.length >= MAX_PASTE) return skipped.push({ line: n, text: line, reason: `Over ${MAX_PASTE} in one paste` });
    const row = { ...p, kind, source: sourceFromUrl(p.profile_url) || "social" };
    rows.push(row);
    if (row.profile_url) byUrl.set(row.profile_url, row);
    if (row.phone) byPhone.set(row.phone, row);
  });
  return { rows, skipped };
}
