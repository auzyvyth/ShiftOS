// "About me" answers on a Premium seller page (PAGE-PRO 2, owner 2026-11-01).
// Stored on profiles (migration 20261101a_agent_about.sql), read publicly via
// get_agent_about(slug), which returns them for a full (Premium) page only.
// One module for the rules and the words, shared by the page and Settings.

export const ABOUT_LANGUAGES = [
  { key: "ms", label: "Bahasa Melayu" },
  { key: "en", label: "English" },
  { key: "zh", label: "Mandarin" },
  { key: "ta", label: "Tamil" },
];
export const ABOUT_LIMITS = { areas: 120, promise: 160, years: 60 };

// Seller numbers never ship to the public (CDP-3). The DB refuses 8+ digits in
// a row; this also catches a number typed with spaces or dashes.
export const hasPhoneLikeNumber = (s) => /[0-9]{8,}/.test(String(s || "").replace(/[\s\-().+]/g, ""));

// Form -> the four columns, or { error } naming the field that is wrong.
export function aboutPayload(form) {
  const yearsRaw = String(form?.years ?? "").trim();
  const years = yearsRaw === "" ? null : Number(yearsRaw);
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > ABOUT_LIMITS.years)) return { error: "years" };
  const areas = String(form?.areas || "").trim().slice(0, ABOUT_LIMITS.areas);
  const promise = String(form?.promise || "").trim().slice(0, ABOUT_LIMITS.promise);
  if (hasPhoneLikeNumber(areas)) return { error: "areas" };
  if (hasPhoneLikeNumber(promise)) return { error: "promise" };
  const known = new Set(ABOUT_LANGUAGES.map((l) => l.key));
  const languages = [...new Set((form?.languages || []).filter((k) => known.has(k)))];
  return {
    years_selling: years,
    languages: languages.length ? languages : null,
    areas_covered: areas || null,
    my_promise: promise || null,
  };
}

// Row -> form (Settings).
export const aboutForm = (row) => ({
  years: row?.years_selling != null ? String(row.years_selling) : "",
  languages: Array.isArray(row?.languages) ? row.languages : [],
  areas: row?.areas_covered || "",
  promise: row?.my_promise || "",
});

// The facts line under "About me" on the page. Only what the seller filled in.
export function aboutFacts(about) {
  if (!about) return [];
  const out = [];
  const y = Number(about.years_selling);
  if (Number.isInteger(y) && y > 0) out.push({ key: "years", text: `${y} ${y === 1 ? "year" : "years"} selling cars` });
  const langs = (about.languages || []).map((k) => ABOUT_LANGUAGES.find((l) => l.key === k)?.label).filter(Boolean);
  if (langs.length) out.push({ key: "languages", text: `Speaks ${langs.join(", ")}` });
  if (about.areas_covered) out.push({ key: "areas", text: `Covers ${about.areas_covered}` });
  return out;
}
