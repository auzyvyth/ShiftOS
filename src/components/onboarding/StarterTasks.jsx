import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, Plus, ExternalLink, PenLine, UserPlus, BellRing, Radio } from "lucide-react";

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
//
// PHASE 2, "start selling here" (2026-10-11). Most sellers here run their whole
// business in WhatsApp and have never used a pipeline, so a page that is set up
// still leaves them not knowing what the rest of the panel is for. Once the
// three setup tasks are done the same card moves on to three habits, each tied
// to something they already do in WhatsApp:
//   lead     -> they have at least one lead (any source)
//   followup -> at least one lead has a follow_up_at reminder
//   live     -> profiles.starter_tasks.live_opened (set when the owner opens the
//               Live presenter on their mini page). PREMIUM ONLY: Lite cannot
//               open the presenter, so for Lite it is a row with a Premium tag
//               that never counts towards the total, or the card could never
//               finish.
// Phase 1 is retired by `starter_tasks.dismissed`, phase 2 by
// `starter_tasks.sell_dismissed`. Sellers who finished setup before phase 2
// existed already have `dismissed`, so they land straight on phase 2.

export const STARTER_TASK_KEYS = ["listing", "minipage", "bio"];

// Non-empty and not just whitespace. A bio of " " is not a bio.
export const hasBio = (profile) => !!String(profile?.bio || "").trim();

export const starterTaskState = ({ profile, listingCount }) => ({
  listing: (listingCount || 0) > 0,
  minipage: !!profile?.starter_tasks?.minipage_visited,
  bio: hasBio(profile),
});

export const starterTasksAllDone = (args) =>
  STARTER_TASK_KEYS.every((k) => starterTaskState(args)[k]);

const OPEN_LEAD = (l) => !["won", "lost", "closed_won", "closed_lost"].includes(l?.stage);

export const sellTaskKeys = (canGoLive) => (canGoLive ? ["lead", "followup", "live"] : ["lead", "followup"]);

export const sellTaskState = ({ profile, leads }) => ({
  lead: (leads || []).length > 0,
  followup: (leads || []).some((l) => !!l.follow_up_at),
  live: !!profile?.starter_tasks?.live_opened,
});

export const sellTasksAllDone = ({ profile, leads, canGoLive }) => {
  const st = sellTaskState({ profile, leads });
  return sellTaskKeys(canGoLive).every((k) => st[k]);
};

// The lead a "set a reminder" tap should open: the newest one still in play.
export const leadForFollowUp = (leads) =>
  [...(leads || [])].filter(OPEN_LEAD).sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0] || null;

// Both phases finished or hidden: the card never renders again.
export const starterCardRetired = (profile) =>
  !!profile?.starter_tasks?.dismissed && !!profile?.starter_tasks?.sell_dismissed;

export default function StarterTasks({
  profile,
  listingCount,
  onAddListing,
  onVisitMinipage,
  onEditBio,
  // Phase 2. `leadsLoaded` matters: before the leads arrive every seller
  // looks like they have none, and the card would tell a busy rep to add one.
  leads,
  leadsLoaded,
  canGoLive,
  onAddLead,
  onSetFollowUp,
  onGoLive,
  onSeePremium,
  onDismiss,
  t,
  // Both seller panels are dark surfaces, but they own different token sets, so
  // the palette comes in rather than being hardcoded to either one's.
  palette,
}) {
  const { t: hookT } = useTranslation();
  const tFn = t || hookT;
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

  const setupDone = useMemo(
    () => starterTaskState({ profile, listingCount }),
    [profile, listingCount],
  );
  const sellDone = useMemo(() => sellTaskState({ profile, leads }), [profile, leads]);

  // Phase 1 is over once it is all ticked, or was retired on an earlier visit.
  const inSellPhase =
    !!profile?.starter_tasks?.dismissed || STARTER_TASK_KEYS.every((k) => setupDone[k]);

  const tr = (key, fallback) => {
    const out = tFn ? tFn(`starterTasks.${key}`, { defaultValue: fallback }) : fallback;
    return out === `starterTasks.${key}` ? fallback : out;
  };

  const SETUP_TASKS = [
    {
      key: "listing",
      icon: Plus,
      title: tr("listingTitle", "Add your first listing"),
      sub: tr("listingSub", "Photos, price, publish. This is what buyers actually find you through."),
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
      key: "bio",
      icon: PenLine,
      title: tr("bioTitle", "Complete your mini page bio"),
      sub: tr("bioSub", "A few lines on who you are. Buyers message the agent they trust, not the cheapest listing."),
      cta: tr("bioCta", "Write my bio"),
      action: onEditBio,
    },
  ];

  // Each one starts from a WhatsApp habit the seller already has, because
  // that is the only system most of them have ever used.
  const SELL_TASKS = [
    {
      key: "lead",
      icon: UserPlus,
      title: tr("leadTitle", "Add a WhatsApp buyer as a lead"),
      sub: tr("leadSub", "A buyer asked about a car on WhatsApp? Put their name and number here so they don't sink in your chats."),
      cta: tr("leadCta", "Add a lead"),
      action: onAddLead,
    },
    {
      key: "followup",
      icon: BellRing,
      title: tr("followupTitle", "Set a follow-up reminder"),
      sub: tr("followupSub", "Buyer said \"let me think first\"? Pick a date and they show up on your dashboard that day. No more scrolling chats to find them."),
      cta: tr("followupCta", "Set a reminder"),
      action: onSetFollowUp,
    },
    {
      key: "live",
      icon: Radio,
      premiumOnly: !canGoLive,
      title: tr("liveTitle", "Try Live presentation"),
      sub: canGoLive
        ? tr("liveSub", "Going live on TikTok or Facebook? Show your cars one by one, with price and monthly already worked out.")
        : tr("liveSubLite", "For TikTok and Facebook lives: your cars one by one, monthly already worked out. Part of Premium."),
      cta: canGoLive ? tr("liveCta", "Open Live") : tr("liveCtaLite", "See Premium"),
      action: canGoLive ? onGoLive : onSeePremium,
    },
  ];

  const TASKS = inSellPhase ? SELL_TASKS : SETUP_TASKS;
  const done = inSellPhase ? sellDone : setupDone;
  // A Premium-only row on Lite is shown but never counted: it cannot be done.
  const counted = TASKS.filter((task) => !task.premiumOnly);
  const doneCount = counted.filter((task) => done[task.key]).length;
  const allDone = doneCount === counted.length;

  if (inSellPhase && !leadsLoaded) return null;

  // The first unfinished task is the one being asked for. Everything else is
  // either already ticked or waiting its turn, so only one CTA is ever the
  // primary — one accent per card (anti-slop rule).
  const nextKey = counted.find((task) => !done[task.key])?.key;

  const heading = inSellPhase
    ? (allDone ? tr("sellDoneHeading", "You're selling here") : tr("sellHeading", "Start selling here"))
    : (allDone ? tr("doneHeading", "You're set up") : tr("heading", "Get set up"));

  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 16px", borderBottom: `1px solid ${P.line}` }}>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, color: P.textMuted }}>
          {heading}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {/* Phase 2 can be hidden before it is finished: a rep who only
              ever closes in person should not have this on top for good. */}
          {inSellPhase && !allDone && onDismiss && (
            <button
              onClick={onDismiss}
              style={{ fontSize: 11, fontWeight: 600, padding: 0, background: "transparent", border: "none", color: P.textDim, cursor: "pointer", fontFamily: "inherit" }}
            >
              {tr("hideShort", "Hide")}
            </button>
          )}
          {/* Progress as a count, not a bar — three items don't need a bar, and
              "2 of 3" says the same thing in less space. */}
          <span style={{ fontSize: 11, fontWeight: 600, color: allDone ? P.success : P.textDim }}>
            {doneCount}/{counted.length}
          </span>
        </span>
      </div>

      <div style={{ padding: 16 }}>
        {inSellPhase && !allDone && (
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: P.textMuted, lineHeight: 1.5 }}>
            {tr("sellIntro", "Your page is up. Keep chatting on WhatsApp; use this to remember who wants what.")}
          </p>
        )}
        {allDone ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.text }}>
                {inSellPhase
                  ? tr("sellDoneTitle", "That's the whole routine.")
                  : tr("doneTitle", "Your page is ready to share.")}
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 12.5, color: P.textMuted, lineHeight: 1.5 }}>
                {inSellPhase
                  ? tr("sellDoneSub", "Buyer messages you: add a lead. They need time: set a reminder. Your list does the remembering.")
                  : tr("doneSub", "Listing up, page live, bio written. Send the link to your WhatsApp groups and let it work.")}
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
          TASKS.map((task, idx) => {
            const isDone = !task.premiumOnly && done[task.key];
            const isNext = task.key === nextKey;
            const Icon = task.icon;
            return (
              <div
                key={task.key}
                style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: idx > 0 ? "14px 0 0" : 0, marginTop: idx > 0 ? 14 : 0, borderTop: idx > 0 ? `1px solid ${P.line}` : "none" }}
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
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: isDone ? P.textMuted : P.text, textDecoration: isDone ? "line-through" : "none" }}>
                    {task.title}
                    {task.premiumOnly && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, border: `1px solid ${P.border}`, color: P.textMuted, verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        Premium
                      </span>
                    )}
                  </p>
                  {!isDone && (
                    <p style={{ margin: "2px 0 0", fontSize: 12.5, color: P.textMuted, lineHeight: 1.5 }}>
                      {task.sub}
                    </p>
                  )}
                  {/* Button sits under the text, not beside it: beside it, a
                      375px phone squeezed the explanation into a narrow column. */}
                  {!isDone && task.action && (
                    <button
                      onClick={task.action}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10,
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
