// Drevo Skits, 3D cast (three.js): every character built from simple shapes with a toon look
// (flat light bands + ink outline). Colours come from tools/rig.mjs PEOPLE; the FACE is the 2D rig's
// eyes + mouth painted on the head (faceSvg from the page), so 2D and 3D share one expression set.
// Pose = the 2D names: armL / armR in degrees (0 down, +-90 out, +-160 up), pointL / pointR, turn (rad).
import * as THREE from 'three';

const INK = 0x16181d;
const ramp = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 205, 205, 205, 255, 255, 255, 255, 255]), 3, 1);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
const toon = (c, map) => new THREE.MeshToonMaterial({ color: c, gradientMap: ramp, map: map || null });
const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
const deg = Math.PI / 180;

// a mesh + its ink outline (same shape, a little bigger, back faces only)
function part(geo, color, { outline = 0.022, map, ink = inkMat } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, toon(color, map)));
  if (outline) {
    geo.computeBoundingBox();
    const s = new THREE.Vector3(); geo.boundingBox.getSize(s);
    const o = new THREE.Mesh(geo, ink);
    o.scale.set(1 + 2 * outline / Math.max(s.x, 0.05), 1 + 2 * outline / Math.max(s.y, 0.05), 1 + 2 * outline / Math.max(s.z, 0.05));
    g.add(o);
  }
  return g;
}
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// ---------- per-character extras: hair/hat, chest print, props ----------
const R = 0.62; // head radius (head space is scaled 0.9 x, 1 y, 0.88 z)
const cap = (color, theta, tilt, r = 1.045) => {
  const p = part(new THREE.SphereGeometry(R * r, 40, 20, 0, Math.PI * 2, 0, Math.PI * theta), color, { outline: 0.02 });
  p.rotation.x = tilt; return p;
};
const blob = (color, r, pos, scale, rot = [0, 0, 0], o) => {
  const p = part(new THREE.SphereGeometry(r, 24, 16), color, o);
  p.position.set(...pos); p.scale.set(...scale); p.rotation.set(...rot); return p;
};

const LOOKS = {
  salesman: {
    hair: (hs) => { // slicked back: high hairline, volume swept to the back, comb grooves front to back
      hs.add(cap(0x17181c, 0.4, -0.62));
      hs.add(blob(0x17181c, 0.42, [0, 0.36, -0.12], [1.3, 0.75, 1.35], [-0.25, 0, 0]));
      for (const sx of [-0.2, 0, 0.2]) hs.add(blob(0x3b4049, 0.03, [sx, 0.6, 0.12], [1, 0.5, 6], [0.5, 0, 0], { outline: 0 }));
    },
    chest: (x, w, h, ctx) => { // white V collar, placket, Drevo wordmark
      x.strokeStyle = '#fff'; x.lineWidth = 14; x.beginPath(); x.moveTo(w / 2 - 60, 0); x.lineTo(w / 2, 90); x.lineTo(w / 2 + 60, 0); x.stroke();
      if (ctx.logo) { x.save(); x.translate(w / 2 - 150, 150); x.scale(150 / 688, 150 / 688); x.fillStyle = '#fff'; x.fill(new Path2D(ctx.logo), 'evenodd'); x.restore(); }
      x.strokeStyle = '#16181d'; x.lineWidth = 7; x.beginPath(); x.moveTo(w / 2 - 50, 6); x.quadraticCurveTo(w / 2, 220, w / 2, 250); x.quadraticCurveTo(w / 2, 220, w / 2 + 50, 6); x.stroke();
    },
    props: (body) => { const c = part(new THREE.BoxGeometry(0.15, 0.2, 0.03), 0xffffff, { outline: 0.012 }); c.position.set(0, 1.18, 0.4); body.add(c); },
  },
  buyer: {
    hair: (hs) => {
      hs.add(cap(0x1b1d22, 0.5, -0.05, 1.03));
      const dome = cap(0x262a32, 0.4, -0.12, 1.08); hs.add(dome);
      const brim = part(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 32, 1, false, -1.1, 2.2), 0x16181d, { outline: 0.012 });
      brim.position.set(0, 0.25, 0.4); brim.rotation.x = 0.15; hs.add(brim);
      const patch = part(new THREE.BoxGeometry(0.16, 0.1, 0.04), 0xdc2626, { outline: 0.01 }); patch.position.set(0, 0.5, 0.45); patch.rotation.x = -0.75; hs.add(patch);
    },
    chest: (x, w) => { x.strokeStyle = '#16181d'; x.lineWidth = 6; x.beginPath(); x.arc(w / 2, -40, 90, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
      x.strokeStyle = '#5a4634'; x.lineWidth = 18; x.beginPath(); x.moveTo(w * 0.72, 0); x.lineTo(w * 0.3, 360); x.stroke(); },
    props: (body) => { const b = part(new THREE.BoxGeometry(0.26, 0.2, 0.1), 0x5a4634, { outline: 0.014 }); b.position.set(-0.32, 0.98, 0.38); body.add(b); },
  },
  rival: {
    hair: (hs) => {
      hs.add(cap(0x17181c, 0.4, -0.5));
      hs.add(blob(0x17181c, 0.3, [0.02, 0.62, 0.2], [1.25, 0.75, 1.15], [-0.4, 0, 0]));
      hs.add(blob(0x8a5a2b, 0.07, [0.08, 0.84, 0.22], [2.2, 0.5, 1], [-0.3, 0, -0.2], { outline: 0 }));
      const gold = new THREE.MeshBasicMaterial({ color: 0xd4a017, side: THREE.BackSide });
      for (const sx of [-1, 1]) hs.add(blob(0x2c6e78, 0.13, [sx * 0.17, 0.5, 0.45], [1.25, 0.8, 0.35], [-0.6, 0, 0], { outline: 0.03, ink: gold }));
    },
    chest: (x, w, h) => { // checked blazer over a black tee
      x.strokeStyle = 'rgba(242,193,78,0.75)'; x.lineWidth = 6;
      for (let i = 30; i < w; i += 70) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
      for (let j = 40; j < h; j += 70) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
      x.fillStyle = '#1b1d22'; x.beginPath(); x.moveTo(w / 2 - 70, 0); x.lineTo(w / 2, 230); x.lineTo(w / 2 + 70, 0); x.fill();
      x.strokeStyle = '#16181d'; x.lineWidth = 9; x.beginPath(); x.moveTo(w / 2 - 90, 0); x.lineTo(w / 2 - 10, 290); x.moveTo(w / 2 + 90, 0); x.lineTo(w / 2 + 10, 290); x.stroke();
      x.fillStyle = '#fff'; x.beginPath(); x.roundRect(w / 2 + 70, 110, 60, 12, 5); x.fill();
    },
  },
  mak: {
    noEars: true,
    hair: (hs) => {
      const pink = 0xe7b7c2;
      // shell round the head with a window for the face, a cap over the forehead, a drape over neck + shoulders
      hs.add(part(new THREE.SphereGeometry(R * 1.12, 48, 32, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI), pink, { outline: 0.02 }));
      hs.add(part(new THREE.SphereGeometry(R * 1.12, 48, 16, Math.PI / 2 - 1.0, 2.0, 0, Math.PI * 0.27), pink, { outline: 0 }));
      hs.add(part(new THREE.SphereGeometry(R * 1.12, 48, 16, Math.PI / 2 - 1.0, 2.0, Math.PI * 0.8, Math.PI * 0.2), pink, { outline: 0 }));
    },
    neckDrape: (head) => {
      const d = part(new THREE.CylinderGeometry(0.42, 0.62, 0.6, 40, 1, true), 0xe7b7c2, { outline: 0.02 });
      d.position.y = -0.58; head.add(d);
      const b = part(new THREE.SphereGeometry(0.06, 12, 8), 0xf2c14e, { outline: 0.01 }); b.position.set(0, -0.5, 0.55); head.add(b);
    },
    pattern: (x, w, h, base) => { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < 9; i++) { const px = (i * 97) % w, py = (i * 151) % h; x.fillStyle = '#f4d6dc';
      for (let a = 0; a < 4; a++) { x.beginPath(); x.ellipse(px + Math.cos(a * Math.PI / 2) * 12, py + Math.sin(a * Math.PI / 2) * 12, 9, 9, 0, 0, 7); x.fill(); }
      x.fillStyle = '#f2c14e'; x.beginPath(); x.arc(px, py, 6, 0, 7); x.fill(); } },
    skirt: true,
  },
  lim: {
    hair: (hs) => { hs.add(cap(0x3a3d44, 0.4, -0.45)); for (const sx of [-1, 1]) hs.add(blob(0xa7adb6, 0.06, [sx * 0.38, 0.32, 0.25], [0.6, 1.6, 0.6], [0, 0, 0], { outline: 0 })); },
    chest: (x, w) => { x.strokeStyle = '#1d2b40'; x.lineWidth = 8; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, 512); x.stroke();
      x.fillStyle = '#fff'; x.fillRect(w / 2 + 30, 70, 110, 50); x.strokeStyle = '#16181d'; x.lineWidth = 5; x.strokeRect(w / 2 + 30, 70, 110, 50);
      x.fillStyle = '#16181d'; x.font = '700 34px Outfit, Arial'; x.textAlign = 'center'; x.fillText('LIM', w / 2 + 85, 108); },
    props: (body) => { const r = part(new THREE.BoxGeometry(0.1, 0.16, 0.06), 0xdc2626, { outline: 0.01 }); r.position.set(-0.22, 1.22, 0.36); r.rotation.z = 0.3; body.add(r); },
  },
  priya: {
    hair: (hs) => {
      hs.add(cap(0x15161a, 0.5, -0.62, 1.05));
      hs.add(blob(0x15161a, 0.5, [0, 0.1, -0.12], [1.1, 1.1, 0.9]));
      hs.add(blob(0x15161a, 0.11, [0.47, -0.5, 0.12], [1, 3.6, 1], [0.15, 0, 0.18]));
      for (const sx of [-1, 1]) hs.add(blob(0xf2c14e, 0.035, [sx * 0.6, -0.12, 0.02], [1, 1, 1], [0, 0, 0], { outline: 0.008 }));
    },
    chest: (x, w) => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(w / 2 - 60, 0); x.lineTo(w / 2, 150); x.lineTo(w / 2 + 60, 0); x.fill();
      x.strokeStyle = '#16181d'; x.lineWidth = 9; x.beginPath(); x.moveTo(w / 2 - 80, 0); x.lineTo(w / 2 - 6, 300); x.moveTo(w / 2 + 80, 0); x.lineTo(w / 2 + 6, 300); x.stroke();
      x.strokeStyle = '#7aa7d9'; x.lineWidth = 7; x.beginPath(); x.moveTo(w / 2 - 40, 0); x.quadraticCurveTo(w / 2, 200, w / 2, 250); x.quadraticCurveTo(w / 2, 200, w / 2 + 40, 0); x.stroke(); },
    props: (body) => { const c = part(new THREE.BoxGeometry(0.13, 0.18, 0.03), 0xffffff, { outline: 0.012 }); c.position.set(0, 1.18, 0.39); body.add(c); },
  },
};

// ---------- build ----------
export function buildCharacter(who, p, extra = {}) {
  const L = LOOKS[who];
  const C = (k) => new THREE.Color(p[k]).getHex();
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);

  // legs (compass pivot under the body) + shoes
  const hip = new THREE.Group(); hip.position.y = 0.95; body.add(hip);
  const legs = [-1, 1].map((s) => {
    const g = new THREE.Group(); g.position.x = s * 0.16;
    const l = part(new THREE.CapsuleGeometry(0.15, 0.62, 6, 16), C('pants')); l.position.y = -0.44; g.add(l);
    const sh = part(new THREE.SphereGeometry(0.17, 20, 12), C('shoe')); sh.scale.set(1, 0.6, 1.6); sh.position.set(0, -0.87, 0.09); g.add(sh);
    hip.add(g); return g;
  });

  // torso + front print
  const pattern = L.pattern ? canvasTex(256, 256, (x, w, h) => L.pattern(x, w, h, p.shirt), [3, 2]) : null;
  const torso = part(new THREE.CapsuleGeometry(0.46, 0.55, 8, 24), pattern ? 0xffffff : C('shirt'), { outline: 0.028, map: pattern }); torso.position.y = 1.42; torso.scale.z = 0.8; body.add(torso);
  if (L.chest) {
    const tex = canvasTex(512, 512, (x, w, h) => L.chest(x, w, h, extra));
    const dec = new THREE.Mesh(new THREE.CylinderGeometry(0.463, 0.463, 0.8, 40, 1, true, -1.35, 2.7), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    dec.position.y = 1.46; dec.scale.z = 0.8; body.add(dec);
  }
  if (L.skirt) {
    const sk = part(new THREE.CylinderGeometry(0.44, 0.58, 0.95, 40, 1, true), 0xffffff, { outline: 0.02, map: canvasTex(256, 256, (x, w, h) => L.pattern(x, w, h, p.shirtDark), [4, 2]) });
    sk.position.y = 0.6; body.add(sk);
  }
  if (L.props) L.props(body);

  // arms: shoulder pivot, sleeve, forearm (skin or long sleeve), hand, optional pointing finger
  const arms = [1, -1].map((s) => {
    const g = new THREE.Group(); g.position.set(s * 0.47, 1.8, 0);
    const a = part(new THREE.CapsuleGeometry(0.11, 0.5, 6, 12), p.longSleeve ? C('shirt') : C('skin')); a.position.y = -0.36; g.add(a);
    const sl = part(new THREE.CapsuleGeometry(0.145, 0.12, 6, 12), C('shirt')); sl.position.y = -0.1; g.add(sl);
    const h = part(new THREE.SphereGeometry(0.13, 16, 12), C('skin')); h.position.y = -0.72; g.add(h);
    const f = part(new THREE.CapsuleGeometry(0.04, 0.16, 4, 8), C('skin'), { outline: 0.012 }); f.position.y = -0.88; f.visible = false; g.add(f);
    g.userData.finger = f; body.add(g); return g;
  });

  // head: neck, skull, ears, face texture, hair
  const head = new THREE.Group(); head.position.y = 2.55; body.add(head);
  const neck = part(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 16), C('skinDark'), { outline: 0.015 }); neck.position.y = -0.58; head.add(neck);
  if (L.neckDrape) L.neckDrape(head);
  const hs = new THREE.Group(); hs.scale.set(0.9, 1, 0.88); head.add(hs);
  hs.add(part(new THREE.SphereGeometry(R, 48, 32), C('skin'), { outline: 0.03 }));
  if (!L.noEars) for (const s of [-1, 1]) { const e = part(new THREE.SphereGeometry(0.12, 14, 10), C('skin'), { outline: 0.018 }); e.position.set(s * 0.6, -0.02, 0); e.scale.z = 0.55; hs.add(e); }
  const faceCanvas = document.createElement('canvas'); faceCanvas.width = 540; faceCanvas.height = 560;
  const faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 8;
  // face patch: the 2D rig's head box x 115..385 -> +-65 deg, y 120..400 -> 36..153 deg from the top
  const face = new THREE.Mesh(new THREE.SphereGeometry(R * 1.006, 64, 48, Math.PI / 2 - 1.134, 2.268, 0.2 * Math.PI, 0.65 * Math.PI),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }));
  hs.add(face);
  L.hair(hs);

  root.userData = { legs, arms, head, faceCanvas, faceTex };
  return root;
}

// apply a pose; faceImg = an <img> of the 2D face SVG for this pose
export function pose(ch, q = {}, faceImg) {
  const { arms, legs, faceCanvas, faceTex } = ch.userData;
  const [armL, armR] = arms;
  armL.rotation.z = (q.armL ?? 10) * deg; armR.rotation.z = (q.armR ?? -10) * deg;
  armL.userData.finger.visible = !!q.pointL; armR.userData.finger.visible = !!q.pointR;
  legs[0].rotation.x = (q.legL ?? 0) * deg; legs[1].rotation.x = (q.legR ?? 0) * deg;
  ch.rotation.y = q.turn ?? 0;
  if (faceImg) {
    const x = faceCanvas.getContext('2d'); x.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
    x.drawImage(faceImg, 0, 0, faceCanvas.width, faceCanvas.height); faceTex.needsUpdate = true;
  }
}

export { hex };
