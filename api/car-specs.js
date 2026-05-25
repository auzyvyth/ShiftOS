// Vercel serverless function — proxy for API Ninjas cars endpoint
// Keeps the API key server-side and normalises the response shape

const CLASS_TO_BODY = {
  "compact car":      "Hatchback",
  "subcompact car":   "Hatchback",
  "hatchback":        "Hatchback",
  "sedan":            "Sedan",
  "coupe":            "Coupe",
  "convertible":      "Convertible",
  "station wagon":    "Wagon",
  "minivan":          "MPV",
  "van":              "MPV",
  "suv":              "SUV",
  "pickup truck":     "Pickup",
  "luxury":           "Sedan",
  "sports car":       "Coupe",
};

const MPG_TO_KPL = 0.425144;

function mpgToKpl(mpg) {
  if (!mpg) return null;
  return Math.round(mpg * MPG_TO_KPL * 10) / 10;
}

function normalise(raw) {
  if (!raw) return null;

  const fuelMap = { gas: "Petrol", diesel: "Diesel", electricity: "Electric", hybrid: "Hybrid" };
  const transMap = { a: "Auto", m: "Manual" };

  const bodyRaw = (raw.class || "").toLowerCase();
  const bodyType = CLASS_TO_BODY[bodyRaw] || null;

  const cityKpl    = mpgToKpl(raw.city_mpg);
  const highwayKpl = mpgToKpl(raw.highway_mpg);
  // combined kpl — average of city and highway when both available
  const fuelConsumption = cityKpl && highwayKpl
    ? Math.round(((cityKpl + highwayKpl) / 2) * 10) / 10
    : cityKpl || highwayKpl || null;

  return {
    engine_cc:        raw.displacement ? Math.round(raw.displacement * 1000) : null,
    transmission:     transMap[raw.transmission] || raw.transmission || null,
    fuel_type:        fuelMap[raw.fuel_type] || raw.fuel_type || null,
    body_type:        bodyType,
    horsepower:       raw.horsepower || null,
    doors:            raw.doors || null,
    seats:            raw.seats || null,
    cylinders:        raw.cylinders || null,
    fuel_consumption: fuelConsumption,
    city_kpl:         cityKpl,
    highway_kpl:      highwayKpl,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { make, model, year } = req.query;
  if (!make || !model || !year) {
    return res.status(400).json({ error: "make, model and year are required" });
  }

  const apiKey = process.env.API_NINJAS_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const params = new URLSearchParams({ make, model, year, limit: "1" });
  const url = `https://api.api-ninjas.com/v1/cars?${params}`;

  try {
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Upstream API error" });
    }

    const data = await response.json();
    const spec = Array.isArray(data) && data.length > 0 ? normalise(data[0]) : null;

    return res.status(200).json({ spec });
  } catch (err) {
    return res.status(500).json({ error: "Fetch failed", detail: err.message });
  }
}
