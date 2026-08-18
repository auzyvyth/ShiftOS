import React from "react";
import { MessageCircle, Users, Camera, Music2, Send, AtSign, Search, Copy, Globe, BookOpen } from "lucide-react";
import { channelMeta } from "../utils/detectChannel";

// Icon per traffic source — swapped in for the old plain colour dot so each
// row reads at a glance instead of relying on a decorative glowing bullet.
const CHANNEL_ICONS = {
  whatsapp: MessageCircle,
  messenger: MessageCircle,
  facebook: Users,
  instagram: Camera,
  tiktok: Music2,
  telegram: Send,
  twitter: AtSign,
  line: MessageCircle,
  wechat: MessageCircle,
  snapchat: Camera,
  xiaohongshu: BookOpen,
  google: Search,
  copy: Copy,
  direct: Globe,
};

// Renders "where did this traffic come from" as a ranked set of platform bars.
// Fed pre-aggregated rows [{ channel, views, enquiries }] — either summed across
// a salesman's whole portfolio (analytics tab) or scoped to one car (car detail).
// Dark-themed to match the Salesman panel. "Direct" is the catch-all bucket for
// untagged / organic / unclassifiable visits.
export default function ChannelBreakdown({
  rows = [],
  metric = "views",
  title = "Traffic by platform",
  emptyHint = "No attributed traffic yet — share this link to start tracking.",
  compact = false,
  viewsLabel = "views",
  enquiriesLabel = "WA",
}) {
  // Sum by channel in case the caller passes multiple rows per channel.
  const agg = {};
  rows.forEach((r) => {
    const key = r.channel || "direct";
    if (!agg[key]) agg[key] = { channel: key, views: 0, enquiries: 0 };
    agg[key].views += Number(r.views) || 0;
    agg[key].enquiries += Number(r.enquiries) || 0;
  });
  const list = Object.values(agg)
    .filter((r) => r.views > 0 || r.enquiries > 0)
    .sort((a, b) => (b[metric] || 0) - (a[metric] || 0) || b.views - a.views);

  const max = list.reduce((m, r) => Math.max(m, r[metric] || 0), 0) || 1;

  return (
    <div style={{ minWidth: 0 }}>
      {title && (
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#6b7280",
          }}
        >
          {title}
        </p>
      )}

      {list.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>{emptyHint}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
          {list.map((r) => {
            const meta = channelMeta(r.channel);
            const Icon = CHANNEL_ICONS[r.channel] || Globe;
            const pct = Math.max(4, Math.round(((r[metric] || 0) / max) * 100));
            return (
              <div key={r.channel} style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 5,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      minWidth: 0,
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#e5e7eb",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 18,
                        height: 18,
                        borderRadius: 5,
                        background: `${meta.color}1a`,
                        color: meta.color,
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={11} strokeWidth={2.5} />
                    </span>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {meta.label}
                    </span>
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 11.5, color: "#9ca3af" }}>
                    <strong style={{ color: "#f1f5f9", fontWeight: 700 }}>{r.views}</strong> {viewsLabel}
                    {r.enquiries > 0 && (
                      <>
                        {" · "}
                        <strong style={{ color: "#4ade80", fontWeight: 700 }}>{r.enquiries}</strong> {enquiriesLabel}
                      </>
                    )}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.05)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 4,
                      background: meta.color,
                      opacity: 0.85,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
          <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "#475569" }}>
            Direct = organic or untagged visits we couldn't attribute to a platform.
          </p>
        </div>
      )}
    </div>
  );
}
