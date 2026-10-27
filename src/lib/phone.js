// Malaysian phone numbers, ONE rule for the whole app. Drevo is Malaysia only
// (owner, 2026-10-27): every phone box shows a fixed "+60" and takes the rest.
//
// Three forms of the same number:
//   local      123456789      what the box shows after the +60 (no leading 0)
//   +60 form   +60123456789   what the boxes hand to their forms (toPlus60)
//   canonical  60123456789    what the DB stores; mirror of normalize_my_phone()
//                             so frontend dedup queries match the leads trigger

// Numbering plan (MCMC): mobile = 01X + 7 digits, except 011 / 015 = 8 digits.
// Landline = 03 + 8 digits (Klang Valley), 04-07 / 09 + 7, Sabah/Sarawak 08X + 6.
const MOBILE = /^(1[15]\d{8}|1[02-46-9]\d{7})$/;
const LANDLINE = /^(3\d{8}|[4-79]\d{7}|8[2-9]\d{6})$/;
export const MY_LOCAL_MAX = 10;

// Whatever was typed or pasted -> the digits after +60. People type the whole
// number (0123456789, +60 12-345 6789, 0060...) into a box that already shows
// +60; the extra 60 / 0 must not be counted twice. Capped at the longest real
// number so extra digits can never be saved.
export function toLocalDigits(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('60')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, MY_LOCAL_MAX);
}

export const toPlus60 = (raw) => {
  const d = toLocalDigits(raw);
  return d ? `+60${d}` : '';
};

// { mobileOnly } for a seller's WhatsApp: a landline cannot receive it.
export function isValidMyPhone(raw, { mobileOnly = false } = {}) {
  const d = toLocalDigits(raw);
  return MOBILE.test(d) || (!mobileOnly && LANDLINE.test(d));
}

// For display: +60 12-345 6789
export function formatMyPhone(raw) {
  const d = toLocalDigits(raw);
  if (!d) return '';
  const head = d.startsWith('1') || d.startsWith('8') ? 2 : 1;
  const rest = d.slice(head);
  const split = rest.length > 7 ? 4 : 3;
  return `+60 ${d.slice(0, head)}-${rest.slice(0, split)} ${rest.slice(split)}`.trim();
}

// Canonical stored form: 0112345678 / +60112345678 / 60112345678 -> 60112345678
export function normalizePhone(raw) {
  const d = toLocalDigits(raw);
  return d ? '60' + d : '';
}

// The one message every phone box shows for a number that cannot be real.
export const MY_PHONE_ERROR = "That number doesn't look right. Malaysian numbers only, e.g. 12 345 6789.";
