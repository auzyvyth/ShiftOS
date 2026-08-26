import { supabase } from "../supabaseClient";

/**
 * Create a realtime channel that is guaranteed to be FRESH.
 *
 * Why this exists: supabase-js keeps one channel per topic. `supabase.channel(t)`
 * returns the EXISTING channel if one with that topic is already registered
 * (realtime-js RealtimeClient.channel -> `const exists = this.getChannels().find(...)`).
 * If that existing channel is already joined/joining, the very next
 * `.on("postgres_changes", ...)` THROWS:
 *   cannot add `postgres_changes` callbacks for realtime:<topic> after `subscribe()`.
 * Because our subscriptions are set up inside async bootstrap chains, that throw
 * surfaces as an unhandledrejection rather than a caught error.
 *
 * A stale channel survives when a page unmounts while its bootstrap promise is
 * still in flight: the effect cleanup runs before the channel ref was ever set,
 * so nothing is removed, then the orphaned chain subscribes anyway. The next
 * mount collides with it.
 *
 * This helper drops any channel already holding the topic before building a new
 * one, so a re-subscribe can never inherit a joined channel.
 */
export function freshChannel(topic, params) {
  const full = `realtime:${topic}`;
  supabase
    .getChannels()
    .filter((c) => c.topic === full)
    .forEach((c) => supabase.removeChannel(c));
  return params ? supabase.channel(topic, params) : supabase.channel(topic);
}
