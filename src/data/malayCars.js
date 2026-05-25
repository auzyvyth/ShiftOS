// Proton + Perodua specs lookup (2000 onwards)
// fuel_consumption stored as km/L (kpl)
const MY_CAR_SPECS = [
  // ─── Perodua ───────────────────────────────────────────────────────────────
  { make:"Perodua", model:"Kancil",  yearFrom:1994, yearTo:2009, engine_cc:660,  cylinders:3, transmission:"Manual", fuel_type:"Petrol", body_type:"Hatchback", horsepower:32,  doors:5, seats:4, fuel_consumption:17 },
  { make:"Perodua", model:"Kelisa",  yearFrom:2001, yearTo:2007, engine_cc:989,  cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:55,  doors:5, seats:5, fuel_consumption:15 },
  { make:"Perodua", model:"Kenari",  yearFrom:2000, yearTo:2008, engine_cc:989,  cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"MPV",       horsepower:55,  doors:5, seats:5, fuel_consumption:14 },
  { make:"Perodua", model:"Viva",    yearFrom:2007, yearTo:2014, engine_cc:989,  cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:55,  doors:5, seats:5, fuel_consumption:14 },
  { make:"Perodua", model:"Myvi",    yearFrom:2005, yearTo:2011, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:84,  doors:5, seats:5, fuel_consumption:14 },
  { make:"Perodua", model:"Myvi",    yearFrom:2011, yearTo:2017, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:84,  doors:5, seats:5, fuel_consumption:15 },
  { make:"Perodua", model:"Myvi",    yearFrom:2018, yearTo:2099, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:94,  doors:5, seats:5, fuel_consumption:16 },
  { make:"Perodua", model:"Axia",    yearFrom:2014, yearTo:2023, engine_cc:998,  cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:67,  doors:5, seats:5, fuel_consumption:18 },
  { make:"Perodua", model:"Axia",    yearFrom:2023, yearTo:2099, engine_cc:998,  cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:67,  doors:5, seats:5, fuel_consumption:18 },
  { make:"Perodua", model:"Bezza",   yearFrom:2016, yearTo:2019, engine_cc:998,  cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:67,  doors:4, seats:5, fuel_consumption:17 },
  { make:"Perodua", model:"Bezza",   yearFrom:2020, yearTo:2099, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:94,  doors:4, seats:5, fuel_consumption:16 },
  { make:"Perodua", model:"Alza",    yearFrom:2009, yearTo:2022, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"MPV",       horsepower:84,  doors:5, seats:7, fuel_consumption:13 },
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
  { make:"Proton", model:"Saga",       yearFrom:2016, yearTo:2019, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:94,  doors:4, seats:5, fuel_consumption:15 },
  { make:"Proton", model:"Saga",       yearFrom:2019, yearTo:2099, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:95,  doors:4, seats:5, fuel_consumption:16 },
  { make:"Proton", model:"Persona",    yearFrom:2007, yearTo:2016, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:94,  doors:4, seats:5, fuel_consumption:13 },
  { make:"Proton", model:"Persona",    yearFrom:2016, yearTo:2099, engine_cc:1598, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:109, doors:4, seats:5, fuel_consumption:14 },
  { make:"Proton", model:"Exora",      yearFrom:2009, yearTo:2020, engine_cc:1598, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"MPV",       horsepower:109, doors:5, seats:7, fuel_consumption:11 },
  { make:"Proton", model:"Exora",      yearFrom:2020, yearTo:2099, engine_cc:1598, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"MPV",       horsepower:150, doors:5, seats:7, fuel_consumption:13 },
  { make:"Proton", model:"Preve",      yearFrom:2012, yearTo:2018, engine_cc:1598, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:109, doors:4, seats:5, fuel_consumption:13 },
  { make:"Proton", model:"Suprima S",  yearFrom:2012, yearTo:2018, engine_cc:1598, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:109, doors:5, seats:5, fuel_consumption:13 },
  { make:"Proton", model:"Iriz",       yearFrom:2014, yearTo:2019, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:94,  doors:5, seats:5, fuel_consumption:14 },
  { make:"Proton", model:"Iriz",       yearFrom:2019, yearTo:2099, engine_cc:1298, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Hatchback", horsepower:95,  doors:5, seats:5, fuel_consumption:15 },
  { make:"Proton", model:"X50",        yearFrom:2020, yearTo:2099, engine_cc:1499, cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"SUV",       horsepower:177, doors:5, seats:5, fuel_consumption:15 },
  { make:"Proton", model:"X70",        yearFrom:2018, yearTo:2021, engine_cc:1798, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"SUV",       horsepower:181, doors:5, seats:5, fuel_consumption:11 },
  { make:"Proton", model:"X70",        yearFrom:2022, yearTo:2099, engine_cc:1499, cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"SUV",       horsepower:177, doors:5, seats:7, fuel_consumption:14 },
  { make:"Proton", model:"X90",        yearFrom:2023, yearTo:2099, engine_cc:1498, cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"SUV",       horsepower:177, doors:5, seats:7, fuel_consumption:13 },
  { make:"Proton", model:"S70",        yearFrom:2024, yearTo:2099, engine_cc:1498, cylinders:3, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:177, doors:4, seats:5, fuel_consumption:15 },
  { make:"Proton", model:"Perdana",    yearFrom:2016, yearTo:2020, engine_cc:1998, cylinders:4, transmission:"Auto",   fuel_type:"Petrol", body_type:"Sedan",     horsepower:150, doors:4, seats:5, fuel_consumption:11 },
];

const norm = (s) => (s || "").toLowerCase().replace(/[-\s]+/g, "");

export function lookupMYCar(make, model, year) {
  const y = parseInt(year) || 0;
  const m = norm(make);
  const mo = norm(model);

  const match = MY_CAR_SPECS.find(
    (r) =>
      norm(r.make) === m &&
      norm(r.model) === mo &&
      y >= r.yearFrom &&
      y <= r.yearTo,
  );
  return match || null;
}

export function isMYBrand(make) {
  const m = norm(make);
  return m === "perodua" || m === "proton";
}
