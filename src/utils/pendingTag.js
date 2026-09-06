// A "type it, press Enter, it becomes a chip" input hides a trap: whatever is
// still sitting in the text box when the user hits Save/Generate is their
// answer too, and dropping it silently loses what they typed. Every such input
// commits through here.
//
// This was live on the salesman specialization tags: the save wrote the empty
// array over the profile, so no seller on the platform ever had a tag on their
// public mini page.
export function mergePendingTag(list, pending) {
  const tags = Array.isArray(list) ? list : [];
  const val = (pending || '').trim();
  if (!val || tags.includes(val)) return tags;
  return [...tags, val];
}
