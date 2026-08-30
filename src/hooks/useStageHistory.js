import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// Stage-change history for a salesman's leads, used by the Performance tab's
// funnel (src/utils/salesPerformance.js).
//
// Why it needs its own read: `leads.stage` only says where a lead is NOW. A
// deal that died after a test drive currently reads as `lost`, which would put
// it at the very top of the funnel and blame "New" for a loss that actually
// happened four steps in. `lead_activities` rows of type `stage_changed` carry
// `to_stage`, so they reconstruct how far each lead really got.
//
// It is deliberately NOT loaded with the page. The Performance tab is lazy, so
// this only runs when someone opens it — the pipeline, dashboard and inbox
// gain no query. Columns are narrowed to the three the funnel reads: no buyer
// name, phone or note ever comes back through here.
export default function useStageHistory(leadIds) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sorted + joined so a re-render with the same ids in a different order does
  // not refetch. Leads arrive ordered by updated_at, which changes constantly.
  const key = Array.isArray(leadIds) ? [...leadIds].sort().join(',') : '';

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(',') : [];

    if (!ids.length) { setRows([]); setLoading(false); setError(null); return; }

    setLoading(true);
    // Chunked: `in` builds a URL, and a rep with hundreds of leads would push
    // it past the server's URL length limit and fail the whole read.
    const CHUNK = 200;
    const chunks = [];
    for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));

    Promise.all(
      chunks.map((chunk) =>
        supabase
          .from('lead_activities')
          .select('lead_id, to_stage, created_at')
          .eq('activity_type', 'stage_changed')
          .in('lead_id', chunk),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const failed = results.find((r) => r.error);
        if (failed) {
          console.error('useStageHistory:', failed.error);
          // Surfaced, not swallowed: the funnel reads very differently without
          // history, so the card says so rather than quietly showing a shape
          // that blames the wrong stage.
          setError(failed.error);
          setRows([]);
        } else {
          setError(null);
          setRows(results.flatMap((r) => r.data || []));
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('useStageHistory:', err);
        setError(err);
        setRows([]);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [key]);

  return { rows, loading, error };
}
