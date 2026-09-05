// Specialization tags are entered one at a time into a text box and only become
// a tag on Enter / Add. Whatever is still sitting in that box when the user hits
// Save is their answer too — dropping it wrote an empty array over the profile
// and the pills never appeared on the public mini page. Both the Premium
// settings tab and the linked-salesman panel commit through here so the two
// cannot drift.
export function mergePendingTag(list, pending) {
  const tags = Array.isArray(list) ? list : [];
  const val = (pending || '').trim();
  if (!val || tags.includes(val)) return tags;
  return [...tags, val];
}
