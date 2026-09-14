import { CAR_DATA } from '../data/carData';

// Flat "Brand" + "Brand Model" list for the search suggestions dropdown.
// This is the SAME make/model catalogue CarForm's dropdowns use (carData.js),
// reused here so SearchAutocomplete can suggest as the user types with ZERO
// network calls — no more firing a query on every keystroke. Built once at
// module load, not per keystroke or per render.
export const SEARCH_TERMS = Object.entries(CAR_DATA).flatMap(([brand, models]) => [
  brand,
  ...models.map(model => `${brand} ${model}`),
]);
