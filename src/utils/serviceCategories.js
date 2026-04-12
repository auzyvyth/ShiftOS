// ─── Shared service category config ──────────────────────────────────────────
// Used by: CarForm.jsx, DashboardPage.jsx (popup), CarDetailPage.jsx
//
// Lucide icon components are exported — importers decide how to render them.

import {
  Shield, Eye, BadgeCheck, ShieldCheck, FileText,
  Wrench, Star, Settings, Package,
} from 'lucide-react';

export const CATEGORY_CFG = {
  protection:  { icon: Shield,      color: '#60a5fa',  twColor: 'text-blue-400',    label: 'Protection Film'  },
  tint:        { icon: Eye,         color: '#a78bfa',  twColor: 'text-purple-400',  label: 'Window Tint'      },
  window_tint: { icon: Eye,         color: '#a78bfa',  twColor: 'text-purple-400',  label: 'Window Tint'      },
  warranty:    { icon: BadgeCheck,  color: '#4ade80',  twColor: 'text-green-400',   label: 'Warranty'         },
  insurance:   { icon: ShieldCheck, color: '#34d399',  twColor: 'text-emerald-400', label: 'Insurance'        },
  road_tax:    { icon: FileText,    color: '#fbbf24',  twColor: 'text-yellow-400',  label: 'Road Tax'         },
  service:     { icon: Wrench,      color: '#fb923c',  twColor: 'text-orange-400',  label: 'Service Package'  },
  accessories: { icon: Star,        color: '#f472b6',  twColor: 'text-pink-400',    label: 'Accessories'      },
  workshop:    { icon: Settings,    color: '#67e8f9',  twColor: 'text-cyan-400',    label: 'Workshop'         },
  other:       { icon: Package,     color: '#9ca3af',  twColor: 'text-gray-400',    label: 'Other'            },
};

/** Returns the config for a given category slug, falling back to 'other'. */
export const getCategoryCfg = (category) =>
  CATEGORY_CFG[category] || CATEGORY_CFG.other;

/** Returns the icon string identifier used when persisting to JSONB. */
export const getCategoryIcon = (category) => category;
