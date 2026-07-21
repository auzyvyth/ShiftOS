import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, RefreshCw, Zap, ImagePlus } from "lucide-react";

// ─── CameraCapture ────────────────────────────────────────────────────────────
// Full-screen camera with a live template overlay:
//  - the current template design is ghosted over the viewfinder at ~50% opacity
//  - the template's carZone renders as a dashed "YOUR CAR HERE" box
//  - the zone's angle instruction is shown as a pill under the box
// Capture crops the video to the exact 9:16 frame shown on screen and returns
// a 1080x1920 JPEG data-URL. Falls back to a native file-capture input when
// getUserMedia is unavailable/denied.

export default function CameraCapture({ onClose, onCapture, carZone, overlayUrl, canvasW = 1080, canvasH = 1920 }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [facing, setFacing] = useState("environment");
  const [err, setErr] = useState(null);
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState(null); // {left, top, w, h} of the 9:16 guide in viewport px
  const [ghost, setGhost] = useState(true);
  const [flash, setFlash] = useState(false);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Compute the largest 9:16 frame that fits the viewport (with small margins)
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const ratio = canvasW / canvasH;
      let h = vh - 24;
      let w = h * ratio;
      if (w > vw - 16) { w = vw - 16; h = w / ratio; }
      setFrame({ left: (vw - w) / 2, top: (vh - h) / 2, w, h });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [canvasW, canvasH]);

  // Start / restart the stream
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setErr(null);
    (async () => {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        if (!cancelled) setErr(e?.name === "NotAllowedError" ? "Camera permission denied" : "Camera unavailable");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !frame || video.videoWidth === 0) return;
    // The video renders object-fit:cover over the full viewport. Map the
    // on-screen 9:16 frame back into intrinsic video pixels, then draw that
    // region into a 1080x1920 canvas.
    const vw = video.videoWidth, vh = video.videoHeight;
    const Wv = window.innerWidth, Hv = window.innerHeight;
    const s = Math.max(Wv / vw, Hv / vh);
    const offX = (Wv - vw * s) / 2;
    const offY = (Hv - vh * s) / 2;
    const sx = (frame.left - offX) / s;
    const sy = (frame.top - offY) / s;
    const sw = frame.w / s;
    const sh = frame.h / s;
    const c = document.createElement("canvas");
    c.width = canvasW; c.height = canvasH;
    const ctx = c.getContext("2d");
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvasW, canvasH);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    const url = c.toDataURL("image/jpeg", 0.92);
    onCapture(url);
    onClose();
  }, [frame, canvasW, canvasH, onCapture, onClose]);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { onCapture(reader.result); onClose(); };
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const zone = carZone && frame ? {
    left: frame.left + (carZone.x / 100) * frame.w,
    top: frame.top + (carZone.y / 100) * frame.h,
    w: (carZone.w / 100) * frame.w,
    h: (carZone.h / 100) * frame.h,
  } : null;

  const roundBtn = {
    width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(0,0,0,0.45)", color: "#fff", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)",
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 10060, background: "#000", overflow: "hidden", fontFamily: "system-ui,sans-serif", touchAction: "none" }}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Dim everything outside the 9:16 frame */}
      {frame && (
        <>
          {[
            { left: 0, top: 0, width: "100%", height: frame.top },
            { left: 0, top: frame.top + frame.h, width: "100%", bottom: 0 },
            { left: 0, top: frame.top, width: frame.left, height: frame.h },
            { left: frame.left + frame.w, top: frame.top, right: 0, height: frame.h },
          ].map((s, i) => (
            <div key={i} style={{ position: "absolute", background: "rgba(0,0,0,0.62)", ...s }} />
          ))}
          <div style={{ position: "absolute", left: frame.left, top: frame.top, width: frame.w, height: frame.h, border: "1px solid rgba(255,255,255,0.35)", borderRadius: 6, pointerEvents: "none" }} />
        </>
      )}

      {/* Ghosted template overlay */}
      {frame && overlayUrl && ghost && (
        <img
          src={overlayUrl}
          alt=""
          style={{ position: "absolute", left: frame.left, top: frame.top, width: frame.w, height: frame.h, opacity: 0.5, pointerEvents: "none", borderRadius: 6 }}
        />
      )}

      {/* Car zone guide */}
      {zone && (
        <div style={{ position: "absolute", left: zone.left, top: zone.top, width: zone.w, height: zone.h, pointerEvents: "none" }}>
          <div style={{ position: "absolute", inset: 0, border: "3px dashed rgba(255,255,255,0.9)", borderRadius: 14, boxShadow: "0 0 0 2000px rgba(0,0,0,0.0)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,0.9)", textShadow: "0 2px 8px rgba(0,0,0,0.8)", textTransform: "uppercase" }}>
              Your car here
            </span>
          </div>
          {carZone?.hint && (
            <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 10, whiteSpace: "nowrap", background: "rgba(0,0,0,0.72)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 999, padding: "7px 14px", fontSize: 13, fontWeight: 600, color: "#fff", backdropFilter: "blur(4px)" }}>
              📐 {carZone.hint}
            </div>
          )}
        </div>
      )}

      {/* Flash */}
      {flash && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0.7, pointerEvents: "none" }} />}

      {/* Error / fallback */}
      {err && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "rgba(0,0,0,0.85)", padding: 24, textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: 600 }}>{err}</p>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, maxWidth: 280 }}>You can still shoot with your phone's native camera instead.</p>
          <button onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 8, background: "#dc2626", color: "#fff", border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            <ImagePlus size={16} /> Open native camera
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onFile} />

      {/* Top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
        <button onClick={onClose} style={roundBtn} aria-label="Close camera"><X size={20} /></button>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setGhost((g) => !g)}
            style={{ ...roundBtn, width: "auto", borderRadius: 999, padding: "0 14px", fontSize: 12, fontWeight: 700, color: ghost ? "#fff" : "rgba(255,255,255,0.45)" }}
            title="Toggle template ghost"
          >
            <Zap size={13} style={{ marginRight: 5 }} /> Ghost {ghost ? "ON" : "OFF"}
          </button>
          <button onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))} style={roundBtn} aria-label="Flip camera">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Shutter */}
      {!err && (
        <div style={{ position: "absolute", bottom: 26, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 30 }}>
          <button onClick={() => fileRef.current?.click()} style={{ ...roundBtn, width: 40, height: 40 }} title="Pick from gallery"><ImagePlus size={17} /></button>
          <button
            onClick={capture}
            disabled={!ready}
            aria-label="Capture"
            style={{ width: 74, height: 74, borderRadius: "50%", border: "4px solid #fff", background: ready ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.08)", cursor: ready ? "pointer" : "default", boxShadow: "0 4px 30px rgba(0,0,0,0.6)" }}
          />
          <div style={{ width: 40 }} />
        </div>
      )}
    </div>,
    document.body,
  );
}
