// Free VIN decode via NHTSA vPIC (US gov, no API key, no documented rate limit).
// https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{VIN}?format=json
//
// Covers standard 17-char VINs — i.e. CBU units (Honda/Toyota/Mazda/Mitsubishi
// imports, continental brands). Does NOT cover Perodua/Proton national cars,
// whose VINs aren't in the NHTSA catalog — those fall back to carSpecs.js.
//
// Returns { make, model, year, body, cc, cylinders, doors, seats, horsepower }
// with only the fields NHTSA resolves, or null on miss/error. Never throws —
// intake must keep working offline. Fuel economy is NOT VIN-decodable (it comes
// from EPA/model data, not the VIN) so it stays a manual field.

const NHTSA = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevin";

// NHTSA "Body Class" strings → our BODY_TYPES vocabulary.
function mapBody(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("sedan") || s.includes("saloon")) return "Sedan";
  if (s.includes("suv") || s.includes("sport utility")) return "SUV";
  if (s.includes("hatchback")) return "Hatchback";
  if (s.includes("wagon")) return "Wagon";
  if (s.includes("coupe")) return "Coupe";
  if (s.includes("pickup") || s.includes("truck")) return "Pickup";
  if (s.includes("van") || s.includes("mpv") || s.includes("minivan")) return "MPV";
  return null;
}

// A standard VIN is 17 chars, excludes I/O/Q. Looser check is fine — NHTSA
// will simply return nothing useful for garbage input.
export function isLikelyVin(vin) {
  if (!vin) return false;
  const v = vin.trim().toUpperCase();
  return v.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(v);
}

export async function decodeVin(vin) {
  if (!isLikelyVin(vin)) return null;
  try {
    const res = await fetch(`${NHTSA}/${vin.trim().toUpperCase()}?format=json`);
    if (!res.ok) return null;
    const json = await res.json();
    const rows = json?.Results || [];
    const get = (key) => {
      const row = rows.find((r) => r.Variable === key);
      const val = row?.Value;
      return val && val !== "Not Applicable" && val !== "0" ? val.trim() : null;
    };

    const make = get("Make");
    const model = get("Model");
    const year = get("Model Year");
    const body = mapBody(get("Body Class"));
    // Displacement comes back in litres (e.g. "1.5"); convert to CC.
    const dispL = get("Displacement (L)");
    const cc = dispL ? Math.round(parseFloat(dispL) * 1000) : null;

    // Spec fields NHTSA sometimes resolves — power/cylinders/doors/seats. These
    // feed the (optional) Advanced specs so a listing's detail page isn't blank.
    const toInt = (v) => {
      const n = v ? parseInt(v, 10) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const cylinders = toInt(get("Engine Number of Cylinders"));
    const doors = toInt(get("Doors"));
    const seats = toInt(get("Number of Seats") || get("Seating Capacity"));
    // Horsepower: prefer the brake-hp figure; else convert engine power in kW.
    let horsepower = toInt(get("Engine Brake (hp) From"));
    if (!horsepower) {
      const kw = get("Engine Power (kW)");
      const hp = kw ? Math.round(parseFloat(kw) * 1.34102) : null;
      horsepower = hp && hp > 0 ? hp : null;
    }

    // Require at least make+model to count as a hit.
    if (!make || !model) return null;
    return {
      make: titleCase(make),
      model: titleCase(model),
      year: year || null,
      body,
      cc: cc && cc > 0 ? cc : null,
      cylinders,
      doors,
      seats,
      horsepower,
    };
  } catch {
    return null;
  }
}

function titleCase(s) {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
