// src/utils/chassisCodes.js
// Chassis / generation codes that enthusiasts and recon buyers actually search
// by — E46, G82, FK8, R35, W205, 992… Malaysian car forums and JDM/German
// buyers use these constantly, and no local marketplace targets them. We DO NOT
// store this: it's derived from brand + model + year on read and injected into a
// car page's <title>, meta description and JSON-LD so Google and AI engines match
// "<model> <code>" queries (e.g. "bmw m4 g82") to our listings. Zero DB cost.
//
// Extend freely: add a { from, to, code } row under the brand → model. `to: null`
// means "current / still in production". Ranges are inclusive of both years.
// Keep model keys UPPERCASE. Longer, more specific keys (e.g. "CIVIC TYPE R")
// win over shorter ones ("CIVIC") because we match longest-first.

const TABLE = {
  BMW: {
    "M2": [{ from: 2016, to: 2021, code: "F87" }, { from: 2023, to: null, code: "G87" }],
    "M3": [{ from: 2000, to: 2006, code: "E46" }, { from: 2007, to: 2013, code: "E90/E92/E93" }, { from: 2014, to: 2018, code: "F80" }, { from: 2021, to: null, code: "G80" }],
    "M4": [{ from: 2014, to: 2020, code: "F82/F83" }, { from: 2021, to: null, code: "G82/G83" }],
    "M5": [{ from: 2005, to: 2010, code: "E61" }, { from: 2011, to: 2016, code: "F10" }, { from: 2018, to: 2023, code: "F90" }, { from: 2024, to: null, code: "G90" }],
    "M8": [{ from: 2019, to: null, code: "F92/F91/F93" }],
    "1 SERIES": [{ from: 2004, to: 2013, code: "E87" }, { from: 2011, to: 2019, code: "F20" }, { from: 2019, to: null, code: "F40" }],
    "2 SERIES": [{ from: 2014, to: 2021, code: "F22" }, { from: 2021, to: null, code: "G42" }],
    "3 SERIES": [{ from: 1998, to: 2006, code: "E46" }, { from: 2005, to: 2011, code: "E90" }, { from: 2012, to: 2018, code: "F30" }, { from: 2019, to: null, code: "G20" }],
    "4 SERIES": [{ from: 2013, to: 2020, code: "F32" }, { from: 2020, to: null, code: "G22" }],
    "5 SERIES": [{ from: 2003, to: 2010, code: "E60" }, { from: 2010, to: 2016, code: "F10" }, { from: 2017, to: 2023, code: "G30" }, { from: 2024, to: null, code: "G60" }],
    "7 SERIES": [{ from: 2002, to: 2008, code: "E65/E66" }, { from: 2009, to: 2015, code: "F01/F02" }, { from: 2016, to: 2022, code: "G11/G12" }],
    "X3": [{ from: 2011, to: 2017, code: "F25" }, { from: 2018, to: 2024, code: "G01" }],
  },
  MERCEDES: {
    "A-CLASS": [{ from: 2012, to: 2018, code: "W176" }, { from: 2018, to: null, code: "W177" }],
    "C-CLASS": [{ from: 2007, to: 2014, code: "W204" }, { from: 2014, to: 2021, code: "W205" }, { from: 2021, to: null, code: "W206" }],
    "C63": [{ from: 2008, to: 2014, code: "W204" }, { from: 2015, to: 2021, code: "W205" }, { from: 2022, to: null, code: "W206" }],
    "E-CLASS": [{ from: 2009, to: 2016, code: "W212" }, { from: 2016, to: 2023, code: "W213" }, { from: 2024, to: null, code: "W214" }],
    "CLA": [{ from: 2013, to: 2019, code: "C117" }, { from: 2019, to: null, code: "C118" }],
    "GLA": [{ from: 2014, to: 2020, code: "X156" }, { from: 2020, to: null, code: "H247" }],
    "GLC": [{ from: 2016, to: 2022, code: "X253" }, { from: 2023, to: null, code: "X254" }],
    "GLE": [{ from: 2015, to: 2018, code: "W166" }, { from: 2019, to: null, code: "V167" }],
    "B-CLASS": [{ from: 2005, to: 2011, code: "W245" }, { from: 2012, to: 2018, code: "W246" }, { from: 2019, to: null, code: "W247" }],
    "S-CLASS": [{ from: 2005, to: 2013, code: "W221" }, { from: 2013, to: 2020, code: "W222" }, { from: 2020, to: null, code: "W223" }],
  },
  AUDI: {
    "A3": [{ from: 2003, to: 2012, code: "8P" }, { from: 2013, to: 2020, code: "8V" }, { from: 2021, to: null, code: "8Y" }],
    "A6": [{ from: 2012, to: 2018, code: "4G" }, { from: 2019, to: null, code: "4K" }],
    "A4": [{ from: 2008, to: 2015, code: "B8" }, { from: 2016, to: null, code: "B9" }],
    "A5": [{ from: 2007, to: 2016, code: "B8" }, { from: 2016, to: null, code: "B9" }],
    "S3": [{ from: 2013, to: 2020, code: "8V" }, { from: 2021, to: null, code: "8Y" }],
    "RS3": [{ from: 2015, to: 2020, code: "8V" }, { from: 2021, to: null, code: "8Y" }],
  },
  VOLKSWAGEN: {
    "GOLF": [{ from: 2009, to: 2013, code: "MK6" }, { from: 2013, to: 2020, code: "MK7" }, { from: 2020, to: null, code: "MK8" }],
    "GTI": [{ from: 2009, to: 2013, code: "MK6" }, { from: 2013, to: 2020, code: "MK7" }, { from: 2020, to: null, code: "MK8" }],
    "POLO": [{ from: 2009, to: 2017, code: "6R/6C" }, { from: 2018, to: null, code: "AW" }],
  },
  TOYOTA: {
    "SUPRA": [{ from: 1993, to: 2002, code: "A80" }, { from: 2019, to: null, code: "A90" }],
    "86": [{ from: 2012, to: 2020, code: "ZN6" }, { from: 2021, to: null, code: "ZN8" }],
    "GR86": [{ from: 2021, to: null, code: "ZN8" }],
    "GR YARIS": [{ from: 2020, to: null, code: "GXPA16" }],
  },
  HONDA: {
    "CIVIC TYPE R": [{ from: 2007, to: 2011, code: "FD2" }, { from: 2015, to: 2017, code: "FK2" }, { from: 2017, to: 2021, code: "FK8" }, { from: 2022, to: null, code: "FL5" }],
    "CIVIC": [{ from: 2006, to: 2011, code: "FD" }, { from: 2012, to: 2015, code: "FB" }, { from: 2016, to: 2021, code: "FC" }, { from: 2022, to: null, code: "FE" }],
    "INTEGRA TYPE R": [{ from: 1995, to: 2001, code: "DC2" }, { from: 2001, to: 2006, code: "DC5" }],
    "S2000": [{ from: 1999, to: 2009, code: "AP1/AP2" }],
    "JAZZ": [{ from: 2008, to: 2014, code: "GE" }, { from: 2014, to: 2020, code: "GK" }, { from: 2020, to: null, code: "GR" }],
    "CITY": [{ from: 2008, to: 2014, code: "GM2" }, { from: 2014, to: 2020, code: "GM6" }, { from: 2020, to: null, code: "GN" }],
  },
  NISSAN: {
    "KICKS": [{ from: 2016, to: null, code: "P15" }],
    "GT-R": [{ from: 1999, to: 2002, code: "R34" }, { from: 2007, to: null, code: "R35" }],
    "SKYLINE": [{ from: 1993, to: 1998, code: "R33" }, { from: 1999, to: 2002, code: "R34" }],
    "SILVIA": [{ from: 1993, to: 1998, code: "S14" }, { from: 1999, to: 2002, code: "S15" }],
    "350Z": [{ from: 2002, to: 2009, code: "Z33" }],
    "370Z": [{ from: 2009, to: 2020, code: "Z34" }],
    "FAIRLADY Z": [{ from: 2002, to: 2009, code: "Z33" }, { from: 2009, to: 2020, code: "Z34" }, { from: 2022, to: null, code: "RZ34" }],
    "CEFIRO": [{ from: 1988, to: 1993, code: "A31" }, { from: 1994, to: 1998, code: "A32" }, { from: 1999, to: 2003, code: "A33" }],
  },
  MAZDA: {
    "MX-5": [{ from: 1989, to: 1997, code: "NA" }, { from: 1998, to: 2005, code: "NB" }, { from: 2005, to: 2015, code: "NC" }, { from: 2015, to: null, code: "ND" }],
    "RX-7": [{ from: 1985, to: 1992, code: "FC" }, { from: 1992, to: 2002, code: "FD" }],
    "RX-8": [{ from: 2003, to: 2012, code: "SE3P" }],
    "MAZDA3": [{ from: 2003, to: 2009, code: "BK" }, { from: 2009, to: 2013, code: "BL" }, { from: 2013, to: 2019, code: "BM/BN" }, { from: 2019, to: null, code: "BP" }],
    "5": [{ from: 2005, to: 2010, code: "CR" }, { from: 2011, to: 2018, code: "CW" }],
  },
  KIA: {
    "OPTIMA": [{ from: 2011, to: 2015, code: "TF" }, { from: 2016, to: 2020, code: "JF" }],
  },
  SUBARU: {
    "WRX STI": [{ from: 2000, to: 2007, code: "GDB" }, { from: 2007, to: 2014, code: "GRB" }, { from: 2014, to: 2021, code: "VAB" }],
    "WRX": [{ from: 2014, to: 2021, code: "VA" }, { from: 2022, to: null, code: "VB" }],
    "BRZ": [{ from: 2012, to: 2020, code: "ZC6" }, { from: 2021, to: null, code: "ZD8" }],
    "IMPREZA": [{ from: 2000, to: 2007, code: "GD" }, { from: 2007, to: 2014, code: "GR/GV" }],
    "OUTBACK": [{ from: 2009, to: 2014, code: "BR" }, { from: 2015, to: 2020, code: "BS" }, { from: 2021, to: null, code: "BT" }],
  },
  SUZUKI: {
    "VITARA": [{ from: 2015, to: null, code: "LY" }],
  },
  PORSCHE: {
    "911": [{ from: 1998, to: 2004, code: "996" }, { from: 2004, to: 2012, code: "997" }, { from: 2012, to: 2019, code: "991" }, { from: 2019, to: null, code: "992" }],
    "CAYMAN": [{ from: 2005, to: 2012, code: "987" }, { from: 2012, to: 2016, code: "981" }, { from: 2016, to: null, code: "718/982" }],
    "BOXSTER": [{ from: 2005, to: 2012, code: "987" }, { from: 2012, to: 2016, code: "981" }, { from: 2016, to: null, code: "718/982" }],
  },
  LEXUS: {
    "IS": [{ from: 2005, to: 2013, code: "XE20" }, { from: 2013, to: null, code: "XE30" }],
    "RC": [{ from: 2014, to: null, code: "XC10" }],
    "GS": [{ from: 2012, to: 2020, code: "L10" }],
    "RX": [{ from: 2009, to: 2015, code: "AL10" }, { from: 2015, to: 2022, code: "AL20" }, { from: 2022, to: null, code: "AL30" }],
  },
};

// Brand aliases → canonical key above. Data stores brands inconsistently
// ("Mercedes-Benz" vs "Mercedes", "VW" vs "Volkswagen"), so normalise here.
const BRAND_ALIAS = {
  "MERCEDES-BENZ": "MERCEDES",
  "MERC": "MERCEDES",
  "VW": "VOLKSWAGEN",
};

function normBrand(brand) {
  const b = String(brand || "").trim().toUpperCase();
  return BRAND_ALIAS[b] || b;
}

// Longest-first model keys per brand, precomputed once so a "Civic Type R"
// resolves to FK8 rather than the generic Civic generation.
const MODEL_KEYS = {};
for (const brand of Object.keys(TABLE)) {
  MODEL_KEYS[brand] = Object.keys(TABLE[brand]).sort((a, b) => b.length - a.length);
}

/**
 * Resolve a chassis/generation code from brand, model, year (+ optional variant).
 * Returns a string like "G82" / "E90/E92", or null if we have no mapping.
 */
export function getChassisCode(brand, model, year, variant) {
  const b = normBrand(brand);
  const models = TABLE[b];
  if (!models) return null;
  const yr = parseInt(year, 10);
  if (!yr) return null;
  const text = `${model || ""} ${variant || ""}`.toUpperCase();
  for (const key of MODEL_KEYS[b]) {
    if (text.includes(key)) {
      const rows = models[key];
      const hit = rows.find((r) => yr >= r.from && (r.to == null || yr <= r.to));
      if (hit) return hit.code;
      return null; // model matched but year outside every known range
    }
  }
  return null;
}

// Inverted index: CODE → { brand, models[] } so an on-site search for "g82" can
// be expanded to the brand+model it denotes. Codes can be compound ("E90/E92",
// "AP1/AP2") — split on "/" so each half is individually searchable. `models`
// holds candidate substrings to match a listing's model/variant against: the
// full key AND its head word, because a "Civic Type R" is stored as model
// "Civic" + variant "Type R", so matching only the full key would miss it.
const CODE_INDEX = {};
for (const brand of Object.keys(TABLE)) {
  for (const key of Object.keys(TABLE[brand])) {
    const head = key.split(" ")[0];
    // Head word only helps when it's distinctive — skip a bare single digit
    // ("3 SERIES" → "3") which would match far too broadly.
    const models = head !== key && head.length >= 2 && !/^\d$/.test(head)
      ? [key, head]
      : [key];
    for (const row of TABLE[brand][key]) {
      for (const part of String(row.code).split("/")) {
        const k = part.trim().toUpperCase();
        if (k && !CODE_INDEX[k]) CODE_INDEX[k] = { brand, models };
      }
    }
  }
}

/**
 * If a raw search token is a known chassis code, return { brand, models[] } so
 * the caller can widen the query (e.g. "g82" → BMW / ["M4"]). Returns null
 * otherwise. Case-insensitive.
 */
export function chassisSearch(token) {
  const k = String(token || "").trim().toUpperCase();
  return CODE_INDEX[k] || null;
}
