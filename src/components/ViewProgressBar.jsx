import { useViewProgress } from '../hooks/useViewProgress';
import { barWidth } from '../utils/viewProgress';

// The YouTube-style red line along the bottom edge of a car's photo: how much of
// that car's page this buyer has read (REVISIT-1). Renders nothing for a car
// never opened. The parent must be position:relative.
export default function ViewProgressBar({ carId }) {
  const { byId } = useViewProgress();
  const w = barWidth(byId.get(String(carId)));
  if (!w) return null;
  return (
    <div
      role="img"
      aria-label={w >= 1 ? 'Viewed' : `Viewed ${Math.round(w * 100)}%`}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,0.35)', zIndex: 3, pointerEvents: 'none' }}
    >
      <div style={{ width: `${w * 100}%`, height: '100%', background: '#dc2626' }} />
    </div>
  );
}
