// ─── "This slide | All slides" (STUDIO-UX-2) ─────────────────────────────────
// A seller with 5 photos sets the look once on every slide, then fixes the
// details slide by slide. Objects that are "the same thing" on every slide
// share a `link` key: one template applied to all slides, one text added to
// all slides, the dark gradient every slide starts with. In All slides mode an
// edit to one object is applied to every object with its link, live.
// An object with no link (made in This slide mode) only ever edits itself.
// Pure functions, unit-tested: npm run test:scope.

// The cross-slide key of an element or layer, or null. Every slide's watermark
// element has the fixed id "watermark", so it is linked without a field.
export function linkKey(o) {
  if (!o) return null;
  if (o.link) return o.link;
  if (o.id === "watermark") return "watermark";
  return null;
}

// Apply `fn(item) -> item` to the objects in `field` ("elements" | "layers")
// that `pick(item)` selects, on every slide except `skipIdx` (pass -1 for none).
function mapLinked(slides, field, skipIdx, pick, fn) {
  return slides.map((s, i) => {
    if (i === skipIdx) return s;
    const list = s[field] || [];
    let hit = false;
    const next = list.map((o) => {
      if (!pick(o)) return o;
      hit = true;
      return fn(o);
    });
    return hit ? { ...s, [field]: next } : s;
  });
}

// Patch one element on the active slide, and (all = true) its linked copies on
// every other slide. Returns new slides.
export function patchElements(slides, active, id, patch, all) {
  const el = (slides[active]?.elements || []).find((e) => e.id === id);
  const key = all ? linkKey(el) : null;
  return slides.map((s, i) => {
    if (i !== active && !key) return s;
    const list = s.elements || [];
    let hit = false;
    const next = list.map((e) => {
      const match = i === active ? e.id === id : linkKey(e) === key;
      if (!match) return e;
      hit = true;
      return { ...e, ...patch };
    });
    return hit ? { ...s, elements: next } : s;
  });
}

// Remove one element (and, all = true, its linked copies).
export function removeElements(slides, active, id, all) {
  const el = (slides[active]?.elements || []).find((e) => e.id === id);
  const key = all ? linkKey(el) : null;
  return slides.map((s, i) => {
    if (i !== active && !key) return s;
    const list = s.elements || [];
    const next = list.filter((e) => !(i === active ? e.id === id : linkKey(e) === key));
    return next.length === list.length ? s : { ...s, elements: next };
  });
}

// Move one element a step up/down the stacking order (its array position).
export function shiftElements(slides, active, id, dir, all) {
  const el = (slides[active]?.elements || []).find((e) => e.id === id);
  const key = all ? linkKey(el) : null;
  return slides.map((s, i) => {
    if (i !== active && !key) return s;
    const list = [...(s.elements || [])];
    const at = list.findIndex((e) => (i === active ? e.id === id : linkKey(e) === key));
    if (at < 0) return s;
    const to = dir === "front" ? list.length - 1 : dir === "back" ? 0 : at + (dir === "up" ? 1 : -1);
    if (to < 0 || to >= list.length || to === at) return s;
    const [moved] = list.splice(at, 1);
    list.splice(to, 0, moved);
    return { ...s, elements: list };
  });
}

// Layer geometry is % of the canvas; keep it inside like the layer editor does.
export function clampLayer(l) {
  const width = Math.max(5, Math.min(95, l.width));
  const height = Math.max(5, Math.min(95, l.height));
  return {
    ...l,
    width,
    height,
    x: Math.max(0, Math.min(100 - width, l.x)),
    y: Math.max(0, Math.min(100 - height, l.y)),
  };
}

// The ACTIVE slide's layers live in the layer editor, so these only touch the
// other slides (skip = the active index); the caller updates the editor.
export function patchOtherLayers(slides, skip, key, patch) {
  if (!key) return slides;
  const geo = "x" in patch || "y" in patch || "width" in patch || "height" in patch;
  return mapLinked(slides, "layers", skip, (l) => linkKey(l) === key, (l) => {
    const next = { ...l, ...patch };
    return geo ? clampLayer(next) : next;
  });
}

export function removeOtherLayers(slides, skip, key) {
  if (!key) return slides;
  return slides.map((s, i) => {
    if (i === skip) return s;
    const list = s.layers || [];
    const next = list.filter((l) => linkKey(l) !== key);
    return next.length === list.length ? s : { ...s, layers: next };
  });
}

// Add a copy of `make()` to every other slide (make returns a fresh object
// each call, so no two slides share an id).
export function addToOthers(slides, skip, field, make) {
  return slides.map((s, i) => (i === skip ? s : { ...s, [field]: [...(s[field] || []), make(s, i)] }));
}

// Patch the photo settings of the active slide, or every slide. `fn(slide)`
// returns the patch, so a single field of a nested object (one adjustment,
// the car size) changes without overwriting each slide's other fields.
export function patchPhotos(slides, active, fn, all) {
  return slides.map((s, i) => (all || i === active ? { ...s, ...fn(s) } : s));
}
