import { supabase } from "../supabaseClient";

// Persist one starter-task flag on the seller's own profile row.
//
// Only tasks that CANNOT be derived from real data live here — today that is
// just "the owner opened their own mini page". Adding a listing and writing a
// bio are read straight off car_listings / profiles.bio, because a checklist
// that can disagree with reality is worse than no checklist.
//
// The merge is client-side ({...current, [key]: true}) rather than a jsonb
// `||` concat in SQL. That is safe for this use — these are one-shot flags set
// by a deliberate click, never concurrently — but if this ever grows into
// something written from two places at once, move the merge server-side into an
// RPC so one write cannot clobber the other.
export async function markStarterTask(userId, key, currentTasks) {
  if (!userId || !key) return currentTasks || {};
  const next = { ...(currentTasks || {}), [key]: true };
  // Already set — nothing to write.
  if (currentTasks && currentTasks[key]) return currentTasks;
  const { error } = await supabase
    .from("profiles")
    .update({ starter_tasks: next })
    .eq("id", userId);
  if (error) {
    console.error("markStarterTask:", error);
    return currentTasks || {};
  }
  return next;
}
