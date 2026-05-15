import React from 'react';
import { CheckCircle2, Loader, ArrowRight } from 'lucide-react';

export default function Step3Import({ rows, importing, imported, error, onImport, onDone }) {
  if (imported !== null) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
        >
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <div>
          <p className="text-xl font-bold text-white">{imported} {imported === 1 ? 'car' : 'cars'} imported</p>
          <p className="text-sm text-gray-500 mt-1">All listings are live on the marketplace. Add photos from Dashboard → Listings to improve visibility.</p>
        </div>
        <button
          onClick={onDone}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: '#dc2626' }}
        >
          Go to Listings <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div
        className="rounded-xl p-5 flex items-center gap-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl font-black"
          style={{ background: 'rgba(220,38,38,0.1)', color: '#ef4444' }}
        >
          {rows.length}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{rows.length} {rows.length === 1 ? 'car listing' : 'car listings'} ready</p>
          <p className="text-xs text-gray-500 mt-0.5">Will be inserted as active listings in your stock</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm text-red-400" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onImport}
          disabled={importing || rows.length === 0}
          className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
          style={{
            background: !importing && rows.length > 0 ? '#dc2626' : 'rgba(255,255,255,0.05)',
            color: !importing && rows.length > 0 ? '#fff' : '#4b5563',
            cursor: !importing && rows.length > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          {importing ? (
            <><Loader className="w-4 h-4 animate-spin" /> Importing…</>
          ) : (
            <>Confirm Import</>
          )}
        </button>
      </div>
    </div>
  );
}
