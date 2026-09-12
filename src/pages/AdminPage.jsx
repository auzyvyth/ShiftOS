import React, { useEffect, useState } from "react";
// The platform console runs on an ISOLATED auth client (its own storageKey) so a
// dealer/salesman/buyer login in another tab can't clobber the superadmin
// session. Everything in this file queries as that session. `mainClient` is only
// used once, to adopt an existing superadmin session handed off from the public
// /login redirect (see checkAuth).
import { platformClient as supabase } from "../lib/platformClient";
import { throttleCheck, throttleFail, throttleClear } from "../utils/authThrottle";
import useAuthCaptcha, { isCaptchaError, CAPTCHA_ERROR_MESSAGE } from "../hooks/useAuthCaptcha";
import { supabase as mainClient } from "../supabaseClient";
import { invalidateMarketplaceSettingsCache, MARKETPLACE_FALLBACK } from "../hooks/useMarketplaceSettings";
import { PLAN_CONFIG } from "../utils/planConfig";
import FunnelTab from "../components/platform/FunnelTab";
import EngagementTab from "../components/platform/EngagementTab";
import UserApprovalsTab from "../components/platform/UserApprovalsTab";
import AccountsTab from "../components/platform/AccountsTab";
import BuyersTab from "../components/platform/BuyersTab";
import ErrorsTab from "../components/platform/ErrorsTab";
import BroadcastTab from "../components/platform/BroadcastTab";
import ActivityLogTab from "../components/platform/ActivityLogTab";
import SessionsTab from "../components/platform/SessionsTab";
import PostureTab from "../components/platform/PostureTab";
import AlertsTab from "../components/platform/AlertsTab";
import ReportsTab from "../components/platform/ReportsTab";
import ListingReviewModal, { listingFlags, relTime } from "../components/platform/ListingReviewModal";

function MktSection({ label, hint, children }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "20px 24px" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: hint ? 6 : 16 }}>{label}</p>
      {hint && <p style={{ fontSize: 11, color: "#4b5563", marginBottom: 14 }}>{hint}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

function MktField({ label, hint, children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
      <div style={{ minWidth: 190 }}>
        <p style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500, margin: 0 }}>{label}</p>
        {hint && <p style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function MktToggle({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button onClick={() => onChange(!value)} style={{ width: 36, height: 20, borderRadius: 10, background: value ? "rgba(220,38,38,0.7)" : "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.2s", display: "block" }} />
      </button>
      <span style={{ fontSize: 13, color: "#9ca3af" }}>{label}</span>
    </div>
  );
}

function UsageBar({ used, cap, danger }) {
  if (cap == null) return <span style={{ fontSize: 11, color: '#4b5563' }}>unlimited</span>;
  const pct = Math.min(100, (used / cap) * 100);
  const atCap = used >= cap;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 11, color: atCap ? '#f87171' : '#9ca3af', fontWeight: atCap ? 700 : 400 }}>{used}/{cap}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', width: 80 }}>
        <div style={{ height: '100%', borderRadius: 2, background: atCap ? '#dc2626' : (danger ? '#f59e0b' : '#3b82f6'), width: `${pct}%`, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

// Module scope, not inside AdminPage: BillingTab is a top-level component and
// renders these too.
const StatCard = ({ label, value, sub, color = "#e5e7eb" }) => (
  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "20px 24px" }}>
    <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</p>
    <p style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em" }}>{value}</p>
    {sub && <p style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>{sub}</p>}
  </div>
);

// Billing is the ONE place MRR and subscription mix are stated (P2). The same
// Total / Active / Trial / Expired / MRR figures used to render on Dealers and
// on Platform Stats as well -- three surfaces, one truth, no indication which
// was canonical, and they disagreed: the per-plan chips here multiplied plan
// price by EVERY dealer on that plan, counting trial and expired accounts as
// revenue. Only a paying dealer is revenue, and it is counted here only.
function BillingTab({ dealers, dealerStats }) {
  const rows = dealers.map(d => {
    const cfg = PLAN_CONFIG[d.plan] || null;
    const ds = dealerStats[d.id] || {};
    return { ...d, cfg, ds };
  });
  const paying = r => r.subscription_status === 'active';
  const plans = {};
  rows.forEach(r => {
    const k = r.plan || 'none';
    if (!plans[k]) plans[k] = { total: 0, paying: 0 };
    plans[k].total += 1;
    if (paying(r)) plans[k].paying += 1;
  });
  const counts = {
    total: rows.length,
    active: rows.filter(paying).length,
    trial: rows.filter(r => r.subscription_status === 'trial').length,
    expired: rows.filter(r => r.subscription_status === 'expired').length,
  };
  // Unknown / legacy plans count 0 rather than silently inflating MRR.
  const mrr = rows.filter(paying).reduce((sum, r) => sum + (r.cfg?.price ?? 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Billing</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>The only place revenue and plan mix are stated. Counts are dealers; MRR counts paying dealers only.</p>
      </div>

      <div className="adm-stat4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 22 }}>
        <StatCard label="Est. MRR" value={`RM ${mrr.toLocaleString()}`} color="#dc2626" sub="Sum of paying plan prices" />
        <StatCard label="Paying" value={counts.active} color="#4ade80" />
        <StatCard label="On trial" value={counts.trial} color="#facc15" />
        <StatCard label="Expired" value={counts.expired} color="#f87171" />
        <StatCard label="Total dealers" value={counts.total} />
      </div>

      {/* Subscription mix */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <p style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Subscription mix</p>
        <div style={{ display: 'flex', gap: 0, height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 12, background: 'rgba(255,255,255,0.04)' }}>
          {counts.total > 0 && (
            <>
              <div style={{ flex: counts.active, background: '#16a34a' }} />
              <div style={{ flex: counts.trial, background: '#ca8a04' }} />
              <div style={{ flex: counts.expired, background: '#dc2626' }} />
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[{ label: 'Paying', count: counts.active, color: '#16a34a' }, { label: 'Trial', count: counts.trial, color: '#ca8a04' }, { label: 'Expired', count: counts.expired, color: '#dc2626' }].map(({ label, count, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{label}: <strong style={{ color: '#e5e7eb' }}>{count}</strong></span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-plan chips */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {Object.entries(plans).map(([plan, c]) => {
          const cfg = PLAN_CONFIG[plan];
          return (
            <div key={plan} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 14px', minWidth: 120 }}>
              <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{cfg?.label || plan}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#f0f0f0' }}>{c.total}</p>
              <p style={{ fontSize: 10, color: '#4b5563' }}>
                {cfg ? `${c.paying} paying · RM ${(cfg.price * c.paying).toLocaleString()} MRR` : `${c.paying} paying`}
              </p>
            </div>
          );
        })}
      </div>

      {/* Per-dealer table */}
      <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Dealer', 'Plan', 'Price/mo', 'Listings', 'Seats', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#4b5563' }}>No dealers.</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: r.is_active === false ? 0.45 : 1 }}>
                  <td style={{ padding: '10px 14px' }}>
                    <p style={{ fontWeight: 600, color: '#f0f0f0' }}>{r.dealership || r.full_name || '—'}</p>
                    <p style={{ fontSize: 10, color: '#6b7280' }}>{r.email}</p>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {r.cfg ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: 'rgba(220,38,38,0.1)', borderRadius: 4, padding: '2px 7px' }}>{r.cfg.label}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#4b5563' }}>{r.plan || '—'}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#9ca3af' }}>
                    {r.cfg ? `RM ${r.cfg.price.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <UsageBar used={r.ds.available ?? r.ds.listings ?? 0} cap={r.cfg?.listingCap ?? null} danger={(r.ds.available ?? 0) >= (r.cfg?.listingCap ?? Infinity) * 0.8} />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <UsageBar used={r.ds.team ?? 0} cap={r.cfg?.seatCap ?? null} danger={(r.ds.team ?? 0) >= (r.cfg?.seatCap ?? Infinity) * 0.8} />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: r.subscription_status === 'active' ? '#4ade80' : r.subscription_status === 'trial' ? '#facc15' : '#f87171' }}>
                      {r.subscription_status || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  // AUTH-6. The captcha is a PROJECT-wide Supabase setting, so it applies to the
  // isolated platformClient session too — this console login needs a token like
  // any other.
  const { getToken } = useAuthCaptcha();
  // Auth gate for the isolated management console.
  //   "checking" → verifying the platform session on mount
  //   "login"    → no valid superadmin session; show the sign-in gate
  //   "authed"   → superadmin confirmed; render the console
  const [authState, setAuthState] = useState("checking");
  // Id of the superadmin this console is running as. Needed by the Alerts tab:
  // a push subscription is stored per user_id, so the toggle has to know who.
  const [meId, setMeId] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  // Brute-force lock (utils/authThrottle.js). /login enforced one and this page
  // did not — and this is the superadmin credential, so it was the softest way
  // in on the platform. No visible countdown here: the console is deliberately
  // spartan, and login_throttle_check hands back the live remaining seconds on
  // the next submit, so the number is never stale when it matters.
  const [mfaFactorId, setMfaFactorId] = useState(null);
  const [mfaCode, setMfaCode] = useState("");
  const [dealers, setDealers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [stats, setStats] = useState({
    total: 0, active: 0, trial: 0, expired: 0,
    totalListings: 0, totalEnquiries: 0,
  });
  const [loading, setLoading] = useState(true);
  // Every account in one list (P5); `dealers` / `salesmen` are views over it,
  // kept because BillingTab and the broadcast tab read them.
  const [accounts, setAccounts] = useState([]);
  const [accountStats, setAccountStats] = useState({});
  // Id to open in the account record — set by global search (P7) and by the
  // dealer <-> team links inside the record (A8).
  const [focusAccount, setFocusAccount] = useState(null);
  // Global search (P7). There were three search boxes -- waitlist, salesmen,
  // dealers -- and nothing searched across object types, so finding "that guy
  // who emailed me" meant guessing which tab he was in first. This searches
  // everything already loaded, so it costs no queries.
  const [globalQ, setGlobalQ] = useState("");
  const [globalOpen, setGlobalOpen] = useState(false);
  // The console lands on Home, not a directory (P3). The daily job is the review
  // queue; an operator should never have to go looking for their own work.
  const [activeTab, setActiveTab] = useState("home");
  // Review queue type filter: "all" | "listings" | "signups" | "ids" (P4).
  const [reviewFilter, setReviewFilter] = useState("all");
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  // Top-level consoles in the superadmin panel. "shiftos" = the existing SaaS ops
  // (dealers/approvals/billing…); "xdrive" = public marketplace analytics;
  // "security" = audit forensics, sessions and posture.
  const [activeSection, setActiveSection] = useState("work");
  // Surfaces a failed account action instead of leaving the console looking
  // like nothing happened (A2).
  const [actionError, setActionError] = useState(null);
  const [waitlist, setWaitlist] = useState([]);
  const [waitlistSearch, setWaitlistSearch] = useState("");
  const [pendingListings, setPendingListings] = useState([]);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  // Open listing-report count, for the Reports tab badge. Kept here (not in
  // ReportsTab) so the badge is live before the tab is ever opened.
  const [openReportCount, setOpenReportCount] = useState(0);
  const [pendingSignupCount, setPendingSignupCount] = useState(0);
  const [pendingKycCount, setPendingKycCount] = useState(0);
  // Which listing's Review sheet is open. Held as an ID, not the row object, so
  // the sheet re-renders off the live pendingListings entry after a docs-verified
  // or note write instead of showing a stale snapshot.
  const [reviewListingId, setReviewListingId] = useState(null);
  const [approvalActioning, setApprovalActioning] = useState(null);
  const [selectedListingIds, setSelectedListingIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [blastModal, setBlastModal] = useState(false);
  const [blastMsg, setBlastMsg] = useState("Hi! ShiftOS Lite is launching soon — free car listings, your own profile page, and lead tracking. You're on the early list. Stay tuned!");
  const [blastCopied, setBlastCopied] = useState(null); // "numbers" | "msg" | null

  // Marketplace settings tab
  const [mktSettings, setMktSettings] = useState(null);
  const [mktLoading,  setMktLoading]  = useState(false);
  const [mktSaving,   setMktSaving]   = useState(false);
  const [mktSaved,    setMktSaved]    = useState(false);

  const MKT_ID = '00000000-0000-0000-0000-000000000001';

  useEffect(() => { checkAuth(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Silent push repair for the platform account. usePushHeal (App.jsx) does the
  // same job app-wide, but it heals whoever the MAIN client is signed in as —
  // on /platform that is a different account, or nobody. Without this, an admin
  // whose browser rotated its push subscription would stay unreachable until
  // they happened to open Security > Alerts. Never prompts: it only acts where
  // permission was already granted.
  useEffect(() => {
    if (!meId) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    import("../hooks/usePushNotifications")
      .then(({ healPushSubscription }) => healPushSubscription(meId, supabase))
      .catch(() => { /* never blocks the console */ });
  }, [meId]);

  // Live approval queues. Push tells you when the console is CLOSED, but it is
  // not a dependable "instant" signal on its own: a browser can silently rotate
  // its subscription (send-push deletes it on a 410) and the admin is then
  // unreachable with nothing on screen to say so. With the console open,
  // realtime is the reliable path — a car submitted for approval or a seller
  // finishing onboarding shows up here without a refresh.
  //
  // Both queues are rebuilt through loadAll() rather than patched in place, so
  // the derived fraud checks (duplicate plate, shared phone, live counts) stay
  // correct instead of drifting from a partial insert.
  useEffect(() => {
    if (!meId) return;
    let timer = null;
    const bump = () => { clearTimeout(timer); timer = setTimeout(() => loadAll(true), 400); };
    const channel = supabase
      .channel("platform-approval-queues")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "car_listings", filter: "status=eq.pending_approval" },
        bump,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_documents" }, bump)
      .subscribe();

    // Backstop for the signup queue. `profiles` is deliberately NOT in the
    // realtime publication — it is the most-written table in the app, and
    // publishing it would put every subscriber's RLS in the path of every
    // profile update. A slow poll is the cheaper trade here; push covers the
    // case where this console is closed.
    const poll = setInterval(() => loadAll(true), 60000);

    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [meId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gate the console on the ISOLATED platform session. Resolution order:
  //   1. An existing platform session (this client's own storageKey).
  //   2. Otherwise adopt a superadmin session handed off from the public /login
  //      redirect: the main client has it, we copy it into the platform store so
  //      from here on the two are independent (other-tab logins can't evict it).
  //   3. Otherwise show the sign-in gate — a dealer/salesman/buyer session on the
  //      main client is NEVER adopted, so the console can't run under one.
  async function checkAuth() {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data: { session: mainSession } } = await mainClient.auth.getSession();
      if (mainSession?.user?.id) {
        const { data: prof } = await mainClient
          .from("profiles").select("role").eq("id", mainSession.user.id).maybeSingle();
        if (prof?.role === "superadmin") {
          await supabase.auth.setSession({
            access_token: mainSession.access_token,
            refresh_token: mainSession.refresh_token,
          });
          session = mainSession;
        }
      }
    }
    if (!session?.user?.id) { setAuthState("login"); return; }
    await verifyAndLoad(session.user.id);
  }

  // Confirm the (platform) session belongs to a superadmin before rendering the
  // console. A non-superadmin session is signed out locally, not just redirected.
  async function verifyAndLoad(userId) {
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", userId).maybeSingle();
    if (profile?.role !== "superadmin") {
      await supabase.auth.signOut({ scope: "local" });
      setAuthError("That account is not a platform administrator.");
      setAuthState("login");
      return;
    }
    setMeId(userId);
    setAuthState("authed");
    setLoginBusy(false);
    await loadAll();
  }

  // Sign-in on the platform client only — separate credentials entry for the
  // management console. 2FA is honoured if a verified TOTP factor exists.
  async function handlePlatformLogin(e) {
    e?.preventDefault();
    if (loginBusy) return;
    setAuthError("");
    setLoginBusy(true);
    const cleanEmail = loginEmail.trim().toLowerCase();

    // Locked out? Refuse before spending an attempt. Runs on `supabase` (the
    // platform client) — same project and anon key, so the RPCs resolve the
    // same, and the CLEAR below needs the client that holds the new session.
    const gate = await throttleCheck(cleanEmail, supabase);
    if (!gate.allowed) {
      setAuthError(`Too many attempts. Try again in ${gate.secondsLeft}s.`);
      setLoginBusy(false);
      return;
    }

    const captchaToken = await getToken();
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: loginPw,
      options: { captchaToken },
    });
    if (error) {
      // A captcha rejection arrives as a 400 too. Catch it before the
      // isInvalidCreds test below spends one of this account's three attempts
      // on a password that was never actually judged.
      if (isCaptchaError(error)) {
        setAuthError(CAPTCHA_ERROR_MESSAGE);
        setLoginBusy(false);
        return;
      }
      // Only a genuinely rejected credential counts against the lock. A network
      // blip or a 5xx must never spend an attempt — this is the one account that
      // cannot ask anyone else to let it back in.
      const isInvalidCreds =
        error.status === 400 ||
        /invalid|credential/i.test(error.message || "");
      const f = isInvalidCreds
        ? await throttleFail(cleanEmail, supabase)
        : { locked: false, secondsLeft: 0, attempts: 0 };
      setAuthError(f.locked
        ? `Too many attempts. Try again in ${f.secondsLeft}s.`
        : error.message);
      setLoginBusy(false);
      return;
    }
    throttleClear(cleanEmail, supabase);
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = (factors?.totp || []).find((f) => f.status === "verified");
      if (totp) { setMfaFactorId(totp.id); setLoginBusy(false); return; }
    }
    const { data: { user } } = await supabase.auth.getUser();
    await verifyAndLoad(user.id);
  }

  async function handlePlatformMfa(e) {
    e?.preventDefault();
    const code = mfaCode.trim();
    if (code.length < 6) { setAuthError("Enter the 6-digit code."); return; }
    setAuthError("");
    setLoginBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (chErr) { setAuthError(chErr.message); setLoginBusy(false); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: ch.id, code });
    if (vErr) { setAuthError("Invalid code. Please try again."); setLoginBusy(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    setMfaFactorId(null);
    setMfaCode("");
    await verifyAndLoad(user.id);
  }

  async function handlePlatformSignOut() {
    // scope:local so signing out of the console does NOT revoke the superadmin's
    // sessions elsewhere — only this isolated store is cleared.
    await supabase.auth.signOut({ scope: "local" });
    setDealers([]); setSalesmen([]); setPendingListings([]); setWaitlist([]);
    setLoginEmail(""); setLoginPw(""); setMfaFactorId(null); setMfaCode("");
    setAuthState("login");
  }

  async function loadAll(silent = false) {
    // silent=true is for the 60s profiles-table backstop poll and the realtime
    // bump (see the effect above) — those refetch everything in the background
    // and must NOT blank the whole console to a "Loading…" placeholder every
    // time, which is what made the console look like it reloads every minute.
    if (!silent) setLoading(true);

    // Load dealers
    // ONE query for every account (P5). Dealers and salesmen are the same
    // object with a different role; fetching them separately is what let the
    // two halves of the console drift to different standards. `dealers` and
    // `salesmen` below are just views over this list.
    //
    // ic_number is deliberately NOT selected: the console shows ic_last4, and
    // a full IC has no business crossing the wire to build a table.
    const { data: accountData } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, dealership, subdomain, slug, role, dealer_id, subscription_status, trial_ends_at, created_at, is_active, account_status, deleted_at, city, state, whatsapp_number, business_type, payment_status, plan, is_verified, verified_at, ssm_number, ic_last4, ic_verified_at, kyc_submitted_at, suspension_reason, suspended_at, approval_status, rejection_reason")
      .in("role", ["dealer", "owner", "superadmin", "salesman"])
      .order("created_at", { ascending: false });

    const allAccounts = accountData || [];
    setAccounts(allAccounts);
    const dealers = allAccounts.filter(a => ["dealer", "owner", "superadmin"].includes(a.role));
    setDealers(dealers);
    setSalesmen(allAccounts.filter(a => a.role === "salesman"));

    // Global stats
    const active = dealers.filter(d => d.subscription_status === "active").length;
    const trial  = dealers.filter(d => d.subscription_status === "trial").length;
    const expired = dealers.filter(d => d.subscription_status === "expired").length;

    const { count: totalListings } = await supabase
      .from("car_listings").select("*", { count: "exact", head: true });
    const { count: totalEnquiries } = await supabase
      .from("whatsapp_enquiries").select("*", { count: "exact", head: true });

    // No mrr here: revenue is computed once, in BillingTab (P2).
    setStats({ total: dealers.length, active, trial, expired,
      totalListings: totalListings || 0, totalEnquiries: totalEnquiries || 0 });

    // Activity for EVERY account, from one RPC (A4). Salesmen had no counts at
    // all before, so the console could not say which Lite sellers actually use
    // the product. Counts come from get_account_activity rather than more
    // client-side queries because `leads` has no superadmin SELECT policy and
    // must not get one -- lead rows carry buyer name, phone, IC and address.
    // The RPC returns numbers only.
    if (allAccounts.length > 0) {
      const { data: activity, error: actErr } = await supabase
        .rpc("get_account_activity", { p_ids: allAccounts.map(a => a.id) });
      if (actErr) setActionError(`Could not load account activity: ${actErr.message}`);
      const byAccount = {};
      (activity || []).forEach(r => { byAccount[r.id] = r; });
      setAccountStats(byAccount);
    }
    if (!silent) setLoading(false);

    // Load waitlist
    const { data: wl } = await supabase
      .from("waitlist_signups")
      .select("id, name, phone, referral_code, referred_by, position, founding_member, created_at")
      .order("position", { ascending: true });
    setWaitlist(wl || []);

    // Load pending approval listings (salesman-lite standalone accounts)
    const { data: pending } = await supabase
      .from("car_listings")
      // COMPLETE select, not a summary one: the Review sheet shows every field a
      // reviewer has to check, and a partial select is how a detail drawer ends
      // up quietly rendering blanks (CLAUDE.md overlay rule 4). Deliberately
      // absent: profiles.ic_number (stored hashed) and the seller's cost
      // columns -- neither is any part of an approval decision.
      .select(`id, year, brand, model, variant, mileage, colour, condition, auction_grade, interior_grade,
        is_recon, import_country, auction_house, local_reg_date, chassis_status, plate_number, vin_number, vin,
        engine_number, registration_date, previous_owners, road_tax_expiry, warranty_months, deposit_amount,
        transmission, fuel_type, body_type, engine_cc, horsepower, cylinders, doors, seats, fuel_consumption,
        selling_price, original_price, previous_price, payment_type, loan_eligible, financing_type,
        sambung_monthly, sambung_months_left, sambung_balance, sambung_deposit, sambung_bank,
        description, features, options, specs, video_url, damage_map, condition_declared_at,
        included_services, included_services_cost,
        images, status, created_at, rejection_reason, admin_notes, dealer_id, city, state, slug,
        car_documents, docs_verified, docs_verified_at, geran_status,
        profiles!car_listings_dealer_id_fkey(full_name, slug, dealership, email, phone, whatsapp_number, ic_verified_at, is_verified, approval_status, plan, role, created_at, listing_count_cache, city, state)`)
      .eq("status", "pending_approval")
      .order("created_at", { ascending: true });

    // Rejection counts + duplicate-plate cross-check + shared-phone scam check
    const plates = (pending || []).map(l => l.plate_number).filter(Boolean);
    const sellerPhones = [...new Set((pending || [])
      .map(l => (l.profiles?.phone || l.profiles?.whatsapp_number || "").replace(/\D/g, ""))
      .filter(Boolean))];
    const [{ data: rejections }, { data: plateMatches }, { data: phoneOwners }, { data: liveListings }] = await Promise.all([
      supabase.from("car_listings").select("dealer_id").eq("status", "rejected").in("dealer_id", (pending || []).map(l => l.dealer_id)),
      plates.length > 0
        ? supabase.from("car_listings").select("id, plate_number, dealer_id").in("plate_number", plates).neq("status", "rejected")
        : Promise.resolve({ data: [] }),
      sellerPhones.length > 0
        ? supabase.from("profiles").select("id, phone, whatsapp_number")
        : Promise.resolve({ data: [] }),
      supabase.from("car_listings").select("dealer_id").eq("status", "available").in("dealer_id", (pending || []).map(l => l.dealer_id)),
    ]);
    const rejectionCounts = {};
    (rejections || []).forEach(r => { rejectionCounts[r.dealer_id] = (rejectionCounts[r.dealer_id] || 0) + 1; });
    const plateCounts = {};
    (plateMatches || []).forEach(p => { if (p.plate_number) plateCounts[p.plate_number] = (plateCounts[p.plate_number] || 0) + 1; });
    // Map normalized phone -> set of distinct account ids that use it.
    const phoneAccounts = {};
    (phoneOwners || []).forEach(p => {
      [p.phone, p.whatsapp_number].forEach(raw => {
        const ph = (raw || "").replace(/\D/g, "");
        if (!ph) return;
        (phoneAccounts[ph] = phoneAccounts[ph] || new Set()).add(p.id);
      });
    });
    // How many cars this seller already has LIVE in the marketplace right now —
    // a fast trust signal separate from listing_count_cache (which counts every
    // status, including past rejections).
    const liveCounts = {};
    (liveListings || []).forEach(l => { liveCounts[l.dealer_id] = (liveCounts[l.dealer_id] || 0) + 1; });

    setPendingListings((pending || []).map(l => {
      const ph = (l.profiles?.phone || l.profiles?.whatsapp_number || "").replace(/\D/g, "");
      const shared = ph ? (phoneAccounts[ph]?.size || 0) : 0;
      return {
        ...l,
        _rejectionCount: rejectionCounts[l.dealer_id] || 0,
        _duplicatePlate: l.plate_number ? (plateCounts[l.plate_number] || 0) > 1 : false,
        _sharedPhoneAccounts: shared > 1 ? shared : 0,
        _liveListingCount: liveCounts[l.dealer_id] || 0,
      };
    }));

    // Badge count for the approvals queue. Counts BOTH things that tab now
    // holds: self-signup sellers awaiting access, and ID checks from already-
    // approved sellers waiting on the Verified badge. A user sitting in both is
    // counted once, matching how the tab lists them. Cheap superadmin RPCs; the
    // Verify tab loads the full rows itself.
    Promise.all([
      supabase.rpc("get_pending_approvals"),
      supabase.rpc("get_pending_kyc"),
    ]).then(([signup, kyc]) => {
      const signupIds = new Set((signup.data || []).map((r) => r.id));
      // A user sitting in both queues is listed once, under signup -- so the ID
      // count here must exclude them or the pills add up to more than the list.
      const kycOnly = (kyc.data || []).filter((r) => !signupIds.has(r.id));
      setPendingSignupCount(signupIds.size);
      setPendingKycCount(kycOnly.length);
      setPendingUsersCount(signupIds.size + kycOnly.length);
    });

    // Open listing reports, for the Reports badge.
    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "reviewing"])
      .then(({ count, error }) => {
        if (error) { console.warn("[listing_reports count]", error.message); return; }
        setOpenReportCount(count || 0);
      });
  }

  // ── Listing decisions ────────────────────────────────────────────────────
  // One implementation each, called by the Review sheet. The queue row has no
  // decision buttons of its own: a decision made from the row is a decision made
  // without opening the geran, which is exactly what this rework removes. The
  // bulk toolbar still approves/rejects in batch for the confident sweep.
  async function approveListing(listing, { alsoVerifySeller } = {}) {
    setApprovalActioning(listing.id);
    const calls = [supabase.rpc("approve_listing", { p_listing_id: listing.id })];
    if (alsoVerifySeller) calls.push(supabase.rpc("decide_user_approval", { p_user_id: listing.dealer_id, p_approve: true }));
    const results = await Promise.all(calls);
    const err = results.find(r => r.error)?.error;
    if (err) { alert("Error: " + err.message); }
    else {
      setPendingListings(p => p.filter(l => l.id !== listing.id));
      setReviewListingId(null);
      // decide_user_approval only touches profiles -- the embedded
      // UserApprovalsTab (Sellers/ID-checks queue) and the Home tab's queue
      // badges have their own state and never learn the seller was just
      // approved unless told to refetch.
      if (alsoVerifySeller) setReviewRefreshKey(k => k + 1);
    }
    setApprovalActioning(null);
  }

  async function rejectListing(listing, reason) {
    if (!reason) return;
    setApprovalActioning(listing.id);
    const { error } = await supabase.rpc("reject_listing", { p_listing_id: listing.id, p_reason: reason });
    if (error) { alert("Error: " + error.message); }
    else { setPendingListings(p => p.filter(l => l.id !== listing.id)); setReviewListingId(null); }
    setApprovalActioning(null);
  }

  async function saveListingNote(listing, note) {
    const { error } = await supabase.rpc("set_listing_admin_note", { p_listing_id: listing.id, p_note: note });
    if (error) { alert("Error: " + error.message); return false; }
    setPendingListings(p => p.map(l => l.id === listing.id ? { ...l, admin_notes: note.trim() || null } : l));
    return true;
  }

  // Mark a listing's uploaded documents as reviewed by the platform. Superadmin
  // only (enforced in the RPC + a protective trigger on car_listings).
  async function toggleListingDocsVerified(listing) {
    const next = !listing.docs_verified;
    const { error } = await supabase.rpc("set_listing_docs_verified", { p_listing_id: listing.id, p_verified: next });
    if (error) { alert("Error: " + error.message); return; }
    setPendingListings(p => p.map(l => l.id === listing.id ? { ...l, docs_verified: next } : l));
  }

  function fmtDate(str) {
    if (!str) return "—";
    return new Date(str).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
  }

  // Load marketplace settings when tab is first opened
  useEffect(() => {
    if (activeTab === 'marketplace' && !mktSettings && !mktLoading) {
      setMktLoading(true);
      supabase.from('marketplace_settings').select('*')
        .eq('id', MKT_ID).maybeSingle()
        .then(({ data }) => { setMktSettings(data || { ...MARKETPLACE_FALLBACK }); setMktLoading(false); });
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveMarketplaceSettings() {
    setMktSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('marketplace_settings')
      .update({ ...mktSettings, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq('id', MKT_ID);
    setMktSaving(false);
    if (!error) {
      setMktSaved(true);
      invalidateMarketplaceSettingsCache();
      setTimeout(() => setMktSaved(false), 2500);
    }
  }

  // Everything waiting on a decision, in one number. "Verify" (accounts) and
  // "Approvals" (listings) were two vaguely-named tabs holding three kinds of
  // item between them; they are now one Review queue with a type filter (P4).
  const reviewCount = pendingListings.length + pendingUsersCount;

  // ── One taxonomy: what am I doing (P1) ──────────────────────────────────────
  // The rail used to mix two. "ShiftOS Ops" and "XDrive Ops" split by PRODUCT
  // while "Security" split by FUNCTION, so the top level answered no single
  // question -- neither "which product?" nor "what am I doing?", but both at
  // once -- and every navigation was a guess. The clearest symptom: marketplace
  // SETTINGS lived under ShiftOS Ops while marketplace ANALYTICS lived under
  // XDrive Ops. Same subject, two consoles, split by a rule invisible from the
  // outside. They are one section now.
  //
  // Sections are ordered by how the day actually runs: you sit down to clear
  // the queue, not to "do XDrive".
  const NAV = [
    { id: "work", label: "Work", sub: "Your queue", badge: reviewCount, tabs: [
      { id: "home",   label: "Home" },
      { id: "review", label: "Review", badge: reviewCount },
      // Buyer-submitted listing reports. A queue you clear, so it sits with
      // Review rather than under Safety — but it is a separate queue because a
      // report is a claim about a LIVE listing, not an item awaiting approval.
      { id: "reports", label: "Reports", badge: openReportCount },
    ] },
    { id: "people", label: "People", sub: "Accounts · waitlist", tabs: [
      { id: "accounts", label: `Accounts (${accounts.length})` },
      // Waitlist stays its own destination on purpose: a waitlist row is an
      // email that never signed up. It has no profile, no plan and no actions
      // in common with an account, so folding it into the accounts table would
      // put two different objects in one list.
      { id: "waitlist", label: `Waitlist (${waitlist.length})` },
    ] },
    { id: "marketplace", label: "Marketplace", sub: "XDrive settings · analytics", tabs: [
      { id: "marketplace", label: "Settings" },
      { id: "funnel",      label: "Funnel" },
      { id: "engagement",  label: "Engagement" },
      { id: "buyers",      label: "Buyers" },
      { id: "broadcast",   label: "Broadcast" },
      { id: "platform",    label: "Volume" },
    ] },
    { id: "money", label: "Money", sub: "Plans · revenue", tabs: [
      { id: "billing", label: "Billing" },
    ] },
    { id: "safety", label: "Safety", sub: "Audit · sessions · errors", tabs: [
      { id: "activity", label: "Activity Log" },
      { id: "sessions", label: "Sessions" },
      { id: "posture",  label: "Posture" },
      { id: "errors",   label: "Errors" },
      { id: "alerts",   label: "Alerts" },
    ] },
  ];

  const currentSection = NAV.find(sec => sec.id === activeSection) || NAV[0];
  const TABS = currentSection.tabs;

  // Switching section lands on its first tab, so the strip and the body never
  // disagree about what is open.
  function switchSection(id) {
    const sec = NAV.find(n => n.id === id);
    if (!sec) return;
    setActiveSection(id);
    setActiveTab(sec.tabs[0].id);
  }

  // Jump straight from a Home queue card into the right slice of Review.
  function openReview(filter) {
    setReviewFilter(filter);
    setActiveSection("work");
    setActiveTab("review");
  }

  // One place for the child tables to write a row back into local state, so a
  // successful write shows immediately without a full reload.
  function patchAccount(id, patch) {
    setAccounts(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));
    setDealers(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));
    setSalesmen(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));
  }

  const globalResults = (() => {
    const q = globalQ.trim().toLowerCase();
    if (q.length < 2) return [];
    const hits = [];
    accounts.forEach(a => {
      if ([a.full_name, a.email, a.dealership, a.subdomain, a.slug, a.phone, a.whatsapp_number]
        .some(v => v && String(v).toLowerCase().includes(q))) {
        hits.push({
          kind: "account", id: a.id,
          title: a.dealership || a.full_name || a.email,
          sub: `${["dealer", "owner", "superadmin"].includes(a.role) ? "Dealer" : a.dealer_id ? "Salesman · under a dealer" : "Standalone seller"} · ${a.email}`,
        });
      }
    });
    pendingListings.forEach(l => {
      const name = [l.year, l.brand, l.model, l.variant].filter(Boolean).join(" ");
      if ([name, l.plate_number, l.profiles?.full_name].some(v => v && String(v).toLowerCase().includes(q))) {
        hits.push({ kind: "listing", id: l.id, title: name || "Listing", sub: `Waiting for approval · ${l.profiles?.full_name || "unknown seller"}` });
      }
    });
    waitlist.forEach(w => {
      if ([w.name, w.phone, w.referral_code].some(v => v && String(v).toLowerCase().includes(q))) {
        hits.push({ kind: "waitlist", id: w.id, title: w.name || w.phone, sub: `Waitlist #${w.position} · ${w.phone || ""}` });
      }
    });
    return hits.slice(0, 8);
  })();

  function goToResult(r) {
    setGlobalOpen(false);
    setGlobalQ("");
    if (r.kind === "account") {
      setActiveSection("people");
      setActiveTab("accounts");
      setFocusAccount(r.id);
    } else if (r.kind === "listing") {
      // Land on the car the search actually matched, not just its queue.
      openReview("listings");
      setReviewListingId(r.id);
    } else {
      setActiveSection("people");
      setActiveTab("waitlist");
    }
  }

  function daysAgo(str) {
    if (!str) return null;
    return Math.floor((Date.now() - new Date(str)) / 86400000);
  }

  // "waiting 3 days" reads as pressure in a way a bare count does not.
  function oldestWaitLabel(rows, field = "created_at") {
    if (!rows.length) return null;
    const oldest = rows.reduce((a, b) => (new Date(a[field]) < new Date(b[field]) ? a : b));
    const d = daysAgo(oldest[field]);
    if (d === null) return null;
    if (d <= 0) return "oldest today";
    return `oldest waiting ${d} day${d === 1 ? "" : "s"}`;
  }

  // ── Home ───────────────────────────────────────────────────────────────────
  // The landing page answers one question: what needs me right now. It states
  // queue depth and how long the oldest item has waited, then hands off to
  // Review. It deliberately shows NO money: MRR and plan mix belong in one
  // place (Billing), and a fourth copy of them is the problem, not the fix.
  const QueueCard = ({ label, n, sub, onClick }) => {
    const waiting = n > 0;
    return (
      <button onClick={onClick}
        style={{
          textAlign: "left", cursor: "pointer", fontFamily: "inherit", padding: "18px 20px",
          borderRadius: 12, minWidth: 0,
          background: waiting ? "rgba(220,38,38,0.06)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${waiting ? "rgba(220,38,38,0.28)" : "rgba(255,255,255,0.07)"}`,
        }}>
        <p style={{ margin: 0, fontSize: 11, color: waiting ? "#f87171" : "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{label}</p>
        <p style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 700, lineHeight: 1, color: waiting ? "#f5f5f5" : "#4b5563", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em" }}>{n}</p>
        <p style={{ margin: "6px 0 0", fontSize: 11.5, color: waiting ? "#9ca3af" : "#374151" }}>{sub}</p>
      </button>
    );
  };

  const HealthStat = ({ label, value, sub }) => (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "13px 16px", minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 10.5, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 700 }}>{label}</p>
      <p style={{ margin: "5px 0 0", fontSize: 19, fontWeight: 700, color: "#e5e7eb" }}>{value}</p>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "#4b5563" }}>{sub}</p>}
    </div>
  );

  const HomeTab = () => {
    const listingWait = oldestWaitLabel(pendingListings);
    const clear = reviewCount === 0;
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>
            {clear ? "Nothing waiting on you" : `${reviewCount} ${reviewCount === 1 ? "thing needs" : "things need"} your decision`}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
            {clear ? "Every queue is clear. New items land here and push to your phone." : "Tap a queue to open it in Review."}
          </p>
        </div>

        <div className="adm-home-queues" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 30 }}>
          <QueueCard label="Cars to approve" n={pendingListings.length}
            sub={pendingListings.length ? (listingWait || "waiting") : "none waiting"}
            onClick={() => openReview("listings")} />
          <QueueCard label="New sellers" n={pendingSignupCount}
            sub={pendingSignupCount ? "cannot reach their dashboard yet" : "none waiting"}
            onClick={() => openReview("signups")} />
          <QueueCard label="ID checks" n={pendingKycCount}
            sub={pendingKycCount ? "waiting on the Verified badge" : "none waiting"}
            onClick={() => openReview("ids")} />
        </div>

        <p style={{ margin: "0 0 10px", fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>Platform</p>
        <div className="adm-home-health" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          <HealthStat label="Dealers" value={stats.total} sub={`${stats.active} active · ${stats.trial} on trial`} />
          <HealthStat label="Salesmen" value={salesmen.length} sub={`${salesmen.filter(s => !s.dealer_id).length} standalone`} />
          <HealthStat label="Live listings" value={stats.totalListings} />
          <HealthStat label="Waitlist" value={waitlist.length} sub="not signed up yet" />
        </div>
      </div>
    );
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────
  // The console never renders under a non-superadmin session. While the isolated
  // session is being resolved we hold a neutral screen; with no valid management
  // session we render a self-contained sign-in gate (its own credentials entry,
  // separate from the public /login used by dealers/salesmen/buyers).
  if (authState !== "authed") {
    const gateWrap = {
      minHeight: "100vh", background: "#0a0a0f", color: "#f5f5f5",
      fontFamily: "system-ui, sans-serif", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
    };
    if (authState === "checking") {
      return <div style={gateWrap}><span style={{ color: "#4b5563", fontSize: 14 }}>Loading…</span></div>;
    }
    const mfaMode = !!mfaFactorId;
    return (
      <div style={gateWrap}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
        <form
          onSubmit={mfaMode ? handlePlatformMfa : handlePlatformLogin}
          style={{ width: "100%", maxWidth: 360, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "32px 28px" }}
        >
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 3 }}>
              Shift<span style={{ color: "#dc2626" }}>OS</span>
            </span>
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4, letterSpacing: 1, textTransform: "uppercase" }}>Superadmin Console</p>
          </div>

          {mfaMode ? (
            <>
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>Authentication code</label>
              <input
                autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 20, letterSpacing: 6, textAlign: "center", padding: "12px 14px", borderRadius: 9, outline: "none", fontFamily: "monospace" }}
              />
            </>
          ) : (
            <>
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>Email</label>
              <input
                type="email" autoFocus autoComplete="username" value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@company.com"
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, padding: "11px 14px", borderRadius: 9, outline: "none", marginBottom: 14 }}
              />
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, display: "block", marginBottom: 6 }}>Password</label>
              <input
                type="password" autoComplete="current-password" value={loginPw}
                onChange={(e) => setLoginPw(e.target.value)} placeholder="••••••••"
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, padding: "11px 14px", borderRadius: 9, outline: "none" }}
              />
            </>
          )}

          {authError && (
            <p style={{ color: "#f87171", fontSize: 12, marginTop: 12 }}>{authError}</p>
          )}

          <button
            type="submit" disabled={loginBusy}
            style={{ width: "100%", marginTop: 20, background: loginBusy ? "rgba(220,38,38,0.4)" : "#dc2626", color: "#fff", fontSize: 14, fontWeight: 700, padding: "12px 0", borderRadius: 9, border: "none", cursor: loginBusy ? "not-allowed" : "pointer", fontFamily: "inherit" }}
          >
            {loginBusy ? "…" : mfaMode ? "Verify" : "Sign in"}
          </button>

          <p style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#4b5563" }}>
            Management access only. This console is separate from dealer, salesman and buyer accounts.
          </p>
        </form>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; }
        .adm-root { min-height: 100vh; background: #0a0a0f; font-family: system-ui, sans-serif; color: #f5f5f5; }
        .adm-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: white; font-family: system-ui, sans-serif; font-size: 12px; padding: 5px 9px; border-radius: 6px; outline: none; }
        .adm-input:focus { border-color: rgba(220,38,38,0.5); }
        .adm-select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: white; font-family: system-ui, sans-serif; font-size: 12px; padding: 5px 9px; border-radius: 6px; outline: none; cursor: pointer; }
        .adm-select:focus { border-color: rgba(220,38,38,0.5); }
        .adm-btn { font-family: system-ui, sans-serif; font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer; border: none; transition: all 0.15s; }
        .adm-row:hover { background: rgba(255,255,255,0.015) !important; }
        .adm-expand { background: rgba(220,38,38,0.04); border-top: 1px solid rgba(220,38,38,0.08); }
        ::-webkit-scrollbar { width: 4px; height: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100; display: flex; align-items: center; justify-content: center; }
        .modal-box { background: #111318; border: 1px solid rgba(220,38,38,0.3); border-radius: 12px; padding: 28px; max-width: 360px; width: 90%; }
        .adm-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .adm-tabs::-webkit-scrollbar { display: none; }
        /* Two-console shell: left rail (desktop) + main column */
        .adm-shell { display: flex; align-items: flex-start; }
        .adm-sidebar { width: 208px; flex-shrink: 0; align-self: stretch; border-right: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.012); padding: 16px 12px; display: flex; flex-direction: column; gap: 6px; position: sticky; top: 52px; min-height: calc(100vh - 52px); }
        .adm-main { flex: 1; min-width: 0; }
        .adm-console-btn { text-align: left; background: none; border: 1px solid transparent; border-radius: 9px; padding: 11px 13px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .adm-console-btn:hover { background: rgba(255,255,255,0.03); }
        .adm-mobile-console { display: none; }
        @media (max-width: 720px) {
          .adm-sidebar { display: none; }
          .adm-mobile-console { display: flex; gap: 6px; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06);
            overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          .adm-mobile-console::-webkit-scrollbar { display: none; }
        }
        /* Mobile — make the console navigable on a phone (375px+) */
        @media (max-width: 720px) {
          .adm-header { padding: 8px 14px !important; height: auto !important; flex-wrap: wrap; gap: 10px; }
          .adm-tabs { padding: 0 8px !important; flex-wrap: nowrap !important; }
          .adm-tab { flex-shrink: 0; padding: 11px 12px !important; font-size: 12px !important; }
          .adm-content { padding: 16px 14px 64px !important; }
          .adm-globalsearch { display: none; }
          .adm-search { width: 100% !important; box-sizing: border-box; }
          .adm-toolbar { flex-direction: column; align-items: stretch !important; }
          .adm-toolbar > * { margin-left: 0 !important; width: 100%; box-sizing: border-box; }
          .adm-toolbar .adm-select { width: 100%; }
          .adm-actions { flex-direction: column; align-items: stretch !important; }
          .adm-stat4 { grid-template-columns: repeat(2, 1fr) !important; }
          .adm-approval { flex-wrap: wrap; }
          .adm-approval > button { width: 100%; }
          .adm-home-queues { grid-template-columns: 1fr !important; }
          .adm-home-health { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>

      <div className="adm-root">
        {/* Blast modal */}
        {blastModal && (() => {
          const filtered = waitlist.filter(w =>
            !waitlistSearch || w.name?.toLowerCase().includes(waitlistSearch.toLowerCase()) || w.phone?.includes(waitlistSearch)
          );
          const numbers = filtered.map(w => w.phone).join("\n");
          const copyNumbers = () => {
            navigator.clipboard.writeText(numbers);
            setBlastCopied("numbers");
            setTimeout(() => setBlastCopied(null), 2500);
          };
          const copyMsg = () => {
            navigator.clipboard.writeText(blastMsg);
            setBlastCopied("msg");
            setTimeout(() => setBlastCopied(null), 2500);
          };
          return (
            <div className="modal-overlay" onClick={() => setBlastModal(false)}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 28, width: "min(560px,95vw)", maxHeight: "90vh", overflowY: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5", marginBottom: 2 }}>📣 Blast Waitlist</p>
                    <p style={{ fontSize: 12, color: "#6b7280" }}>{filtered.length} recipients — copy numbers + message, paste into WA Business broadcast</p>
                  </div>
                  <button onClick={() => setBlastModal(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
                </div>

                {/* Message composer */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Message</p>
                  <textarea
                    value={blastMsg}
                    onChange={e => setBlastMsg(e.target.value)}
                    rows={5}
                    style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none" }}
                  />
                  <button onClick={copyMsg} style={{ marginTop: 8, fontSize: 12, padding: "6px 14px", borderRadius: 6, background: blastCopied === "msg" ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)", border: blastCopied === "msg" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)", color: blastCopied === "msg" ? "#4ade80" : "#9ca3af", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                    {blastCopied === "msg" ? "✓ Copied!" : "Copy Message"}
                  </button>
                </div>

                {/* Numbers */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Phone Numbers ({filtered.length})</p>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "10px 14px", maxHeight: 180, overflowY: "auto", marginBottom: 10 }}>
                    {filtered.map(w => (
                      <p key={w.id} style={{ margin: "2px 0", fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{w.phone}</p>
                    ))}
                  </div>
                  <button onClick={copyNumbers} style={{ width: "100%", fontSize: 13, padding: "10px 16px", borderRadius: 7, background: blastCopied === "numbers" ? "rgba(34,197,94,0.12)" : "rgba(220,38,38,0.12)", border: blastCopied === "numbers" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(220,38,38,0.3)", color: blastCopied === "numbers" ? "#4ade80" : "#f87171", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                    {blastCopied === "numbers" ? `✓ ${filtered.length} numbers copied!` : `Copy All ${filtered.length} Numbers`}
                  </button>
                  <p style={{ marginTop: 10, fontSize: 11, color: "#4b5563", lineHeight: 1.6 }}>
                    Paste numbers into <strong style={{ color: "#9ca3af" }}>WhatsApp Business → New Broadcast</strong>, then paste the message separately.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Header */}
        <header className="adm-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", height: 52, background: "rgba(8,12,20,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3 }}>
              Shift<span style={{ color: "#dc2626" }}>OS</span>{" "}
              <span style={{ color: "#374151", fontSize: 13, fontFamily: "system-ui,sans-serif", fontWeight: 500, letterSpacing: 1 }}>Superadmin</span>
            </span>
          </div>
          <div className="adm-globalsearch" style={{ position: "relative", flex: 1, maxWidth: 380, margin: "0 20px" }}>
            <input
              value={globalQ}
              onChange={e => { setGlobalQ(e.target.value); setGlobalOpen(true); }}
              onFocus={() => setGlobalOpen(true)}
              onBlur={() => setTimeout(() => setGlobalOpen(false), 150)}
              placeholder="Search accounts, listings, waitlist…"
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#e5e7eb", fontSize: 12.5, padding: "7px 11px", fontFamily: "inherit" }} />
            {globalOpen && globalQ.trim().length >= 2 && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#0b0f16", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden", boxShadow: "0 12px 34px rgba(0,0,0,0.6)", zIndex: 40 }}>
                {globalResults.length === 0 ? (
                  <p style={{ margin: 0, padding: "12px 13px", fontSize: 12, color: "#4b5563" }}>Nothing matches that.</p>
                ) : globalResults.map(r => (
                  <button key={`${r.kind}-${r.id}`} onMouseDown={() => goToResult(r)}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "9px 13px", cursor: "pointer", fontFamily: "inherit" }}>
                    <span style={{ display: "block", fontSize: 12.5, color: "#e5e7eb", fontWeight: 600 }}>{r.title}</span>
                    <span style={{ display: "block", fontSize: 11, color: "#6b7280", marginTop: 1 }}>{r.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={loadAll}
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 12, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
              ↻ Refresh
            </button>
            <button onClick={handlePlatformSignOut}
              style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#f87171", fontSize: 12, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
              Sign out
            </button>
          </div>
        </header>

        {/* Console shell: section rail (desktop) / segmented switcher (mobile) */}
        <div className="adm-shell">
          <aside className="adm-sidebar">
            <p style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, padding: "0 4px 8px" }}>Sections</p>
            {NAV.map(sec => {
              const on = activeSection === sec.id;
              return (
                <button key={sec.id} className="adm-console-btn" onClick={() => switchSection(sec.id)}
                  style={{ background: on ? "rgba(220,38,38,0.1)" : undefined, borderColor: on ? "rgba(220,38,38,0.3)" : "transparent" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: on ? "#f87171" : "#e5e7eb" }}>
                    {sec.label}
                    {sec.badge > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: "rgba(220,38,38,0.18)", border: "1px solid rgba(220,38,38,0.35)", color: "#f87171" }}>
                        {sec.badge}
                      </span>
                    )}
                  </span>
                  <span style={{ display: "block", fontSize: 10, color: "#6b7280", marginTop: 2 }}>{sec.sub}</span>
                </button>
              );
            })}
          </aside>

          <div className="adm-main">
            {/* Mobile section switcher */}
            <div className="adm-mobile-console">
              {NAV.map(sec => {
                const on = activeSection === sec.id;
                return (
                  <button key={sec.id} onClick={() => switchSection(sec.id)}
                    style={{ flex: "0 0 auto", fontSize: 12, fontWeight: 700, padding: "9px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                      background: on ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.03)",
                      border: on ? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(255,255,255,0.08)",
                      color: on ? "#f87171" : "#9ca3af" }}>
                    {sec.label}
                    {sec.badge > 0 && <span style={{ marginLeft: 5, fontSize: 10 }}>{sec.badge}</span>}
                  </button>
                );
              })}
            </div>

        {/* Tabs within the section */}
        <div className="adm-tabs" style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 28px", background: "rgba(255,255,255,0.01)" }}>
          {TABS.map(t => (
            <button key={t.id} className="adm-tab" onClick={() => setActiveTab(t.id)}
              style={{ padding: "12px 16px", background: "none", border: "none", borderBottom: activeTab === t.id ? "2px solid #dc2626" : "2px solid transparent", color: activeTab === t.id ? "#fff" : "#6b7280", fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              {t.label}
              {t.badge > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: "rgba(220,38,38,0.18)", border: "1px solid rgba(220,38,38,0.35)", color: "#f87171" }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="adm-content" style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 28px 80px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 80, color: "#4b5563" }}>Loading…</div>
          ) : activeTab === "funnel" ? (
            <FunnelTab />
          ) : activeTab === "engagement" ? (
            <EngagementTab />
          ) : activeTab === "buyers" ? (
            <BuyersTab />
          ) : activeTab === "broadcast" ? (
            <BroadcastTab dealers={dealers} salesmen={salesmen} />
          ) : activeTab === "activity" ? (
            <ActivityLogTab />
          ) : activeTab === "sessions" ? (
            <SessionsTab />
          ) : activeTab === "posture" ? (
            <PostureTab />
          ) : activeTab === "errors" ? (
            <ErrorsTab />
          ) : activeTab === "alerts" ? (
            <AlertsTab userId={meId} />
          ) : activeTab === "reports" ? (
            <ReportsTab />
          ) : activeTab === "home" ? (
            /* ── HOME ── the console opens on the work, not a directory (P3) */
            <HomeTab />
          ) : activeTab === "review" ? (
            /* ── REVIEW ── one queue, three kinds of item, filter by type (P4) */
            <div>
              <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Review</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Everything waiting on your decision — cars, new sellers, ID checks</p>
                </div>
                <button onClick={() => { loadAll(); setReviewRefreshKey(k => k + 1); }}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 12, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
                  ↻ Refresh
                </button>
              </div>

              {/* Type filter. Counts are the real queue depths, so the pills
                  double as the "how much is left" readout. */}
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
                {[
                  { id: "all", label: "All", n: reviewCount },
                  { id: "listings", label: "Cars", n: pendingListings.length },
                  { id: "signups", label: "New sellers", n: pendingSignupCount },
                  { id: "ids", label: "ID checks", n: pendingKycCount },
                ].map(f => {
                  const on = reviewFilter === f.id;
                  return (
                    <button key={f.id} onClick={() => setReviewFilter(f.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 99,
                        fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit",
                        background: on ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${on ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.08)"}`,
                        color: on ? "#f87171" : "#9ca3af",
                      }}>
                      {f.label}
                      <span style={{ fontSize: 11, fontWeight: 700, color: on ? "#f87171" : "#4b5563" }}>{f.n}</span>
                    </button>
                  );
                })}
              </div>

              {reviewCount === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#374151" }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>✓</p>
                  <p style={{ fontSize: 14, color: "#4b5563" }}>Nothing waiting. You are all clear.</p>
                </div>
              )}

              {/* Empty for THIS filter while other queues still have work. */}
              {reviewCount > 0 && (
                (reviewFilter === "listings" && pendingListings.length === 0) ||
                (reviewFilter === "signups" && pendingSignupCount === 0) ||
                (reviewFilter === "ids" && pendingKycCount === 0)
              ) && (
                <p style={{ fontSize: 13, color: "#4b5563", padding: "34px 0", textAlign: "center" }}>Nothing in this queue.</p>
              )}

              {(reviewFilter === "all" || reviewFilter === "signups" || reviewFilter === "ids") && (
                <div style={{ marginBottom: reviewFilter === "all" ? 28 : 0 }}>
                  <UserApprovalsTab
                    embedded
                    refreshKey={reviewRefreshKey}
                    kindFilter={reviewFilter === "signups" ? "signup" : reviewFilter === "ids" ? "kyc" : null}
                    onCounts={({ signups, ids }) => { setPendingSignupCount(signups); setPendingKycCount(ids); setPendingUsersCount(signups + ids); }}
                  />
                </div>
              )}

              {(reviewFilter === "all" || reviewFilter === "listings") && pendingListings.length > 0 && (
              <div>
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e5e7eb" }}>Cars waiting to go live</p>
                <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#6b7280" }}>Listings from standalone salesman accounts — they stay off the marketplace until you approve</p>
              </div>

              {/* Bulk action toolbar */}
              {pendingListings.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#9ca3af", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedListingIds.size === pendingListings.length && pendingListings.length > 0}
                      ref={el => { if (el) el.indeterminate = selectedListingIds.size > 0 && selectedListingIds.size < pendingListings.length; }}
                      onChange={e => setSelectedListingIds(e.target.checked ? new Set(pendingListings.map(l => l.id)) : new Set())}
                    />
                    {selectedListingIds.size > 0 ? `${selectedListingIds.size} selected` : "Select all"}
                  </label>
                  {selectedListingIds.size > 0 && (
                    <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                      <button
                        disabled={bulkBusy}
                        onClick={async () => {
                          setBulkBusy(true);
                          const ids = [...selectedListingIds];
                          const results = await Promise.all(ids.map(id => supabase.rpc("approve_listing", { p_listing_id: id })));
                          const okIds = ids.filter((id, i) => !results[i].error);
                          setPendingListings(p => p.filter(l => !okIds.includes(l.id)));
                          setSelectedListingIds(new Set());
                          setBulkBusy(false);
                        }}
                        style={{ fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 8, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", cursor: bulkBusy ? "not-allowed" : "pointer", opacity: bulkBusy ? 0.6 : 1 }}
                      >
                        {bulkBusy ? "…" : `✓ Approve ${selectedListingIds.size}`}
                      </button>
                      <button
                        disabled={bulkBusy}
                        onClick={() => { setBulkRejectOpen(true); setBulkRejectReason(""); }}
                        style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", cursor: "pointer" }}
                      >
                        ✕ Reject {selectedListingIds.size}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Bulk reject reason */}
              {bulkRejectOpen && (
                <div style={{ marginBottom: 14, padding: "12px 14px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 8 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#f87171", fontWeight: 600 }}>Reason for rejecting {selectedListingIds.size} listing(s) — shown to each salesman</p>
                  <textarea
                    value={bulkRejectReason}
                    onChange={e => setBulkRejectReason(e.target.value)}
                    placeholder="e.g. Incomplete details / suspected duplicates…"
                    rows={2}
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#e5e7eb", fontSize: 13, padding: "8px 10px", resize: "vertical", fontFamily: "system-ui, sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setBulkRejectOpen(false)} style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    <button
                      disabled={!bulkRejectReason.trim() || bulkBusy}
                      onClick={async () => {
                        if (!bulkRejectReason.trim()) return;
                        setBulkBusy(true);
                        const ids = [...selectedListingIds];
                        const results = await Promise.all(ids.map(id => supabase.rpc("reject_listing", { p_listing_id: id, p_reason: bulkRejectReason.trim() })));
                        const okIds = ids.filter((id, i) => !results[i].error);
                        setPendingListings(p => p.filter(l => !okIds.includes(l.id)));
                        setSelectedListingIds(new Set());
                        setBulkRejectOpen(false);
                        setBulkBusy(false);
                      }}
                      style={{ flex: 2, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 700, background: bulkRejectReason.trim() ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)", border: bulkRejectReason.trim() ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.08)", color: bulkRejectReason.trim() ? "#f87171" : "#374151", cursor: bulkRejectReason.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: bulkBusy ? 0.6 : 1 }}
                    >
                      {bulkBusy ? "Rejecting…" : `Confirm reject ${selectedListingIds.size}`}
                    </button>
                  </div>
                </div>
              )}

              {/* The whole block only renders when there are cars waiting, so the
                  "all clear" state lives once on Review, not once per type. */}
              {(
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {pendingListings.map(listing => {
                    const salesman = listing.profiles;
                    const imgs = listing.images || [];
                    const docCount = Array.isArray(listing.car_documents) ? listing.car_documents.length : 0;
                    const carName = [listing.year, listing.brand, listing.model, listing.variant].filter(Boolean).join(" ");
                    const price = listing.selling_price ? `RM ${Number(listing.selling_price).toLocaleString("en-MY")}` : "—";
                    const flags = listingFlags(listing);
                    const selected = selectedListingIds.has(listing.id);

                    return (
                      <div
                        key={listing.id}
                        onClick={() => setReviewListingId(listing.id)}
                        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}
                      >
                        {flags.length > 0 && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                            {flags.map((f, i) => (
                              <span key={i} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5,
                                background: f.sev === "high" ? "rgba(239,68,68,0.12)" : "rgba(251,191,36,0.1)",
                                border: f.sev === "high" ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(251,191,36,0.25)",
                                color: f.sev === "high" ? "#f87171" : "#fbbf24" }}>
                                {f.label}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="adm-approval" style={{ display: "flex", gap: 14, alignItems: "center" }}>
                          {/* Select — for the bulk toolbar only */}
                          <input
                            type="checkbox"
                            aria-label={`Select ${carName}`}
                            checked={selected}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setSelectedListingIds(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(listing.id); else next.delete(listing.id);
                              return next;
                            })}
                            style={{ flexShrink: 0, cursor: "pointer" }}
                          />
                          {/* Thumbnail */}
                          {imgs.length > 0 ? (
                            <img src={imgs[0]} alt="" style={{ width: 66, height: 50, objectFit: "cover", borderRadius: 7, flexShrink: 0, border: "1px solid rgba(255,255,255,0.06)" }} />
                          ) : (
                            <div style={{ width: 66, height: 50, borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#4b5563" }}>
                              no photo
                            </div>
                          )}

                          {/* Summary — enough to recognise the car, not enough to decide on */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{carName || "—"}</p>
                            <p style={{ margin: "0 0 3px", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                              {price}
                              {listing.plate_number && <span style={{ color: "#4b5563", fontWeight: 500, marginLeft: 8, fontFamily: "monospace", fontSize: 11 }}>{listing.plate_number}</span>}
                            </p>
                            <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>
                              by <span style={{ color: "#9ca3af", fontWeight: 600 }}>{salesman?.full_name || "—"}</span>
                              {salesman?.slug && <span style={{ color: "#4b5563" }}> · @{salesman.slug}</span>}
                              <span style={{ color: "#374151" }}> · {relTime(listing.created_at)}</span>
                            </p>
                            <p style={{ margin: "3px 0 0", fontSize: 10.5, color: "#4b5563" }}>
                              {imgs.length} photo{imgs.length === 1 ? "" : "s"}
                              {" · "}{docCount} document{docCount === 1 ? "" : "s"}
                              {listing.docs_verified && <span style={{ color: "#4ade80" }}> · docs verified</span>}
                              {listing.admin_notes && <span style={{ color: "#64748b" }}> · has note</span>}
                            </p>
                          </div>

                          {/* One action. The decisions live in the sheet, next to the evidence. */}
                          <button
                            onClick={e => { e.stopPropagation(); setReviewListingId(listing.id); }}
                            style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, padding: "9px 18px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb", cursor: "pointer", fontFamily: "inherit" }}
                          >
                            Review
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
              )}
            </div>
          ) : activeTab === "waitlist" ? (
            /* ── WAITLIST TAB ── */
            (() => {
              const filtered = waitlist.filter(w =>
                !waitlistSearch ||
                w.name?.toLowerCase().includes(waitlistSearch.toLowerCase()) ||
                w.phone?.includes(waitlistSearch) ||
                w.referral_code?.includes(waitlistSearch)
              );
              const founding = waitlist.filter(w => w.founding_member).length;
              const referred = waitlist.filter(w => w.referred_by).length;
              return (
                <>
                  {/* Stats strip */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
                    {[
                      { label: "Total on Waitlist", value: waitlist.length, color: "#f5f5f5" },
                      { label: "Founding Members", value: founding, color: "#fbbf24" },
                      { label: "Via Referral", value: referred, color: "#4ade80" },
                      { label: "Referral Rate", value: waitlist.length > 0 ? `${Math.round((referred/waitlist.length)*100)}%` : "—", color: "#60a5fa" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "16px 18px" }}>
                        <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</p>
                        <p style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em" }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Toolbar */}
                  <div className="adm-toolbar" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                    <input
                      value={waitlistSearch} onChange={e => setWaitlistSearch(e.target.value)}
                      placeholder="Search name, phone, code…" className="adm-input adm-search" style={{ width: 260 }}
                    />
                    <span style={{ fontSize: 12, color: "#4b5563" }}>{filtered.length} shown</span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => {
                          const csv = ["position,name,phone,referral_code,referred_by,founding_member,created_at",
                            ...filtered.map(w => [w.position, `"${w.name}"`, w.phone, w.referral_code, w.referred_by||"", w.founding_member, w.created_at].join(","))
                          ].join("\n");
                          navigator.clipboard.writeText(csv);
                        }}
                        style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                        Copy CSV
                      </button>
                      <button
                        onClick={() => {
                          const vcf = filtered.map(w =>
                            `BEGIN:VCARD\nVERSION:3.0\nFN:${w.name} (ShiftOS #${w.position})\nTEL;TYPE=CELL:+${w.phone.replace(/^\+/, "")}\nEND:VCARD`
                          ).join("\n");
                          const blob = new Blob([vcf], { type: "text/vcard" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "shiftos-waitlist.vcf";
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                        Download Contacts (.vcf)
                      </button>
                      <button
                        onClick={() => setBlastModal(true)}
                        style={{ fontSize: 12, padding: "6px 16px", borderRadius: 6, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                        📣 Blast Waitlist
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: "#374151", marginBottom: 14 }}>
                    💡 Import .vcf into phone contacts → WA Business → New Broadcast → select all ShiftOS contacts
                  </p>

                  {/* Table */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            {["#", "Name", "Phone", "Referral Code", "Referred By", "Status", "Joined"].map(h => (
                              <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((w, i) => (
                            <tr key={w.id} className="adm-row" style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                              <td style={{ padding: "11px 14px", color: "#6b7280", fontWeight: 700 }}>#{w.position}</td>
                              <td style={{ padding: "11px 14px", color: "#f5f5f5", fontWeight: 600 }}>
                                {w.name}
                                {w.founding_member && (
                                  <span style={{ marginLeft: 7, fontSize: 9, padding: "1px 6px", borderRadius: 99, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", fontWeight: 700 }}>FOUNDING</span>
                                )}
                              </td>
                              <td style={{ padding: "11px 14px" }}>
                                <a href={`https://wa.me/${w.phone}`} target="_blank" rel="noreferrer"
                                  style={{ color: "#4ade80", textDecoration: "none", fontSize: 12, fontFamily: "monospace" }}>
                                  {w.phone}
                                </a>
                              </td>
                              <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>{w.referral_code}</td>
                              <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 12, color: w.referred_by ? "#60a5fa" : "#374151" }}>{w.referred_by || "—"}</td>
                              <td style={{ padding: "11px 14px" }}>
                                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: w.founding_member ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${w.founding_member ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.08)"}`, color: w.founding_member ? "#fbbf24" : "#6b7280", fontWeight: 700 }}>
                                  {w.founding_member ? "Founding" : "Waitlist"}
                                </span>
                              </td>
                              <td style={{ padding: "11px 14px", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(w.created_at)}</td>
                            </tr>
                          ))}
                          {filtered.length === 0 && (
                            <tr><td colSpan={7} style={{ padding: "40px 14px", textAlign: "center", color: "#4b5563" }}>No entries found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()
          ) : activeTab === "platform" ? (
            <>
              <div style={{ marginBottom: 18 }}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Volume</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Volume across the whole platform. Revenue and subscription mix live in Billing.</p>
              </div>
              {/* The dealer / trial / expired / MRR cards and the subscription
                  breakdown that used to sit here were the same figures Billing
                  states, and the third copy of them (P2). Removed, not moved. */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                <StatCard label="Total Listings" value={stats.totalListings.toLocaleString()} />
                <StatCard label="Total Enquiries" value={stats.totalEnquiries.toLocaleString()} />
                <StatCard label="Dealers" value={stats.total} sub="mix and revenue in Billing" />
                <StatCard label="Salesmen" value={salesmen.length} sub={`${salesmen.filter(s => !s.dealer_id).length} standalone`} />
              </div>
            </>

          ) : activeTab === "accounts" ? (
            /* ── ACCOUNTS ── one table for dealers and salesmen (P5), with the
               account record behind a row click (P6). Replaces the separate
               Dealers and Salesmen tabs, their two search boxes and their two
               different standards of what you were allowed to do to an account. */
            <AccountsTab
              accounts={accounts}
              stats={accountStats}
              loading={loading}
              error={actionError}
              setError={setActionError}
              onRefresh={loadAll}
              onPatch={patchAccount}
              focusId={focusAccount}
              onFocusHandled={() => setFocusAccount(null)}
            />


          ) : activeTab === "marketplace" ? (
            /* ── MARKETPLACE TAB ── */
            <div style={{ maxWidth: 760 }}>
              <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>Marketplace Settings</p>
                  <p style={{ fontSize: 12, color: "#6b7280" }}>Controls what appears on xdrive.my — changes go live immediately after saving.</p>
                </div>
                <button
                  onClick={saveMarketplaceSettings}
                  disabled={mktSaving || !mktSettings}
                  className="adm-btn"
                  style={{ fontSize: 13, padding: "9px 22px", background: mktSaved ? "rgba(34,197,94,0.15)" : "rgba(220,38,38,0.15)", border: `1px solid ${mktSaved ? "rgba(34,197,94,0.35)" : "rgba(220,38,38,0.35)"}`, color: mktSaved ? "#4ade80" : "#f87171", opacity: mktSaving || !mktSettings ? 0.6 : 1, cursor: mktSaving || !mktSettings ? "not-allowed" : "pointer" }}>
                  {mktSaved ? "✓ Saved" : mktSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>

              {mktLoading || !mktSettings ? (
                <div style={{ textAlign: "center", padding: 60, color: "#4b5563" }}>Loading settings…</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Branding */}
                  <MktSection label="Branding">
                    <MktField label="Brand Tagline" hint="Shown in footer brand column">
                      <textarea
                        value={mktSettings.brand_tagline || ""}
                        onChange={e => setMktSettings(s => ({ ...s, brand_tagline: e.target.value }))}
                        rows={3}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240, resize: "vertical", lineHeight: 1.5 }}
                      />
                    </MktField>
                  </MktSection>

                  {/* Support Contacts */}
                  <MktSection label="Support Contacts">
                    <MktField label="Support Email">
                      <input
                        type="email"
                        value={mktSettings.support_email || ""}
                        onChange={e => setMktSettings(s => ({ ...s, support_email: e.target.value }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                      />
                    </MktField>
                    <MktField label="WhatsApp Number" hint="Digits only, no + sign (e.g. 601111521742)">
                      <input
                        type="text"
                        value={mktSettings.support_whatsapp || ""}
                        onChange={e => setMktSettings(s => ({ ...s, support_whatsapp: e.target.value.replace(/\D/g, "") }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                        placeholder="601111521742"
                      />
                    </MktField>
                    <MktField label="Phone Display Text" hint="Human-readable format shown in header/footer">
                      <input
                        type="text"
                        value={mktSettings.support_phone || ""}
                        onChange={e => setMktSettings(s => ({ ...s, support_phone: e.target.value }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                        placeholder="+60 11-1152 1742"
                      />
                    </MktField>
                  </MktSection>

                  {/* Social Links */}
                  <MktSection label="Social Links">
                    <MktField label="Instagram URL">
                      <input
                        type="url"
                        value={mktSettings.social_instagram || ""}
                        onChange={e => setMktSettings(s => ({ ...s, social_instagram: e.target.value }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                        placeholder="https://instagram.com/xdrive.my"
                      />
                    </MktField>
                    <MktField label="Facebook URL">
                      <input
                        type="url"
                        value={mktSettings.social_facebook || ""}
                        onChange={e => setMktSettings(s => ({ ...s, social_facebook: e.target.value }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                        placeholder="https://facebook.com/xdrive.my"
                      />
                    </MktField>
                    <MktField label="TikTok URL" hint="Leave blank to hide the TikTok icon">
                      <input
                        type="url"
                        value={mktSettings.social_tiktok || ""}
                        onChange={e => setMktSettings(s => ({ ...s, social_tiktok: e.target.value || null }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                        placeholder="https://tiktok.com/@xdrive.my"
                      />
                    </MktField>
                  </MktSection>

                  {/* Trust Bar */}
                  <MktSection label="Trust Bar" hint="4 badges shown below the header on xdrive.my">
                    {(mktSettings.trust_badges || []).map((badge, i) => (
                      <MktField key={i} label={`Badge ${i + 1}`}>
                        <input
                          type="text"
                          value={badge.text || ""}
                          onChange={e => {
                            const badges = [...(mktSettings.trust_badges || [])];
                            badges[i] = { ...badges[i], text: e.target.value };
                            setMktSettings(s => ({ ...s, trust_badges: badges }));
                          }}
                          className="adm-input"
                          style={{ flex: 1, minWidth: 240 }}
                        />
                      </MktField>
                    ))}
                  </MktSection>

                  {/* Footer */}
                  <MktSection label="Footer" hint="Use {year} as a placeholder for the current year">
                    <MktField label="Copyright Text">
                      <input
                        type="text"
                        value={mktSettings.footer_copyright || ""}
                        onChange={e => setMktSettings(s => ({ ...s, footer_copyright: e.target.value }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                        placeholder="© {year} XDrive Malaysia Sdn Bhd. All rights reserved."
                      />
                    </MktField>
                  </MktSection>

                  {/* ShiftOS DMS Band */}
                  <MktSection label="ShiftOS DMS Band" hint="The dark promotional band at the bottom of the footer">
                    <MktToggle
                      label="Show ShiftOS DMS promotional band in footer"
                      value={!!mktSettings.shiftos_band_enabled}
                      onChange={val => setMktSettings(s => ({ ...s, shiftos_band_enabled: val }))}
                    />
                  </MktSection>

                  {/* Announcement Bar */}
                  <MktSection label="Announcement Bar" hint="Dismissible red banner shown above the navigation on xdrive.my">
                    <MktToggle
                      label="Show announcement bar"
                      value={!!mktSettings.announcement_enabled}
                      onChange={val => setMktSettings(s => ({ ...s, announcement_enabled: val }))}
                    />
                    <MktField label="Announcement Text">
                      <input
                        type="text"
                        value={mktSettings.announcement_text || ""}
                        onChange={e => setMktSettings(s => ({ ...s, announcement_text: e.target.value || null }))}
                        disabled={!mktSettings.announcement_enabled}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240, opacity: mktSettings.announcement_enabled ? 1 : 0.4 }}
                        placeholder="e.g. Ramadan sale — all listings verified this week"
                      />
                    </MktField>
                    <MktField label="Link (optional)" hint="Makes the bar clickable — leave blank for no link">
                      <input
                        type="url"
                        value={mktSettings.announcement_link || ""}
                        onChange={e => setMktSettings(s => ({ ...s, announcement_link: e.target.value || null }))}
                        disabled={!mktSettings.announcement_enabled}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240, opacity: mktSettings.announcement_enabled ? 1 : 0.4 }}
                        placeholder="https://xdrive.my/…"
                      />
                    </MktField>
                  </MktSection>

                  {/* Bottom Save */}
                  <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
                    <button
                      onClick={saveMarketplaceSettings}
                      disabled={mktSaving}
                      className="adm-btn"
                      style={{ fontSize: 13, padding: "9px 28px", background: mktSaved ? "rgba(34,197,94,0.15)" : "rgba(220,38,38,0.15)", border: `1px solid ${mktSaved ? "rgba(34,197,94,0.35)" : "rgba(220,38,38,0.35)"}`, color: mktSaved ? "#4ade80" : "#f87171", opacity: mktSaving ? 0.6 : 1, cursor: mktSaving ? "not-allowed" : "pointer" }}>
                      {mktSaved ? "✓ Saved" : mktSaving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>

                </div>
              )}
            </div>

          ) : activeTab === "billing" ? (
            /* ── BILLING TAB ── */
            <BillingTab dealers={dealers} dealerStats={accountStats} />
          ) : null}
        </div>
          </div>
        </div>
      </div>

      {/* Full-evidence review sheet. Rendered from the live pendingListings row
          so a docs-verified tick or a saved note is reflected immediately. */}
      <ListingReviewModal
        listing={pendingListings.find(l => l.id === reviewListingId) || null}
        busy={approvalActioning === reviewListingId}
        onClose={() => setReviewListingId(null)}
        onApprove={approveListing}
        onReject={rejectListing}
        onToggleDocsVerified={toggleListingDocsVerified}
        onSaveNote={saveListingNote}
      />
    </>
  );
}
