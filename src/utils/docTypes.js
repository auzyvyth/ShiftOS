// The document kinds a listing can carry, with the label and colour used
// wherever documents are shown.
//
// This lived inside CarForm.jsx. It moved here because the platform review
// modal needs the labels too, and importing them from CarForm dragged the
// entire 3,500-line listing form into the /platform bundle for the sake of
// nine strings. CarForm, CarDetailPopup and ListingReviewModal all read this
// one list — do not re-declare the keys anywhere else.
export const DOC_TYPES = [
  { key: "registration_card", label: "Geran / Registration Card", color: "#0ea5e9" },
  { key: "puspakom", label: "Puspakom Inspection", color: "#22c55e" },
  { key: "service_history", label: "Service History", color: "#60a5fa" },
  { key: "insurance", label: "Insurance Certificate", color: "#a78bfa" },
  { key: "ownership", label: "Ownership / VOC", color: "#fbbf24" },
  { key: "warranty", label: "Warranty Certificate", color: "#34d399" },
  { key: "import_ap", label: "Import / AP Permit", color: "#fb923c" },
  { key: "loan_clearance", label: "Loan Clearance Letter", color: "#94a3b8" },
  { key: "other", label: "Other Document", color: "#6b7280" },
];

export const docTypeCfg = (type) =>
  DOC_TYPES.find((d) => d.key === type) || DOC_TYPES[DOC_TYPES.length - 1];
