import React from 'react';
import { CheckCircle2, Loader, ArrowRight } from 'lucide-react';

export default function Step3Import({ rows, importing, imported, error, onImport, onDone, progressMsg }) {
  if (imported !== null) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: '#f5f6f8', border: 'none' }}
        >
          <CheckCircle2 className="w-8 h-8 text-green-700" />
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{imported} {imported === 1 ? 'car' : 'cars'} imported</p>
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
        style={{ background: '#f5f6f8', border: '1px solid transparent' }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl font-black"
          style={{ background: '#f5f6f8', color: '#b91c1c' }}
        >
          {rows.length}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{rows.length} {rows.length === 1 ? 'car listing' : 'car listings'} ready</p>
          <p className="text-xs text-gray-500 mt-0.5">Will be inserted as active listings in your stock</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm text-red-700" style={{ background: '#f5f6f8', border: 'none' }}>
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onImport}
          disabled={importing || rows.length === 0}
          className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
          style={{
            background: !importing && rows.length > 0 ? '#dc2626' : '#f5f6f8',
            color: !importing && rows.length > 0 ? '#fff' : '#9ca3af',
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

      {importing && progressMsg && (
        <p className="text-xs text-center text-gray-500">{progressMsg}</p>
      )}
    </div>
  );
}
