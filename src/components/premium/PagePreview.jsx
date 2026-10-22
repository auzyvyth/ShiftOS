import React from "react";
import { cdnImg } from "../../utils/img";

// Lite vs Premium, drawn as the seller's OWN page side by side (owner,
// 2026-10-22: "both feel the same"). Every Premium tool works on leads, and a
// new seller has none, so the one difference visible on day one is the public
// page. What differs here must match what get_salesman_by_slug actually
// returns (migration 20261014a): a basic page gets NO banner, bio, social
// links or job title, and carries the "Get your own page free" footer line
// (SalesmanProfilePage.jsx, page_basic). Change that split, change this.
// Fields the seller has not filled in are drawn as labelled empty slots, never
// as invented text: this is a picture of THEIR page.
// The public page is a light surface, so both mock phones are light.

const INK = "#111827";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

function Slot({ label, h = 22 }) {
  return (
    <div style={{ height: h, border: `1px dashed ${LINE}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8.5, color: "#9ca3af", padding: "0 4px", textAlign: "center", lineHeight: 1.2 }}>
      {label}
    </div>
  );
}

function CarTile({ car }) {
  const img = Array.isArray(car?.images) ? car.images.find(Boolean) : null;
  const title = car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : "";
  const price = car?.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : "";
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ aspectRatio: "4 / 3", borderRadius: 4, background: "#f3f4f6", overflow: "hidden" }}>
        {img && <img src={cdnImg(img, 200)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
      </div>
      <p style={{ margin: "3px 0 0", fontSize: 8.5, color: INK, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title || "Your car"}</p>
      {price && <p style={{ margin: 0, fontSize: 8.5, color: MUTED }}>{price}</p>}
    </div>
  );
}

function MiniPage({ profile, cars, full }) {
  const name = profile?.full_name || "Your name";
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const accent = profile?.brand_color || "#dc2626";
  const socials = ["instagram", "tiktok", "facebook"].filter((k) => profile?.[k]);
  const shown = cars.length ? cars.slice(0, 2) : [null, null];

  return (
    <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: `1px solid ${LINE}`, minWidth: 0 }}>
      {/* Banner: Premium only. Lite pages have none at all. */}
      {full ? (
        profile?.cover_url
          ? <img src={cdnImg(profile.cover_url, 400)} alt="" style={{ width: "100%", height: 44, objectFit: "cover", display: "block" }} />
          : <div style={{ height: 44, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8.5, color: MUTED }}>Your banner</div>
      ) : (
        <div style={{ height: 14 }} />
      )}

      <div style={{ padding: "0 8px 8px" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", marginTop: full ? -15 : 0, border: "2px solid #fff", background: "#e5e7eb", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: MUTED }}>
          {profile?.avatar_url ? <img src={cdnImg(profile.avatar_url, 80)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 10.5, fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</p>

        {full && (
          <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
            {profile?.job_title
              ? <p style={{ margin: 0, fontSize: 8.5, color: MUTED }}>{profile.job_title}</p>
              : <Slot label="Your job title" h={14} />}
            {profile?.bio
              ? <p style={{ margin: 0, fontSize: 8.5, color: MUTED, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{profile.bio}</p>
              : <Slot label="Your bio: why buy from you" h={24} />}
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {(socials.length ? socials : ["instagram", "tiktok", "facebook"]).map((k) => (
                <span key={k} style={{ width: 12, height: 12, borderRadius: "50%", background: socials.length ? INK : "transparent", border: socials.length ? "none" : `1px dashed ${LINE}` }} />
              ))}
              <span style={{ fontSize: 8, color: "#9ca3af", marginLeft: 2 }}>Social links</span>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginTop: 8 }}>
          {shown.map((c, i) => <CarTile key={c?.id || i} car={c} />)}
        </div>

        {/* The basic page's footer advertises a free page of their own to every buyer. */}
        {!full && (
          <p style={{ margin: "8px 0 0", paddingTop: 6, borderTop: `1px solid ${LINE}`, fontSize: 8, color: MUTED, lineHeight: 1.35 }}>
            Selling cars? <span style={{ textDecoration: "underline" }}>Get your own page free</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function PagePreview({ profile, cars = [] }) {
  const live = cars.filter((c) => c && (c.status === "available" || c.status === "reserved"));
  const label = { margin: "0 0 6px", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" };
  return (
    <div>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#9ca3af", lineHeight: 1.6 }}>
        What buyers see on your page:
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ ...label, color: "#6b7280" }}>Lite, now</p>
          <MiniPage profile={profile} cars={live} full={false} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ ...label, color: "#f87171" }}>Premium</p>
          <MiniPage profile={profile} cars={live} full />
        </div>
      </div>
    </div>
  );
}
