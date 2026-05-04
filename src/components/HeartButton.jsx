import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useSavedCars } from '../hooks/useSavedCars';

export default function HeartButton({ listingId, size = 20, style }) {
  const { isSaved, toggleSave } = useSavedCars();
  const [bounce, setBounce] = useState(false);
  const saved = isSaved(listingId);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!saved) {
      setBounce(true);
      setTimeout(() => setBounce(false), 400);
    }
    toggleSave(listingId);
  };

  return (
    <>
      <style>{`
        @keyframes hb-bounce {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.45); }
          65%  { transform: scale(0.88); }
          100% { transform: scale(1); }
        }
        .hb-bounce { animation: hb-bounce 0.38s ease; }
      `}</style>
      <button
        onClick={handleClick}
        className={bounce ? 'hb-bounce' : ''}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: saved ? '#dc2626' : 'rgba(255,255,255,0.5)',
          transition: 'color 0.18s',
          lineHeight: 1,
          ...style,
        }}
        aria-label={saved ? 'Remove from saved' : 'Save listing'}
      >
        <Heart
          size={size}
          fill={saved ? '#dc2626' : 'none'}
          strokeWidth={1.8}
        />
      </button>
    </>
  );
}
