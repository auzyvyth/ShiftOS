// Option lists for the listing form. Shared by CarForm's classic layout and
// the quick one-question-per-screen flow (QuickCarFlow) so the two can never
// offer different choices for the same field.
export const CONDITIONS = ["used", "recon", "new"];
export const BODY_TYPES = ["Sedan", "SUV", "MPV", "Hatchback", "Coupe", "Pickup"];
export const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric"];
export const TRANSMISSIONS = ["Auto", "Manual"];
export const CC_PRESETS = [660, 1000, 1300, 1500, 1600, 1800, 2000, 2500, 3000, 3500];

// Brands shown as tiles before the full A-Z list — roughly what Malaysian
// sellers list most. Any brand not in CAR_DATA is skipped at render.
export const POPULAR_BRANDS = [
  "Perodua", "Proton", "Honda", "Toyota", "Nissan", "Mazda",
  "BMW", "Mercedes-Benz", "Mitsubishi", "Hyundai", "Kia", "Volkswagen",
];

// Colour swatches. The stored value is the label, same as a typed colour, so
// nothing downstream changes; "Other" still lets a seller type "Pearl White".
export const COLOURS = [
  { label: "White",  hex: "#ffffff" },
  { label: "Black",  hex: "#111827" },
  { label: "Silver", hex: "#c0c4c9" },
  { label: "Grey",   hex: "#6b7280" },
  { label: "Red",    hex: "#b91c1c" },
  { label: "Blue",   hex: "#1d4ed8" },
  { label: "Brown",  hex: "#78350f" },
  { label: "Beige",  hex: "#d6c7a1" },
  { label: "Gold",   hex: "#b8963e" },
  { label: "Green",  hex: "#166534" },
  { label: "Orange", hex: "#ea580c" },
  { label: "Yellow", hex: "#facc15" },
];

export const CONDITION_COPY = {
  used:  { label: "Used",  hint: "Registered and driven in Malaysia" },
  recon: { label: "Recon", hint: "Imported used, first registration here" },
  new:   { label: "New",   hint: "Never registered" },
};
