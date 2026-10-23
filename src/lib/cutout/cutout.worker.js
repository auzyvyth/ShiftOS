// Background cut-out, run OFF the main thread (CUTOUT-1). The model is ISNet
// (DIS project, Apache-2.0), weights stored as 8-bit and turned back into
// float32 at load, so it matches the full model on car photos while being a
// quarter of the size. Nothing leaves the phone: no photo is uploaded anywhere.
import { InferenceSession, Tensor, env } from 'onnxruntime-web/wasm';

const CUTOUT_CACHE = 'xd-cutout-v1'; // same name as index.js reads

let sessionPromise = null;

async function loadModel(url, expectedBytes) {
  let cache = null;
  try { cache = await caches.open(CUTOUT_CACHE); } catch { /* private mode: no Cache Storage */ }
  const hit = cache ? await cache.match(url) : null;
  if (hit) return new Uint8Array(await hit.arrayBuffer());

  const res = await fetch(url);
  if (!res.ok) throw new Error(`model_http_${res.status}`);
  // content-length is the COMPRESSED size if the CDN gzips; the real size is
  // known, so progress uses whichever is larger and never passes 100%.
  const total = Math.max(Number(res.headers.get('content-length')) || 0, expectedBytes || 0);
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    self.postMessage({ type: 'progress', loaded: Math.min(loaded, total), total });
  }
  const bytes = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.length; }
  if (cache) {
    cache.put(url, new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {});
  }
  return bytes;
}

function getSession(url, expectedBytes) {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      // Threads need cross-origin isolation, which the site does not have;
      // ask for one so the runtime never tries to spawn them.
      env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
      const bytes = await loadModel(url, expectedBytes);
      self.postMessage({ type: 'working' });
      return InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    })();
    // a failed load (offline, 404) must be retryable, not cached forever
    sessionPromise.catch(() => { sessionPromise = null; });
  }
  return sessionPromise;
}

self.onmessage = async (e) => {
  const { id, modelUrl, modelBytes, input, size } = e.data;
  try {
    const session = await getSession(modelUrl, modelBytes);
    self.postMessage({ type: 'working' });
    const feeds = { [session.inputNames[0]]: new Tensor('float32', input, [1, 3, size, size]) };
    const out = await session.run(feeds);
    const mask = out[session.outputNames[0]].data;
    self.postMessage({ type: 'done', id, mask }, [mask.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String(err?.message || err) });
  }
};
