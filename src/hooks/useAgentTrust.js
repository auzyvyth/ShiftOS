import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// The agent page's trust signals, read once the agent is known:
//   recentSales - get_agent_recent_sales (car + month sold; no price, no buyer)
//   reply       - get_agent_reply_time   (measured from chat, replaces the
//                 old self-typed profiles.response_time)
//   seller      - get_salesman_by_id     (deposit policy / fee the agent set)
// Each is independent: a failed or missing RPC leaves its value null and the
// page simply omits that block. Never fall back to a guess.
export function useAgentTrust(agentId) {
  const [state, setState] = useState({ recentSales: [], reply: null, seller: null });

  useEffect(() => {
    if (!agentId) return undefined;
    let cancelled = false;
    Promise.all([
      supabase.rpc('get_agent_recent_sales', { p_salesman_id: agentId, p_limit: 6 }),
      supabase.rpc('get_agent_reply_time', { p_salesman_id: agentId }).maybeSingle(),
      supabase.rpc('get_salesman_by_id', { p_id: agentId }).maybeSingle(),
    ]).then(([sales, reply, seller]) => {
      if (cancelled) return;
      setState({
        recentSales: sales.error ? [] : (sales.data || []),
        reply: reply.error ? null : reply.data,
        seller: seller.error ? null : seller.data,
      });
    }).catch(() => { /* network failure: show nothing, never a guess */ });
    return () => { cancelled = true; };
  }, [agentId]);

  return state;
}
