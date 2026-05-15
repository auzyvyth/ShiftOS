import React, { useState } from 'react';
import { Trash2, ChevronRight } from 'lucide-react';

const FIELDS = [
  'brand','model','variant','year','price','mileage','color',
  'transmission','fuel_type','engine_cc','condition',
  'state','auction_grade','interior_grade','import_country','vin','registration_date','options',
];

function fmt(n) { return n?.toLocaleString() ?? '—'; }

function UsageBar({ usage }) {
  if (!usage) return null;
  const { inputTokens, outputTokens } = usage;
  const total = inputTokens + outputTokens;
  const cost = ((inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15).toFixed(4);
  return (
    <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: '#6b7280' }}>
      <span>In: <b className="text-gray-400">{fmt(inputTokens)}</b></span>
      <span>Out: <b className="text-gray-400">{fmt(outputTokens)}</b></span>
      <span>Total: <b className="text-gray-400">{fmt(total)}</b></span>
      <span style={{ color: '#4ade80' }}>~${cost} used</span>
    </div>
  );
}

export default function Step2Preview({ rows: initial, usage, onBack, onNext }) {
  const [rows, setRows] = useState(initial);

  const update = (i, field, val) =>
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const remove = (i) => setRows(r => r.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">Extracted Cars</span>
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: 'rgba(220,38,38,0.15)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)' }}
          >
            {rows.length} {rows.length === 1 ? 'car' : 'cars'} ready to import
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setRows(r => r.map(row => ({ ...row, condition: 'Recon' })))}
            className="text-xs font-bold px-2.5 py-1 rounded-full transition-colors"
            style={{ background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.22)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.12)'; }}
          >
            Mark all Recon
          </button>
          <p className="text-xs text-gray-600">Click any cell to edit · Delete rows with <Trash2 className="w-3 h-3 inline mx-0.5" /></p>
        </div>
      </div>

      <UsageBar usage={usage} />

      {/* Table */}
      <div className="rounded-xl overflow-auto" style={{ border: '1px solid rgba(255,255,255,0.07)', maxHeight: 420 }}>
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {FIELDS.map(f => (
                <th key={f} className="text-left px-3 py-2.5 text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">{f}</th>
              ))}
              <th className="px-3 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={FIELDS.length + 1} className="text-center text-gray-600 py-10">No rows — go back and try again</td></tr>
            ) : rows.map((row, i) => (
              <tr
                key={i}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                className="hover:bg-white/[0.015] transition-colors"
              >
                {FIELDS.map(f => (
                  <td key={f} className="px-1.5 py-1">
                    <input
                      value={row[f] ?? ''}
                      onChange={(e) => update(i, f, e.target.value)}
                      className="w-full bg-transparent text-gray-300 rounded px-2 py-1 focus:outline-none focus:bg-white/[0.05] transition-colors text-xs"
                      style={{ minWidth: f === 'description' ? 160 : 80 }}
                    />
                  </td>
                ))}
                <td className="px-2 py-1">
                  <button onClick={() => remove(i)} className="text-gray-700 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          ← Back
        </button>
        <button
          onClick={() => onNext(rows)}
          disabled={rows.length === 0}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
          style={{
            background: rows.length > 0 ? '#dc2626' : 'rgba(255,255,255,0.05)',
            color: rows.length > 0 ? '#fff' : '#4b5563',
            cursor: rows.length > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          Import {rows.length} {rows.length === 1 ? 'car' : 'cars'} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
