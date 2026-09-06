// Single source of truth for local (offline) car spec auto-fill.
//
// This is the FIRST tier of the hybrid spec lookup:
//   1. this local table  (curated, Malaysian-market, offline, free, accurate)
//   2. API Ninjas        (/api/car-specs — network fallback for the long tail)
//   3. NHTSA VIN decode  (utils/vinDecode.js — refines when a VIN is entered)
// Keep additions here rather than spinning up a second hardcoded table — one
// table, one schema, no drift.
//
// Rows are per generation (yearFrom..yearTo). Values are typical Malaysian-spec
// figures for the highest-volume variant — they are a convenience prefill and
// stay fully editable in the form. fuel_consumption is km/L.
const SPECS = [
  // ─── Perodua ───────────────────────────────────────────────────────────────
  { make:"Perodua", model:"Kancil",  yearFrom:1994, yearTo:2009, engine_cc:660,  cylinders:3, transmission:"Manual", fuel_type:"Petrol", body_type:"Hatchback", horsepower:32,  doors:5, seats:4, fuel_consumption:17 },
  { make:"Perodua", model:"Kelisa",  yearFrom:2001, yearTo:2007, engine_cc:989,  cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:55,  doors:5, seats:5, fuel_consumption:15 },
  { make:"Perodua", model:"Kenari",  yearFrom:2000, yearTo:2008, engine_cc:989,  cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"MPV",       horsepower:55,  doors:5, seats:5, fuel_consumption:14 },
  { make:"Perodua", model:"Viva",    yearFrom:2007, yearTo:2014, engine_cc:989,  cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:55,  doors:5, seats:5, fuel_consumption:14 },
  { make:"Perodua", model:"Myvi",    yearFrom:2005, yearTo:2011, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:84,  doors:5, seats:5, fuel_consumption:14 },
  { make:"Perodua", model:"Myvi",    yearFrom:2011, yearTo:2017, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:84,  doors:5, seats:5, fuel_consumption:15 },
  { make:"Perodua", model:"Myvi",    yearFrom:2018, yearTo:2099, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:94,  doors:5, seats:5, fuel_consumption:16 },
  { make:"Perodua", model:"Axia",    yearFrom:2014, yearTo:2022, engine_cc:998,  cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:67,  doors:5, seats:5, fuel_consumption:18 },
  { make:"Perodua", model:"Axia",    yearFrom:2023, yearTo:2099, engine_cc:998,  cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:67,  doors:5, seats:5, fuel_consumption:18 },
  { make:"Perodua", model:"Bezza",   yearFrom:2016, yearTo:2019, engine_cc:998,  cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:67,  doors:4, seats:5, fuel_consumption:17 },
  { make:"Perodua", model:"Bezza",   yearFrom:2020, yearTo:2099, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:94,  doors:4, seats:5, fuel_consumption:16 },
  { make:"Perodua", model:"Alza",    yearFrom:2009, yearTo:2021, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"MPV",       horsepower:84,  doors:5, seats:7, fuel_consumption:13 },
  { make:"Perodua", model:"Alza",    yearFrom:2022, yearTo:2099, engine_cc:1498, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"MPV",       horsepower:102, doors:5, seats:7, fuel_consumption:15 },
  { make:"Perodua", model:"Aruz",    yearFrom:2019, yearTo:2099, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"SUV",       horsepower:94,  doors:5, seats:7, fuel_consumption:13 },
  { make:"Perodua", model:"Ativa",   yearFrom:2021, yearTo:2099, engine_cc:998,  cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"SUV",       horsepower:95,  doors:5, seats:5, fuel_consumption:19 },
  { make:"Perodua", model:"Nautica", yearFrom:2022, yearTo:2099, engine_cc:1498, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"SUV",       horsepower:102, doors:5, seats:7, fuel_consumption:14 },

  // ─── Proton ────────────────────────────────────────────────────────────────
  { make:"Proton", model:"Wira",       yearFrom:1993, yearTo:2009, engine_cc:1468, cylinders:4, transmission:"Manual", fuel_type:"Petrol", body_type:"Sedan",     horsepower:82,  doors:4, seats:5, fuel_consumption:11 },
  { make:"Proton", model:"Waja",       yearFrom:2000, yearTo:2011, engine_cc:1588, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:110, doors:4, seats:5, fuel_consumption:11 },
  { make:"Proton", model:"Gen-2",      yearFrom:2004, yearTo:2012, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:94,  doors:5, seats:5, fuel_consumption:13 },
  { make:"Proton", model:"Satria Neo", yearFrom:2006, yearTo:2015, engine_cc:1298, cylinders:4, transmission:"Manual", fuel_type:"Petrol", body_type:"Hatchback", horsepower:94,  doors:3, seats:5, fuel_consumption:14 },
  { make:"Proton", model:"Saga",       yearFrom:2008, yearTo:2015, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:94,  doors:4, seats:5, fuel_consumption:14 },
  { make:"Proton", model:"Saga",       yearFrom:2016, yearTo:2018, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:94,  doors:4, seats:5, fuel_consumption:15 },
  { make:"Proton", model:"Saga",       yearFrom:2019, yearTo:2099, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:95,  doors:4, seats:5, fuel_consumption:16 },
  { make:"Proton", model:"Persona",    yearFrom:2007, yearTo:2015, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:94,  doors:4, seats:5, fuel_consumption:13 },
  { make:"Proton", model:"Persona",    yearFrom:2016, yearTo:2099, engine_cc:1598, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:109, doors:4, seats:5, fuel_consumption:14 },
  { make:"Proton", model:"Exora",      yearFrom:2009, yearTo:2019, engine_cc:1561, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"MPV",       horsepower:139, doors:5, seats:7, fuel_consumption:11 },
  { make:"Proton", model:"Exora",      yearFrom:2020, yearTo:2099, engine_cc:1561, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"MPV",       horsepower:139, doors:5, seats:7, fuel_consumption:12 },
  { make:"Proton", model:"Preve",      yearFrom:2012, yearTo:2018, engine_cc:1561, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:139, doors:4, seats:5, fuel_consumption:13 },
  { make:"Proton", model:"Suprima S",  yearFrom:2013, yearTo:2019, engine_cc:1561, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:139, doors:5, seats:5, fuel_consumption:13 },
  { make:"Proton", model:"Iriz",       yearFrom:2014, yearTo:2018, engine_cc:1332, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:94,  doors:5, seats:5, fuel_consumption:14 },
  { make:"Proton", model:"Iriz",       yearFrom:2019, yearTo:2099, engine_cc:1332, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:94,  doors:5, seats:5, fuel_consumption:15 },
  { make:"Proton", model:"X50",        yearFrom:2020, yearTo:2099, engine_cc:1477, cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"SUV",       horsepower:177, doors:5, seats:5, fuel_consumption:15 },
  { make:"Proton", model:"X70",        yearFrom:2018, yearTo:2021, engine_cc:1798, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"SUV",       horsepower:181, doors:5, seats:5, fuel_consumption:11 },
  { make:"Proton", model:"X70",        yearFrom:2022, yearTo:2099, engine_cc:1477, cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"SUV",       horsepower:177, doors:5, seats:5, fuel_consumption:14 },
  { make:"Proton", model:"X90",        yearFrom:2023, yearTo:2099, engine_cc:1477, cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"SUV",       horsepower:190, doors:5, seats:7, fuel_consumption:13 },
  { make:"Proton", model:"S70",        yearFrom:2024, yearTo:2099, engine_cc:1498, cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:150, doors:4, seats:5, fuel_consumption:15 },
  { make:"Proton", model:"Perdana",    yearFrom:2016, yearTo:2020, engine_cc:1998, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:150, doors:4, seats:5, fuel_consumption:11 },

  // ─── Honda ─────────────────────────────────────────────────────────────────
  { make:"Honda", model:"City",    yearFrom:2003, yearTo:2013, engine_cc:1497, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:118, doors:4, seats:5, fuel_consumption:15 },
  { make:"Honda", model:"City",    yearFrom:2014, yearTo:2019, engine_cc:1497, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:120, doors:4, seats:5, fuel_consumption:16 },
  { make:"Honda", model:"City",    yearFrom:2020, yearTo:2099, engine_cc:1498, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:121, doors:4, seats:5, fuel_consumption:16 },
  { make:"Honda", model:"Civic",   yearFrom:2006, yearTo:2011, engine_cc:1799, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:140, doors:4, seats:5, fuel_consumption:12 },
  { make:"Honda", model:"Civic",   yearFrom:2012, yearTo:2015, engine_cc:1799, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:141, doors:4, seats:5, fuel_consumption:13 },
  { make:"Honda", model:"Civic",   yearFrom:2016, yearTo:2021, engine_cc:1498, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:173, doors:4, seats:5, fuel_consumption:14 },
  { make:"Honda", model:"Civic",   yearFrom:2022, yearTo:2099, engine_cc:1498, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:182, doors:4, seats:5, fuel_consumption:15 },
  { make:"Honda", model:"Accord",  yearFrom:2008, yearTo:2012, engine_cc:2354, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:177, doors:4, seats:5, fuel_consumption:11 },
  { make:"Honda", model:"Accord",  yearFrom:2013, yearTo:2019, engine_cc:2356, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:175, doors:4, seats:5, fuel_consumption:12 },
  { make:"Honda", model:"Accord",  yearFrom:2020, yearTo:2099, engine_cc:1498, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:201, doors:4, seats:5, fuel_consumption:14 },
  { make:"Honda", model:"Jazz",    yearFrom:2008, yearTo:2013, engine_cc:1339, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Hatchback", horsepower:100, doors:5, seats:5, fuel_consumption:16 },
  { make:"Honda", model:"Jazz",    yearFrom:2014, yearTo:2020, engine_cc:1497, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Hatchback", horsepower:118, doors:5, seats:5, fuel_consumption:17 },
  { make:"Honda", model:"HR-V",    yearFrom:2015, yearTo:2021, engine_cc:1799, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",       horsepower:141, doors:5, seats:5, fuel_consumption:14 },
  { make:"Honda", model:"HR-V",    yearFrom:2022, yearTo:2099, engine_cc:1498, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",       horsepower:121, doors:5, seats:5, fuel_consumption:16 },
  { make:"Honda", model:"CR-V",    yearFrom:2007, yearTo:2012, engine_cc:1997, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",       horsepower:150, doors:5, seats:5, fuel_consumption:11 },
  { make:"Honda", model:"CR-V",    yearFrom:2013, yearTo:2016, engine_cc:1997, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",       horsepower:152, doors:5, seats:5, fuel_consumption:12 },
  { make:"Honda", model:"CR-V",    yearFrom:2017, yearTo:2023, engine_cc:1498, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",       horsepower:190, doors:5, seats:5, fuel_consumption:13 },
  { make:"Honda", model:"CR-V",    yearFrom:2024, yearTo:2099, engine_cc:1498, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",       horsepower:190, doors:5, seats:5, fuel_consumption:14 },
  { make:"Honda", model:"BR-V",    yearFrom:2016, yearTo:2021, engine_cc:1497, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",       horsepower:120, doors:5, seats:7, fuel_consumption:14 },
  { make:"Honda", model:"BR-V",    yearFrom:2022, yearTo:2099, engine_cc:1498, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",       horsepower:121, doors:5, seats:7, fuel_consumption:15 },
  { make:"Honda", model:"WR-V",    yearFrom:2023, yearTo:2099, engine_cc:1498, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",       horsepower:121, doors:5, seats:5, fuel_consumption:16 },
  { make:"Honda", model:"Odyssey", yearFrom:2013, yearTo:2020, engine_cc:2356, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"MPV",       horsepower:173, doors:5, seats:7, fuel_consumption:11 },

  // ─── Toyota ────────────────────────────────────────────────────────────────
  { make:"Toyota", model:"Vios",     yearFrom:2003, yearTo:2012, engine_cc:1497, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:109, doors:4, seats:5, fuel_consumption:14 },
  { make:"Toyota", model:"Vios",     yearFrom:2013, yearTo:2018, engine_cc:1496, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:107, doors:4, seats:5, fuel_consumption:15 },
  { make:"Toyota", model:"Vios",     yearFrom:2019, yearTo:2099, engine_cc:1496, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:107, doors:4, seats:5, fuel_consumption:16 },
  { make:"Toyota", model:"Yaris",    yearFrom:2019, yearTo:2099, engine_cc:1496, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Hatchback", horsepower:107, doors:5, seats:5, fuel_consumption:16 },
  { make:"Toyota", model:"Corolla",  yearFrom:2008, yearTo:2013, engine_cc:1798, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:140, doors:4, seats:5, fuel_consumption:12 },
  { make:"Toyota", model:"Corolla",  yearFrom:2014, yearTo:2018, engine_cc:1798, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:140, doors:4, seats:5, fuel_consumption:13 },
  { make:"Toyota", model:"Corolla",  yearFrom:2019, yearTo:2099, engine_cc:1798, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:138, doors:4, seats:5, fuel_consumption:14 },
  { make:"Toyota", model:"Camry",    yearFrom:2012, yearTo:2018, engine_cc:2494, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:167, doors:4, seats:5, fuel_consumption:11 },
  { make:"Toyota", model:"Camry",    yearFrom:2019, yearTo:2099, engine_cc:2487, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",     horsepower:224, doors:4, seats:5, fuel_consumption:13 },
  { make:"Toyota", model:"Hilux",    yearFrom:2016, yearTo:2099, engine_cc:2393, cylinders:4, transmission:"Auto", fuel_type:"Diesel", body_type:"Pickup",    horsepower:150, doors:4, seats:5, fuel_consumption:12 },
  { make:"Toyota", model:"Fortuner", yearFrom:2016, yearTo:2099, engine_cc:2393, cylinders:4, transmission:"Auto", fuel_type:"Diesel", body_type:"SUV",       horsepower:150, doors:5, seats:7, fuel_consumption:11 },
  { make:"Toyota", model:"Rush",     yearFrom:2018, yearTo:2099, engine_cc:1496, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",       horsepower:104, doors:5, seats:7, fuel_consumption:14 },
  { make:"Toyota", model:"Innova",   yearFrom:2016, yearTo:2099, engine_cc:1998, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"MPV",       horsepower:137, doors:5, seats:7, fuel_consumption:11 },
  { make:"Toyota", model:"Avanza",   yearFrom:2012, yearTo:2021, engine_cc:1496, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"MPV",       horsepower:104, doors:5, seats:7, fuel_consumption:13 },
  { make:"Toyota", model:"Veloz",    yearFrom:2022, yearTo:2099, engine_cc:1496, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"MPV",       horsepower:104, doors:5, seats:7, fuel_consumption:15 },
  { make:"Toyota", model:"Alphard",  yearFrom:2015, yearTo:2099, engine_cc:2493, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"MPV",       horsepower:178, doors:5, seats:7, fuel_consumption:9  },
  { make:"Toyota", model:"Vellfire", yearFrom:2015, yearTo:2099, engine_cc:2493, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"MPV",       horsepower:178, doors:5, seats:7, fuel_consumption:9  },
  { make:"Toyota", model:"Harrier",  yearFrom:2017, yearTo:2099, engine_cc:1986, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",       horsepower:171, doors:5, seats:5, fuel_consumption:12 },

  // ─── Nissan ────────────────────────────────────────────────────────────────
  { make:"Nissan", model:"Almera",  yearFrom:2012, yearTo:2019, engine_cc:1498, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",  horsepower:99,  doors:4, seats:5, fuel_consumption:15 },
  { make:"Nissan", model:"Almera",  yearFrom:2020, yearTo:2099, engine_cc:999,  cylinders:3, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan",  horsepower:100, doors:4, seats:5, fuel_consumption:18 },
  { make:"Nissan", model:"X-Trail", yearFrom:2015, yearTo:2099, engine_cc:1997, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",    horsepower:144, doors:5, seats:7, fuel_consumption:12 },
  { make:"Nissan", model:"Serena",  yearFrom:2018, yearTo:2099, engine_cc:1997, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"MPV",    horsepower:150, doors:5, seats:8, fuel_consumption:12 },
  { make:"Nissan", model:"Navara",  yearFrom:2015, yearTo:2099, engine_cc:2488, cylinders:4, transmission:"Auto", fuel_type:"Diesel", body_type:"Pickup", horsepower:190, doors:4, seats:5, fuel_consumption:12 },

  // ─── Mazda ─────────────────────────────────────────────────────────────────
  { make:"Mazda", model:"2",     yearFrom:2015, yearTo:2099, engine_cc:1496, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan", horsepower:114, doors:4, seats:5, fuel_consumption:16 },
  { make:"Mazda", model:"3",     yearFrom:2014, yearTo:2018, engine_cc:1998, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan", horsepower:162, doors:4, seats:5, fuel_consumption:13 },
  { make:"Mazda", model:"3",     yearFrom:2019, yearTo:2099, engine_cc:1998, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"Sedan", horsepower:162, doors:4, seats:5, fuel_consumption:14 },
  { make:"Mazda", model:"CX-3",  yearFrom:2015, yearTo:2099, engine_cc:1998, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",   horsepower:154, doors:5, seats:5, fuel_consumption:14 },
  { make:"Mazda", model:"CX-5",  yearFrom:2013, yearTo:2016, engine_cc:1998, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",   horsepower:162, doors:5, seats:5, fuel_consumption:12 },
  { make:"Mazda", model:"CX-5",  yearFrom:2017, yearTo:2099, engine_cc:1998, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",   horsepower:165, doors:5, seats:5, fuel_consumption:13 },
  { make:"Mazda", model:"CX-30", yearFrom:2020, yearTo:2099, engine_cc:1998, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",   horsepower:162, doors:5, seats:5, fuel_consumption:14 },
  { make:"Mazda", model:"CX-8",  yearFrom:2019, yearTo:2099, engine_cc:2488, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",   horsepower:190, doors:5, seats:7, fuel_consumption:12 },

  // ─── Mitsubishi ──────────────────────────────────────────────────────────────
  { make:"Mitsubishi", model:"Triton",    yearFrom:2015, yearTo:2099, engine_cc:2442, cylinders:4, transmission:"Auto", fuel_type:"Diesel", body_type:"Pickup", horsepower:178, doors:4, seats:5, fuel_consumption:12 },
  { make:"Mitsubishi", model:"ASX",       yearFrom:2011, yearTo:2099, engine_cc:1998, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",    horsepower:150, doors:5, seats:5, fuel_consumption:12 },
  { make:"Mitsubishi", model:"Outlander", yearFrom:2016, yearTo:2099, engine_cc:2360, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV",    horsepower:167, doors:5, seats:7, fuel_consumption:11 },
  { make:"Mitsubishi", model:"Xpander",   yearFrom:2020, yearTo:2099, engine_cc:1499, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"MPV",    horsepower:105, doors:5, seats:7, fuel_consumption:14 },

  // ─── generated from tools/specs/data — do not edit by hand ─── BEGIN
  { make:"Ford", model:"Ranger", yearFrom:2015, yearTo:2022, engine_cc:2198, cylinders:4, transmission:"Auto", fuel_type:"Diesel", body_type:"Pickup", horsepower:160, doors:4, seats:5, fuel_consumption:null },
  { make:"Ford", model:"Ranger", yearFrom:2023, yearTo:2099, engine_cc:1996, cylinders:4, transmission:"Auto", fuel_type:"Diesel", body_type:"Pickup", horsepower:210, doors:4, seats:5, fuel_consumption:null },
  { make:"Lexus", model:"RX", yearFrom:2015, yearTo:2022, engine_cc:1998, cylinders:4, transmission:"Auto", fuel_type:"Petrol", body_type:"SUV", horsepower:238, doors:5, seats:5, fuel_consumption:null },
  // ─── generated ─── END
];

// Normalise for matching: drop case, spaces and dashes so "HR-V" / "hrv" and
// "CX-5" / "cx 5" all collapse to the same key.
const norm = (s) => (s || "").toLowerCase().replace(/[-\s]+/g, "");

// Rich lookup — the full spec row. Prefers the generation whose year range
// contains `year`; with no year (or no range hit) falls back to the newest
// generation as the best guess. Returns null when the model isn't curated.
export function lookupFullSpec(make, model, year) {
  const m = norm(make);
  const mo = norm(model);
  const rows = SPECS.filter((r) => norm(r.make) === m && norm(r.model) === mo);
  if (!rows.length) return null;
  const y = parseInt(year) || 0;
  if (y) {
    const hit = rows.find((r) => y >= r.yearFrom && y <= r.yearTo);
    if (hit) return hit;
  }
  return rows.reduce((a, b) => (b.yearFrom > a.yearFrom ? b : a));
}

// Legacy accessor kept for AddCarForm (dealer intake) — returns just { cc, body }
// so that flow is unchanged. New callers should use lookupFullSpec.
export function lookupCarSpec(make, model) {
  const r = lookupFullSpec(make, model);
  return r ? { cc: r.engine_cc, body: r.body_type } : null;
}
