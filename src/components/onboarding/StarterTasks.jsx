import React, { useMemo } from "react";
import { Check, ChevronRight, Plus, ExternalLink, PenLine, Camera, UserCheck, BadgeCheck } from "lucide-react";

// The seller's first three wins, shared by Salesman Lite and Salesman Premium.
//
// Why this exists as a component rather than a per-page block: Lite already had
// a "Get Started" checklist and Premium had none, and the Lite one could not be
// completed — it was gated on `isNewUser && !onboarding_tour_done`, where
// isNewUser meant "no listings AND no leads". So finishing step 1 (add a
// listing) made isNewUser false, which unmounted the whole card. The tick marks
// for done steps were unreachable code: `done: myListings.length > 0` can only
// be true in a state where the card is already hidden. And since the tour runs
// on first landing and sets onboarding_tour_done, the card was usually gone
// before the seller ever looked for it. Nobody has ever seen this thing work.
//
// The rule here is the opposite: the card stays until the work is actually
// DONE, shows real ticks as each one lands, and only then congratulates and
// steps aside. Progress is real state, never a "have I shown this" flag.
//
// Completion is derived from data wherever possible, so it can never disagree
// with reality:
//   listing  -> the seller's live listing count
//   bio      -> profiles.bio is non-empty
//   minipage -> profiles.starter_tasks.minipage_visited (nothing else records
//               that the OWNER opened their own page; analytics_events counts
//               buyer views too)
//
// Teaching order is deliberate: put a car up, go look at the page buyers will
// land on, then fix what you saw was missing on it. Task 3 lands right after
// task 2 shows them an empty bio, which is when the ask makes sense.

export const STARTER_TASK_KEYS = ["listing", "minipage", "bio"];

// Premium's list (owner, 2026-10-18), shaped on Shopify's setup guide and the
// endowed-progress finding (a list that starts with one real step already done
// gets finished far more often than one starting at zero): "account" is that
// head start and is always ticked, and a face on the page is the next thing a
// buyer trusts after a car. "verified" was its own card above this one (the
// SellerIdCard invite) until the owner folded it in, 2026-10-18; it is last
// because it is the most work (MyKad photos). Six rows, five real asks.
export const PREMIUM_TASK_KEYS = ["account", "listing", "minipage", "photo", "bio", "verified"];

// Non-empty and not just whitespace. A bio of " " is not a bio.
export const hasBio = (profile) => !!String(profile?.bio || "").trim();

export const starterTaskState = ({ profile, listingCount }) => ({
  account: true,
  listing: (listingCount || 0) > 0,
  minipage: !!profile?.starter_tasks?.minipage_visited,
  photo: !!profile?.avatar_url,
  bio: hasBio(profile),
  // Their part is done once the photos are in; the badge itself waits on a
  // person (SellerIdCard says "we're checking" again once this list retires).
  verified: !!profile?.is_verified || !!profile?.kyc_submitted_at,
});

// Lite's page is the basic page (no bio, 2026-10-13), so Lite passes
// noBio and the list is two tasks there. Premium passes `premium`.
export const starterTaskKeys = ({ premium, noBio } = {}) =>
  premium ? PREMIUM_TASK_KEYS : noBio ? STARTER_TASK_KEYS.filter((k) => k !== "bio") : STARTER_TASK_KEYS;

export const starterTasksAllDone = (args) =>
  starterTaskKeys(args).every((k) => starterTaskState(args)[k]);

// The unfinished tasks the seller can do from a settings or listings screen,
// in list order. The owner's strip on their own mini page reads this, so the
// page and the dashboard never ask for different things ("one list"). The
// account step is always done and the mini page step is the page they are on.
export const starterTodoKeys = (args) =>
  starterTaskKeys(args).filter((k) => k !== "account" && k !== "minipage" && !starterTaskState(args)[k]);

export default function StarterTasks({
  profile,
  listingCount,
  onAddListing,
  onVisitMinipage,
  onEditBio,
  onEditPhoto,
  onVerify,
  onDismiss,
  noBio = false,
  premium = false,
  t,
  // Both seller panels are dark surfaces, but they own different token sets, so
  // the palette comes in rather than being hardcoded to either one's.
  palette,
}) {
  const P = {
    surface: "#111827",
    border: "rgba(255,255,255,0.08)",
    line: "rgba(255,255,255,0.06)",
    text: "#f1f5f9",
    textMuted: "#9ca3af",
    textDim: "#6b7280",
    accent: "#dc2626",
    onAccent: "#fff",
    success: "#22c55e",
    ...(palette || {}),
  };

  const done = useMemo(
    () => starterTaskState({ profile, listingCount }),
    [profile, listingCount],
  );
  const keys = starterTaskKeys({ premium, noBio });
  const doneCount = keys.filter((k) => done[k]).length;
  const allDone = doneCount === keys.length;

  // Translation is optional so either page can pass its own `t` (both have
  // one) without this component owning a namespace neither uses.
  const tr = (key, fallback) => {
    const out = t ? t(`starterTasks.${key}`, { defaultValue: fallback }) : fallback;
    return out === `starterTasks.${key}` ? fallback : out;
  };

  const ALL_TASKS = [
    {
      key: "account",
      icon: UserCheck,
      title: tr("accountTitle", "Create your account"),
    },
    {
      key: "listing",
      icon: Plus,
      title: tr("listingTitle", "Add your first listing"),
      sub: tr("listingSub", "Photos, price, publish — this is what buyers actually find you through."),
      cta: tr("listingCta", "Add a listing"),
      action: onAddListing,
    },
    {
      key: "minipage",
      icon: ExternalLink,
      title: tr("minipageTitle", "Visit your mini page"),
      sub: tr("minipageSub", "Your public storefront. See exactly what a buyer sees before you share the link."),
      cta: tr("minipageCta", "Open my page"),
      action: onVisitMinipage,
    },
    {
      key: "photo",
      icon: Camera,
      title: tr("photoTitle", "Add a profile photo"),
      sub: tr("photoSub", "Your face on your page. Buyers message a person they can see."),
      cta: tr("photoCta", "Add a photo"),
      action: onEditPhoto,
    },
    {
      key: "bio",
      icon: PenLine,
      title: tr("bioTitle", "Complete your mini page bio"),
      sub: tr("bioSub", "A few lines on who you are. Buyers message the agent they trust, not the cheapest listing."),
      cta: tr("bioCta", "Write my bio"),
      action: onEditBio,
    },
    {
      key: "verified",
      icon: BadgeCheck,
      title: tr("verifiedTitle", "Get verified"),
      sub: tr("verifiedSub", "The Verified badge on your page and cars. Photos of your MyKad, about 2 minutes."),
      cta: tr("verifiedCta", "Get verified"),
      action: onVerify,
    },
  ];
  const TASKS = ALL_TASKS.filter((task) => keys.includes(task.key));

  // The first unfinished task is the one being asked for. Everything else is
  // either already ticked or waiting its turn, so only one CTA is ever the
  // primary — one accent per card (anti-slop rule).
  const nextKey = TASKS.find((task) => !done[task.key])?.key;

  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 16px", borderBottom: `1px solid ${P.line}` }}>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, color: P.textMuted }}>
          {allDone ? tr("doneHeading", "You're set up") : tr("heading", "Get set up")}
        </span>
        {/* Progress as a count; the longer Premium list adds a thin bar
            under the header, where "1/6" alone reads as a long way off. */}
        <span style={{ fontSize: 11, fontWeight: 600, color: allDone ? P.success : P.textDim, flexShrink: 0 }}>
          {doneCount}/{keys.length}
        </span>
      </div>

      {keys.length > 3 && !allDone && (
        <div aria-hidden style={{ height: 3, background: P.line }}>
          <div style={{ height: "100%", width: `${(doneCount / keys.length) * 100}%`, background: P.success, transition: "width 0.3s ease" }} />
        </div>
      )}

      <div style={{ padding: 16 }}>
        {allDone ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.text }}>
                {tr("doneTitle", "Your page is ready to share.")}
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 12.5, color: P.textMuted, lineHeight: 1.5 }}>
                {tr("doneSub", "Listing up, page live, bio written. Send the link to your WhatsApp groups and let it work.")}
              </p>
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: 9, background: "transparent", border: `1px solid ${P.border}`, color: P.textMuted, cursor: "pointer", fontFamily: "system-ui,sans-serif" }}
              >
                {tr("hide", "Hide this")}
              </button>
            )}
          </div>
        ) : (
          // Ticked rows drop out (owner, 2026-10-18: they only took space). The
          // count and the bar in the header still carry what is done, so the
          // pre-ticked "account" head start is not lost.
          TASKS.filter((task) => !done[task.key]).map((task, idx) => {
            const isDone = done[task.key];
            const isNext = task.key === nextKey;
            // Only the next task is spelled out. Later ones are a single dim
            // line, so a first-time seller reads one ask, not three (owner,
            // 2026-10-12: the first dashboard was "too many tasks").
            const isLater = !isDone && !isNext;
            const Icon = task.icon;
            return (
              <div
                key={task.key}
                style={{ display: "flex", alignItems: isLater ? "center" : "flex-start", gap: 12, padding: idx > 0 ? (isLater ? "10px 0 0" : "14px 0 0") : 0, marginTop: idx > 0 ? (isLater ? 10 : 14) : 0, borderTop: idx > 0 ? `1px solid ${P.line}` : "none" }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 26, height: 26, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                    background: isDone ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isDone ? "rgba(34,197,94,0.3)" : P.border}`,
                    color: isDone ? P.success : P.textDim,
                  }}
                >
                  {isDone ? <Check size={13} strokeWidth={3} /> : <Icon size={13} />}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, color: isDone || isLater ? P.textMuted : P.text, fontWeight: isLater ? 500 : 600, textDecoration: isDone ? "line-through" : "none" }}>
                    {task.title}
                  </p>
                  {isNext && (
                    <p style={{ margin: "2px 0 0", fontSize: 12.5, color: P.textMuted, lineHeight: 1.5 }}>
                      {task.sub}
                    </p>
                  )}
                </div>

                {isNext && task.action && (
                  <button
                    onClick={task.action}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                      fontSize: 12.5, fontWeight: 700, padding: "7px 13px", borderRadius: 9,
                      cursor: "pointer", fontFamily: "system-ui,sans-serif",
                      background: isNext ? P.accent : "transparent",
                      border: isNext ? "none" : `1px solid ${P.border}`,
                      color: isNext ? P.onAccent : P.textMuted,
                    }}
                  >
                    {task.cta}
                    <ChevronRight size={12} style={{ opacity: 0.7 }} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
