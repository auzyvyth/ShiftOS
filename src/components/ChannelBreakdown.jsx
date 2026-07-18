import React from "react";
import { channelMeta } from "../utils/detectChannel";

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
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: meta.color,
                        flexShrink: 0,
                        boxShadow: `0 0 0 2px ${meta.color}22`,
                      }}
                    />
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
                    <strong style={{ color: "#f1f5f9", fontWeight: 700 }}>{r.views}</strong> views
                    {r.enquiries > 0 && (
                      <>
                        {" · "}
                        <strong style={{ color: "#4ade80", fontWeight: 700 }}>{r.enquiries}</strong> WA
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
