import { supabase } from "../supabaseClient";

// Persist starter-task flags on the seller's own profile row.
//
// Only tasks that CANNOT be derived from real data live here: "the owner opened
// their own mini page", "the owner opened the Live presenter", and the two
// dismissals. Listings, bio, leads and reminders are read straight off the real
// rows, because a checklist that can disagree with reality is worse than none.
//
// `keys` is one key or an array. The merge reads the CURRENT value from the
// row first instead of trusting the caller's copy: the panels never write a
// dismissal back into local state (so the "done" screen stays visible), and
// the mini page has no starter_tasks at all, so merging onto a stale or
// missing copy would silently wipe flags already set.
export async function markStarterTask(userId, keys, currentTasks) {
  const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (!userId || !list.length) return currentTasks || {};
  // Already set locally: nothing to write.
  if (currentTasks && list.every((k) => currentTasks[k])) return currentTasks;

  const { data: row, error: readError } = await supabase
    .from("profiles")
    .select("starter_tasks")
    .eq("id", userId)
    .maybeSingle();
  if (readError) {
    console.error("markStarterTask:", readError);
    return currentTasks || {};
  }
  const stored = row?.starter_tasks || {};
  if (list.every((k) => stored[k])) return { ...(currentTasks || {}), ...stored };
  const next = { ...stored };
  list.forEach((k) => { next[k] = true; });

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
