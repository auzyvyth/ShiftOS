import { supabase } from "../supabaseClient";

// Persist one starter-task flag on the seller's own profile row.
//
// Only tasks that CANNOT be derived from real data live here — today that is
// just "the owner opened their own mini page". Adding a listing and writing a
// bio are read straight off car_listings / profiles.bio, because a checklist
// that can disagree with reality is worse than no checklist.
//
// The merge re-reads the row first. Callers pass the bag from their render,
// which is often stale (a tab intro marked a minute ago is not in it), and
// writing that stale bag back erased the newer flags: intro "seen" keys were
// wiped this way and the intros kept replaying (2026-10-18).
export async function markStarterTask(userId, key, currentTasks) {
  if (!userId || !key) return currentTasks || {};
  // Already set — nothing to write.
  if (currentTasks && currentTasks[key]) return currentTasks;
  const { data: row } = await supabase
    .from("profiles")
    .select("starter_tasks")
    .eq("id", userId)
    .maybeSingle();
  const next = { ...(currentTasks || {}), ...(row?.starter_tasks || {}), [key]: true };
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
