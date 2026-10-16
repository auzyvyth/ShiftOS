// Builds a phone-friendly HTML page from docs/ARCHITECTURE.md (the source of truth).
// Usage: node tools/build-system-map.mjs <out.html>  (write it outside the repo; publish it, don't commit it)
// Diagrams are rendered in the page by mermaid and open in a full-screen viewer with
// pinch / drag / wheel zoom, because a wide flowchart is unreadable at 375px.
import fs from 'node:fs';

const md = fs.readFileSync(new URL('../docs/ARCHITECTURE.md', import.meta.url), 'utf8');
const out = process.argv[2];
if (!out) { console.error('usage: node tools/build-system-map.mjs <out.html>'); process.exit(1); }

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

const lines = md.split('\n');
let title = 'System map';
const body = [];
const nav = [];
let para = [];
let n = 0;
const flush = () => { if (para.length) { body.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.startsWith('```mermaid')) {
    flush();
    const src = [];
    while (!lines[++i].startsWith('```')) src.push(lines[i]);
    n++;
    body.push(`<figure class="dg"><button type="button" class="open" aria-label="Open diagram ${n} full screen">` +
      `<div class="slot" data-n="${n}"><span class="wait">Drawing…</span></div><span class="hint">Tap to zoom</span></button>` +
      `<script type="text/plain" class="src">${src.join('\n').replace(/<\/script/gi, '<\\/script')}</script></figure>`);
  } else if (l.startsWith('# ')) {
    flush(); title = l.slice(2).trim();
  } else if (l.startsWith('## ') || l.startsWith('### ')) {
    flush();
    const lvl = l.startsWith('## ') ? 2 : 3;
    const text = l.replace(/^#+\s*/, '').replace(/^\d+\.\s*/, '');
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (lvl === 2) nav.push(`<a href="#${id}">${esc(text)}</a>`);
    body.push(`<h${lvl} id="${id}">${inline(text)}</h${lvl}>`);
  } else if (l.startsWith('|')) {
    flush();
    const rows = [];
    while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
    i--;
    const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const head = cells(rows[0]);
    const data = rows.slice(2).map(cells);
    body.push(`<div class="tw"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>` +
      data.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('') + '</tbody></table></div>');
  } else if (/^---\s*$/.test(l) || l.trim() === '') {
    flush();
  } else if (!nav.length && !/^Last checked/.test(l)) {
    // intro before the first section is a note for whoever edits the file
  } else {
    para.push(l.trim());
  }
}
flush();

const html = `<title>ShiftOS System Map</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600&family=JetBrains+Mono&display=swap">
<style>
/* Layout: one reading column, sticky chip nav; diagrams open in a full-screen pan/zoom viewer */
:root {
  --bg:#F6F6F4; --panel:#FFFFFF; --line:#E3E2DE; --fg:#14161B; --muted:#5E6470; --accent:#C81E1E; --accent-soft:rgba(200,30,30,.08); 
  --display:'Bebas Neue', Impact, 'Arial Narrow', sans-serif;
  --body:'Outfit', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono:'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg:#080C14; --panel:#0F1520; --line:#222B38; --fg:#E8EAEE; --muted:#9097A3; --accent:#EF4444; --accent-soft:rgba(239,68,68,.12); color-scheme: dark; } }
:root[data-theme="dark"] { --bg:#080C14; --panel:#0F1520; --line:#222B38; --fg:#E8EAEE; --muted:#9097A3; --accent:#EF4444; --accent-soft:rgba(239,68,68,.12); color-scheme: dark; }
body { background:var(--bg); color:var(--fg); font:16px/1.6 var(--body); }
body::before { content:""; position:fixed; inset:0 0 auto; height:env(safe-area-inset-top,0px); z-index:10; background:var(--bg); }
.wrap { max-width:980px; margin:0 auto; padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px)); padding-block:28px 64px; }
h1 { font:400 clamp(44px,9vw,72px)/.95 var(--display); letter-spacing:.01em; margin:0; text-wrap:balance; }
nav { position:sticky; top:env(safe-area-inset-top,0px); z-index:5; background:var(--bg); display:flex; gap:8px; overflow-x:auto; padding-block:12px; margin-top:16px; border-bottom:1px solid var(--line); scrollbar-width:none; }
nav a { flex:none; font-size:13px; font-weight:500; color:var(--fg); text-decoration:none; border:1px solid var(--line); border-radius:999px; padding:6px 12px; background:var(--panel); }
nav a:hover, nav a:focus-visible { border-color:var(--accent); outline:none; }
h2 { font:400 32px/1 var(--display); letter-spacing:.02em; margin:40px 0 8px; scroll-margin-top:64px; text-wrap:balance; }
h3 { font-size:17px; font-weight:600; margin:24px 0 8px; scroll-margin-top:64px; }
p { color:var(--muted); margin:0 0 12px; max-width:70ch; }
p b { color:var(--fg); }
code { font:13px var(--mono); background:var(--accent-soft); padding:1px 5px; border-radius:4px; word-break:break-word; }
.dg { margin:12px 0; }
.open { all:unset; box-sizing:border-box; display:block; width:100%; cursor:zoom-in; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px; position:relative; }
.open:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.slot { min-height:120px; display:grid; place-items:center; }
.slot svg { width:100%; height:auto; max-height:70vh; }
.wait { color:var(--muted); font-size:14px; }
.hint { position:absolute; right:10px; bottom:8px; font-size:12px; font-weight:600; color:var(--accent); background:var(--panel); border:1px solid var(--line); border-radius:999px; padding:3px 10px; }
.tw { overflow-x:auto; margin:12px 0; border:1px solid var(--line); border-radius:10px; background:var(--panel); }
table { border-collapse:collapse; width:100%; font-size:14px; }
th, td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
th { font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); font-weight:600; }
tr:last-child td { border-bottom:0; }
td { font-variant-numeric:tabular-nums; }
/* Full-screen viewer */
.vw { position:fixed; inset:0; z-index:50; background:var(--bg); display:flex; flex-direction:column; }
.vw[hidden] { display:none !important; }
.bar { display:flex; gap:8px; align-items:center; padding:calc(env(safe-area-inset-top,0px) + 10px) max(12px,env(safe-area-inset-right,0px)) 10px max(12px,env(safe-area-inset-left,0px)); border-bottom:1px solid var(--line); background:var(--bg); }
.bar .t { flex:1; min-width:0; font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar button { font:600 15px var(--body); color:var(--fg); background:var(--panel); border:1px solid var(--line); border-radius:8px; min-width:44px; height:40px; padding:0 10px; cursor:pointer; }
.bar button:focus-visible { outline:2px solid var(--accent); }
.bar .x { background:var(--accent); color:#fff; border-color:var(--accent); }
.stage { flex:1; position:relative; overflow:hidden; touch-action:none; cursor:grab; }
.stage:active { cursor:grabbing; }
.canvas { position:absolute; left:0; top:0; transform-origin:0 0; will-change:transform; }
.canvas svg { display:block; max-width:none !important; }
.foot { padding:8px 12px calc(env(safe-area-inset-bottom,0px) + 8px); text-align:center; font-size:12px; color:var(--muted); background:var(--bg); border-top:1px solid var(--line); }
@media (prefers-reduced-motion: no-preference) { .canvas.ease { transition:transform .18s ease-out; } }
</style>
<div class="wrap">
<h1>${inline(title)}</h1>
<nav aria-label="Sections">${nav.join('')}</nav>
${body.join('\n')}
</div>
<div class="vw" id="vw" hidden role="dialog" aria-modal="true" aria-label="Diagram viewer">
  <div class="bar"><span class="t" id="vt"></span>
    <button type="button" id="zo" aria-label="Zoom out">−</button>
    <button type="button" id="zi" aria-label="Zoom in">+</button>
    <button type="button" id="zf">Fit</button>
    <button type="button" class="x" id="zx">Close</button></div>
  <div class="stage" id="st"><div class="canvas" id="cv"></div></div>
  <div class="foot">Pinch or scroll to zoom. Drag to move. Double-tap to zoom in.</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<script>
(function () {
  var figs = Array.prototype.slice.call(document.querySelectorAll('.dg'));
  function dark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }
  var seq = 0;
  function renderAll() {
    if (!window.mermaid) {
      figs.forEach(function (f) { f.querySelector('.slot').innerHTML = '<pre style="white-space:pre-wrap;font-size:12px;text-align:left">' +
        f.querySelector('.src').textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre>'; });
      return;
    }
    var d = dark();
    mermaid.initialize({ startOnLoad:false, securityLevel:'strict', theme: d ? 'dark' : 'neutral',
      themeVariables: { fontFamily:'Outfit, system-ui, sans-serif', fontSize:'15px' },
      flowchart: { htmlLabels:true, curve:'basis' } });
    figs.reduce(function (p, f) {
      return p.then(function () {
        var src = f.querySelector('.src').textContent;
        return mermaid.render('m' + (++seq), src).then(function (r) {
          f.querySelector('.slot').innerHTML = r.svg;
        }).catch(function (e) {
          f.querySelector('.slot').textContent = 'Could not draw this diagram: ' + (e && e.message || e);
        });
      });
    }, Promise.resolve());
  }
  renderAll();
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderAll); } catch (e) {}
  new MutationObserver(renderAll).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });

  // Viewer
  var vw = document.getElementById('vw'), st = document.getElementById('st'), cv = document.getElementById('cv');
  var s = 1, x = 0, y = 0, W = 0, H = 0, fitS = 1, lastFocus = null;
  function apply(ease) { cv.classList.toggle('ease', !!ease); cv.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')'; }
  function clampS(v) { return Math.min(Math.max(v, fitS * 0.5), 8); }
  function fit(ease) {
    var r = st.getBoundingClientRect();
    fitS = Math.min((r.width - 24) / W, (r.height - 24) / H);
    s = fitS; x = (r.width - W * s) / 2; y = (r.height - H * s) / 2; apply(ease);
  }
  function zoomAt(f, cx, cy, ease) {
    var ns = clampS(s * f); x = cx - (cx - x) * (ns / s); y = cy - (cy - y) * (ns / s); s = ns; apply(ease);
  }
  function centre() { var r = st.getBoundingClientRect(); return [r.width / 2, r.height / 2]; }
  function open(f) {
    var svg = f.querySelector('.slot svg'); if (!svg) return;
    var clone = svg.cloneNode(true), vb = (svg.getAttribute('viewBox') || '').split(/[ ,]+/).map(Number);
    W = vb[2] || svg.getBoundingClientRect().width; H = vb[3] || svg.getBoundingClientRect().height;
    clone.setAttribute('width', W); clone.setAttribute('height', H); clone.style.maxWidth = 'none';
    cv.innerHTML = ''; cv.appendChild(clone);
    var h = f.previousElementSibling; while (h && !/^H[23]$/.test(h.tagName)) h = h.previousElementSibling;
    document.getElementById('vt').textContent = h ? h.textContent : 'Diagram';
    lastFocus = document.activeElement; vw.hidden = false; document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () {
      var r0 = st.getBoundingClientRect(); lastSize = Math.round(r0.width) + 'x' + Math.round(r0.height);
      fit(false);
      // On a phone, "fit" of a wide diagram is still too small to read: start at
      // readable text size anchored at the left edge, with Fit one tap away.
      var r = st.getBoundingClientRect();
      if (fitS < 0.6 && r.width < 700) { s = clampS(0.9); x = 12; y = Math.max(12, (r.height - H * s) / 2); apply(false); }
    });
    document.getElementById('zx').focus();
  }
  function close() { vw.hidden = true; cv.innerHTML = ''; document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  figs.forEach(function (f) { f.querySelector('.open').addEventListener('click', function () { open(f); }); });
  document.getElementById('zx').onclick = close;
  document.getElementById('zf').onclick = function () { fit(true); };
  document.getElementById('zi').onclick = function () { var c = centre(); zoomAt(1.4, c[0], c[1], true); };
  document.getElementById('zo').onclick = function () { var c = centre(); zoomAt(1 / 1.4, c[0], c[1], true); };
  document.addEventListener('keydown', function (e) {
    if (vw.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === '+' || e.key === '=') document.getElementById('zi').click();
    else if (e.key === '-') document.getElementById('zo').click();
  });
  // Refit only on a real size change: locking body scroll fires a resize on some
  // phones, and refitting then threw away the readable starting zoom.
  var lastSize = '';
  window.addEventListener('resize', function () {
    if (vw.hidden) return;
    var r = st.getBoundingClientRect(), k = Math.round(r.width) + 'x' + Math.round(r.height);
    if (k !== lastSize) { lastSize = k; fit(false); }
  });
  st.addEventListener('wheel', function (e) {
    e.preventDefault(); var r = st.getBoundingClientRect();
    if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top, false);
    else { x -= e.deltaX; apply(false); }
  }, { passive:false });
  var pts = {}, last = null, lastTap = 0;
  function list() { return Object.keys(pts).map(function (k) { return pts[k]; }); }
  st.addEventListener('pointerdown', function (e) {
    st.setPointerCapture(e.pointerId); pts[e.pointerId] = { x:e.clientX, y:e.clientY }; last = null;
    if (e.pointerType !== 'mouse' && list().length === 1) {
      var now = Date.now();
      if (now - lastTap < 300) { var r = st.getBoundingClientRect(); zoomAt(2, e.clientX - r.left, e.clientY - r.top, true); lastTap = 0; }
      else lastTap = now;
    }
  });
  st.addEventListener('pointermove', function (e) {
    if (!pts[e.pointerId]) return;
    pts[e.pointerId] = { x:e.clientX, y:e.clientY };
    var p = list(), r = st.getBoundingClientRect();
    if (p.length === 1) {
      if (last && last.n === 1) { x += p[0].x - last.x; y += p[0].y - last.y; apply(false); }
      last = { n:1, x:p[0].x, y:p[0].y };
    } else if (p.length >= 2) {
      var mx = (p[0].x + p[1].x) / 2 - r.left, my = (p[0].y + p[1].y) / 2 - r.top;
      var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (last && last.n === 2) { x += mx - last.mx; y += my - last.my; zoomAt(d / last.d, mx, my, false); }
      last = { n:2, mx:mx, my:my, d:d };
    }
  });
  function up(e) { delete pts[e.pointerId]; last = null; }
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  st.addEventListener('dblclick', function (e) { var r = st.getBoundingClientRect(); zoomAt(2, e.clientX - r.left, e.clientY - r.top, true); });
})();
</script>
`;
fs.writeFileSync(out, html);
console.log('wrote', String(out), html.length, 'bytes,', n, 'diagrams');
