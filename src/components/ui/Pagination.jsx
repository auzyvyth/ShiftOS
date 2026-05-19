import { ChevronLeft, ChevronRight } from 'lucide-react';

// Page number bar with smart ellipsis.
// Renders nothing when totalPages <= 1.
export default function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else if (page <= 4) {
    pages.push(1, 2, 3, 4, 5, '…', totalPages);
  } else if (page >= totalPages - 3) {
    pages.push(1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
  } else {
    pages.push(1, '…', page - 1, page, page + 1, '…', totalPages);
  }

  const btn = {
    minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', borderRadius: '9px', border: '1px solid rgba(0,0,0,0.1)',
    background: '#ffffff', color: '#374151', fontSize: '14px', fontWeight: '600',
    cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Outfit',sans-serif", padding: '0 8px',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', flexWrap: 'wrap' }}>
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        style={{ ...btn, opacity: page === 1 ? 0.35 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer', gap: '4px', padding: '0 12px', fontSize: '13px' }}
      >
        <ChevronLeft size={15} /> Prev
      </button>

      {pages.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} style={{ color: '#9ca3af', padding: '0 4px' }}>…</span>
          : <button
              key={p}
              onClick={() => onPage(p)}
              style={{ ...btn, background: p === page ? '#dc2626' : '#ffffff', borderColor: p === page ? '#dc2626' : 'rgba(0,0,0,0.1)', color: p === page ? '#fff' : '#374151' }}
            >
              {p}
            </button>
      )}

      <button
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        style={{ ...btn, opacity: page === totalPages ? 0.35 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer', gap: '4px', padding: '0 12px', fontSize: '13px' }}
      >
        Next <ChevronRight size={15} />
      </button>
    </div>
  );
}
