// Malaysian states and their cities — the ONE list.
//
// There were six, and they disagreed. CarForm had 13 states with city lists;
// SalesmanOnboarding, DealerOnboarding, CarFormFast and ContactGate each had
// their own 16-state array; marketplaceConfig had 14 (no Labuan, no
// Putrajaya); and SalesmanSetup wrote "Pulau Pinang" where every other surface
// wrote "Penang" — two spellings of one state landing in the same
// `profiles.state` column.
//
// That drift is why a seller could pick a state at signup that the listing form
// could not render, and why the same person's location failed to match itself
// across two screens. Import from here; do not start a seventh copy.
export const STATE_CITIES = {
  "Kuala Lumpur": [
    "Kuala Lumpur City Centre",
    "Chow Kit",
    "Bangsar",
    "Mont Kiara",
    "Kepong",
    "Setapak",
    "Wangsa Maju",
    "Titiwangsa",
    "Brickfields",
    "Cheras",
    "Bukit Jalil",
    "Sri Petaling",
    "Sentul",
    "Segambut",
    "Batu",
    "Seputeh",
    "Bukit Bintang",
    "Sungai Besi",
    "Setiawangsa",
  ],
  Selangor: [
    "Shah Alam",
    "Petaling Jaya",
    "Subang Jaya",
    "Klang",
    "Ampang",
    "Puchong",
    "Sepang",
    "Rawang",
    "Kajang",
    "Cyberjaya",
    "Damansara",
    "Sungai Buloh",
    "Gombak",
    "Selayang",
    "Semenyih",
    "Banting",
    "Kuala Selangor",
    "Bangi",
    "Seri Kembangan",
    "Cheras Selangor",
  ],
  Penang: [
    "George Town",
    "Butterworth",
    "Bukit Mertajam",
    "Bayan Lepas",
    "Batu Ferringhi",
    "Gelugor",
    "Seberang Jaya",
    "Perai",
    "Sungai Jawi",
    "Nibong Tebal",
    "Kepala Batas",
    "Balik Pulau",
    "Air Itam",
    "Tanjung Bungah",
    "Simpang Ampat",
  ],
  Johor: [
    "Johor Bahru",
    "Iskandar Puteri",
    "Skudai",
    "Kulai",
    "Batu Pahat",
    "Muar",
    "Kluang",
    "Pasir Gudang",
    "Senai",
    "Segamat",
    "Pontian",
    "Kota Tinggi",
    "Mersing",
    "Tangkak",
    "Yong Peng",
  ],
  Perak: [
    "Ipoh",
    "Taiping",
    "Teluk Intan",
    "Sitiawan",
    "Lumut",
    "Kampar",
    "Tanjung Malim",
    "Kuala Kangsar",
    "Batu Gajah",
    "Parit Buntar",
    "Bagan Serai",
    "Gopeng",
  ],
  Melaka: [
    "Melaka City",
    "Ayer Keroh",
    "Bukit Katil",
    "Alor Gajah",
    "Jasin",
    "Masjid Tanah",
    "Merlimau",
  ],
  "Negeri Sembilan": [
    "Seremban",
    "Port Dickson",
    "Nilai",
    "Rembau",
    "Tampin",
    "Senawang",
    "Bahau",
    "Kuala Pilah",
    "Mantin",
  ],
  Kedah: [
    "Alor Setar",
    "Sungai Petani",
    "Kulim",
    "Langkawi",
    "Baling",
    "Jitra",
    "Gurun",
    "Yan",
    "Pendang",
  ],
  Kelantan: [
    "Kota Bharu",
    "Pasir Mas",
    "Tanah Merah",
    "Machang",
    "Gua Musang",
    "Kuala Krai",
    "Bachok",
    "Tumpat",
  ],
  Terengganu: [
    "Kuala Terengganu",
    "Kemaman",
    "Dungun",
    "Kerteh",
    "Marang",
    "Besut",
    "Chukai",
    "Jerteh",
  ],
  Pahang: [
    "Kuantan",
    "Temerloh",
    "Bentong",
    "Raub",
    "Cameron Highlands",
    "Genting Highlands",
    "Pekan",
    "Jerantut",
    "Mentakab",
    "Kuala Lipis",
  ],
  Sabah: [
    "Kota Kinabalu",
    "Sandakan",
    "Tawau",
    "Lahad Datu",
    "Keningau",
    "Semporna",
    "Kota Belud",
    "Papar",
    "Penampang",
    "Beaufort",
  ],
  Sarawak: [
    "Kuching",
    "Miri",
    "Sibu",
    "Bintulu",
    "Limbang",
    "Kota Samarahan",
    "Sri Aman",
    "Sarikei",
    "Mukah",
    "Bau",
  ],
  Perlis: ["Kangar", "Arau", "Padang Besar", "Kuala Perlis", "Simpang Empat"],
  Labuan: ["Victoria", "Rancha-Rancha", "Batu Manikar", "Layang-Layangan"],
  Putrajaya: ["Putrajaya"],
};

// Every state, in the order above. Signup, the listing form and the marketplace
// filters all read this, so they cannot offer different sets again.
export const MY_STATES = Object.keys(STATE_CITIES);

export function citiesFor(state) {
  return STATE_CITIES[state] || [];
}

// The state's cities, plus whatever the record already holds. A stored city
// that predates this list (they were free-typed for months) must still be
// selectable, or the control renders blank while the value is quietly set.
export function cityOptionsFor(state, current) {
  const list = citiesFor(state);
  if (current && !list.includes(current)) return [current, ...list];
  return list;
}

// Spellings that mean a state we already have. SalesmanSetup stored
// "Pulau Pinang" for years, so those profiles must still resolve.
const STATE_ALIASES = {
  "pulau pinang": "Penang",
  "p. pinang": "Penang",
  "wilayah persekutuan kuala lumpur": "Kuala Lumpur",
  "wp kuala lumpur": "Kuala Lumpur",
  "wilayah persekutuan labuan": "Labuan",
  "wp labuan": "Labuan",
  "wilayah persekutuan putrajaya": "Putrajaya",
  "wp putrajaya": "Putrajaya",
  "malacca": "Melaka",
  "penang island": "Penang",
};

const norm = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");

// Title-case a free-typed place name. A carried-through city is printed on the
// public listing, and "gombak" is how someone typed it at 1am, not how it
// should read there.
function titleCase(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\p{L}[\p{L}'’-]*/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function normalizeState(rawState) {
  const n = norm(rawState);
  if (!n) return "";
  const direct = MY_STATES.find((k) => norm(k) === n);
  if (direct) return direct;
  return STATE_ALIASES[n] || "";
}

// Map a stored location onto something a state/city control can render.
//
// An unknown state is dropped: the city list hangs off the state, so there is
// nothing sensible to show without it. An unknown city is KEPT and title-cased
// — callers add it to their own options — because plenty of stored cities were
// free-typed before this list existed, and dropping them would leave a location
// prefill half-working for exactly the people who have one.
// `car_listings.city` is only ever displayed, never matched against a fixed
// list, so carrying a seller's own wording through is safe.
export function matchKnownLocation(rawState, rawCity) {
  const state = normalizeState(rawState);
  if (!state) return { state: "", city: "" };
  const cityMatch = citiesFor(state).find((c) => norm(c) === norm(rawCity));
  return { state, city: cityMatch || titleCase(rawCity) };
}
