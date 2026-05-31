// ─── Shared service category config ──────────────────────────────────────────
// Used by: CarForm.jsx, DashboardPage.jsx (popup), CarDetailPage.jsx
//
// Lucide icon components are exported — importers decide how to render them.

import {
  Shield, Eye, BadgeCheck, ShieldCheck, FileText,
  Wrench, Star, Settings, Package,
} from 'lucide-react';

export const CATEGORY_CFG = {
  protection:  { icon: Shield,      color: '#60a5fa',  twColor: 'text-blue-400',    label: 'Protection Film'    },
  tint:        { icon: Eye,         color: '#a78bfa',  twColor: 'text-purple-400',  label: 'Window Tint'        },
  window_tint: { icon: Eye,         color: '#a78bfa',  twColor: 'text-purple-400',  label: 'Window Tint'        },
  warranty:    { icon: BadgeCheck,  color: '#4ade80',  twColor: 'text-green-400',   label: 'Extended Warranty'  },
  insurance:   { icon: ShieldCheck, color: '#34d399',  twColor: 'text-emerald-400', label: 'Insurance'          },
  road_tax:    { icon: FileText,    color: '#fbbf24',  twColor: 'text-yellow-400',  label: 'Road Tax'           },
  service:     { icon: Wrench,      color: '#fb923c',  twColor: 'text-orange-400',  label: 'Service Package'    },
  accessories: { icon: Star,        color: '#f472b6',  twColor: 'text-pink-400',    label: 'Accessories'        },
  workshop:    { icon: Settings,    color: '#67e8f9',  twColor: 'text-cyan-400',    label: 'Workshop'           },
  other:       { icon: Package,     color: '#9ca3af',  twColor: 'text-gray-400',    label: 'Other'              },
};

/** Returns the config for a given category slug, falling back to 'other'. */
export const getCategoryCfg = (category) =>
  CATEGORY_CFG[category] || CATEGORY_CFG.other;

/** Returns the icon string identifier used when persisting to JSONB. */
export const getCategoryIcon = (category) => category;

// ─── Derived option lists (single source of truth for product/service pickers) ─
// Ordered slugs for dropdowns. `tint` is an alias of `window_tint`, so the
// canonical picker uses window_tint and omits the duplicate.
const CATEGORY_ORDER = [
  'protection', 'window_tint', 'warranty', 'insurance',
  'road_tax', 'service', 'accessories', 'workshop', 'other',
];

const hexToRgba = (hex, alpha) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

/** [{ value, label }] — minimal picker (ProductsCatalogue in DashboardPage). */
export const PRODUCT_CATEGORY_OPTIONS = CATEGORY_ORDER.map((value) => ({
  value,
  label: CATEGORY_CFG[value].label,
}));

/** [{ value, label, color, bg, border }] — tinted-pill picker (ServicesPage). */
export const SERVICE_CATEGORY_OPTIONS = CATEGORY_ORDER.map((value) => {
  const { label, color } = CATEGORY_CFG[value];
  return { value, label, color, bg: hexToRgba(color, 0.1), border: hexToRgba(color, 0.2) };
});
