// Custom font manager for TikTok Studio.
// Uploaded fonts are stored as blobs in IndexedDB (survives reloads, stays on
// the user's device — no re-upload) and registered with the FontFace API so
// they're immediately usable in both the DOM preview and canvas export.

const DB_NAME = "ttsv3-fonts";
const STORE = "fonts";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function sanitizeFamily(name) {
  const base = (name || "Custom Font").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9 _-]/g, "").trim();
  return base || "Custom Font";
}

async function registerFont(family, buffer) {
  try {
    const ff = new FontFace(family, buffer);
    await ff.load();
    document.fonts.add(ff);
    return true;
  } catch {
    return false;
  }
}

// Load + register every saved font. Call once on studio open.
export async function loadCustomFonts() {
  try {
    const db = await openDB();
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    const metas = [];
    for (const r of rows) {
      await registerFont(r.family, r.buffer.slice(0));
      metas.push({ id: r.id, family: r.family, label: r.family });
    }
    return metas;
  } catch {
    return [];
  }
}

// Save a newly uploaded font file → register + persist. Returns meta.
export async function saveCustomFont(file) {
  const buffer = await file.arrayBuffer();
  let family = sanitizeFamily(file.name);
  const id = "cf_" + Date.now();
  // Avoid family-name collisions so different uploads don't clobber each other
  if (document.fonts && [...document.fonts].some((f) => f.family === family)) {
    family = `${family} ${id.slice(-4)}`;
  }
  const ok = await registerFont(family, buffer.slice(0));
  if (!ok) throw new Error("unsupported_font");
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ id, family, buffer, savedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
  return { id, family, label: family };
}

export async function deleteCustomFont(id) {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}
