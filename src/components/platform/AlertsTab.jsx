import React, { useEffect, useState } from "react";
import { AlertTriangle, Bell, Send, UserPlus, Car } from "lucide-react";
import { platformClient } from "../../lib/platformClient";
import PushToggle from "../PushToggle";

/*
 * Security console — Alerts.
 *
 * Web push for the PLATFORM ADMIN account. Everything the ops Telegram channel
 * already gets (new signup, listing pending approval, error log, activity
 * anomaly) now also reaches this device: the DB fanout `notify_ops()` sends both
 * from one throttle, so the two channels can never disagree about what fired.
 *
 * The toggle is handed `platformClient` on purpose. The console runs on the
 * isolated superadmin session (its own storageKey) and `push_subscriptions` is
 * RLS'd on `auth.uid() = user_id` — saved through the main client, the row would
 * be silently rejected or, worse, filed under whichever dealer/salesman account
 * happens to be logged in on this browser.
 */

const EVENTS = [
  {
    icon: UserPlus,
    title: "New signup pending review",
    detail: "A dealer or salesman finished onboarding and is waiting in Verify.",
  },
  {
    icon: Car,
    title: "Listing pending approval",
    detail: "A seller submitted a car that needs an approve/reject in Approvals.",
  },
  {
    icon: AlertTriangle,
    title: "App error logged",
    detail: "A runtime error hit error_logs — the same rows the Errors tab lists.",
  },
  {
    icon: AlertTriangle,
    title: "Activity anomaly",
    detail: "The audit log flagged something unusual (bulk deletes, odd actor).",
  },
];

export default function AlertsTab({ userId }) {
  const [ops, setOps] = useState({ loading: true, telegram: false });

  useEffect(() => {
    let cancelled = false;
    platformClient
      .from("profiles")
      .select("telegram_bot_token, telegram_chat_id, telegram_channel_id")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const token = (data?.telegram_bot_token || "").trim();
        const chat = (data?.telegram_chat_id || data?.telegram_channel_id || "").trim();
        setOps({ loading: false, telegram: Boolean(token && chat) });
      });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Alerts</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
          Where platform alerts land, and how to get them on this device
        </p>
      </div>

      <PushToggle
        userId={userId}
        client={platformClient}
        theme="dark"
        description="Get platform alerts on this device — signups, approvals, errors and anomalies — even with the console closed."
        style={{ marginBottom: 20 }}
      />

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          What sends a push
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
          {EVENTS.map((e) => {
            const Icon = e.icon;
            return (
              <div key={e.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Icon size={14} style={{ color: "#6b7280", flexShrink: 0, marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{e.title}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>{e.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ margin: "16px 0 0", fontSize: 11, color: "#4b5563", lineHeight: 1.7 }}>
          Repeats of the same kind are held for 15 minutes, so a burst of one error
          is one notification, not fifty. Tapping a push opens this console.
        </p>
      </div>

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Send size={13} style={{ color: "#6b7280" }} />
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Telegram ops channel</p>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            color: ops.telegram ? "#4ade80" : "#9ca3af",
            background: ops.telegram ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${ops.telegram ? "rgba(74,222,128,0.25)" : "rgba(255,255,255,0.1)"}`,
          }}>
            {ops.loading ? "…" : ops.telegram ? "Connected" : "Not set up"}
          </span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#6b7280", lineHeight: 1.7 }}>
          {ops.telegram
            ? "The same alerts also post to your ops Telegram channel. Both come from one place in the database, so they always match."
            : "No ops bot token on this account yet, so alerts only arrive as push. Add a Telegram bot token and chat id to this profile to get them there too."}
        </p>
      </div>

      <p style={{ margin: "16px 0 0", fontSize: 11, color: "#4b5563", lineHeight: 1.7, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Bell size={12} style={{ flexShrink: 0, marginTop: 3 }} />
        <span>
          On iPhone, web push only works once ShiftOS is installed to the home
          screen (Share, then Add to Home Screen) and opened from there.
        </span>
      </p>
    </div>
  );
}
