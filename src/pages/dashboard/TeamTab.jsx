import { useEffect, useState, useRef, useMemo } from "react";
import { useModalHistory } from "../../hooks/useModalHistory";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { logActivity } from "../../utils/activityLog";
import { supabase } from "../../supabaseClient";
import { redactProfileForCache } from "../../utils/panelCache";
import { usePermissions } from "../../hooks/usePermissions";
import { ROLE_ENABLED_KEY } from "../../lib/permissions";
import { liveChannel } from "../../lib/liveChannel";
import { T, SERVER_URL } from "./shared";
import { isValidMyPhone, MY_PHONE_ERROR } from "../../lib/phone";
import PhoneInput from "../../components/ui/PhoneInput";
import { color, border, radius, font, premiumLight as PL } from "../../theme/tokens";
import TeamScoreboard, { StatusWord, Avatar as PersonAvatar, personWord, fmtRM } from "./TeamScoreboard";
import SalesmanHealthSheet from "../../components/team/SalesmanHealthSheet";
import { sellerTotals } from "../../utils/ownerMoney";
import { useTeamScores } from "../../hooks/useTeamScores";
import { usePersistentState } from "../../hooks/usePersistentState";
import { useCarMoney } from "../../hooks/useCarMoney";
import { Car, PlusCircle, Trash2, X, Copy, Check, UserPlus, ToggleLeft, ToggleRight, Send, ChevronRight, Phone, Settings, Lock, AlertTriangle, Mail } from "lucide-react";

function lastActiveText(ts) {
  if (!ts) return 'No activity yet';
  const mins = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  const d = Math.floor(mins / 1440);
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d}d ago`;
  return '30d+ ago';
}

// One wording for every refusal the invites / create-salesman functions send back.
function staffAddError(data) {
  switch (data?.error) {
    case "email_taken": return "That email already has an account.";
    case "seat_cap": return `Seat limit reached (${data.current}/${data.cap}). Upgrade your plan to add more team members.`;
    case "not_allowed": return "The owner has not let managers add staff.";
    case "manager_role_limit": return "Managers can add salesmen and admins only.";
    case "manager_role_off": return "This dealership has no manager role. Switch it on in Settings > Team first.";
    case "email_failed": return "The setup email could not be sent, so nothing was created. Try again.";
    default: return data?.message || data?.error || "Could not create the account.";
  }
}

export function TeamTab({ managerDealership, dealerId, profile }) {
  // Who may add staff: the owner always; a manager only with the owner's "Add staff" switch, and
  // then only salesmen and admins, with no password (they set their own from the email). The
  // invites / create-salesman functions enforce the same rules on the server.
  const isOwnerTeam = ["dealer", "owner", "superadmin"].includes(profile?.role);
  const { can: teamCan } = usePermissions(profile);
  const canAddStaff = isOwnerTeam || (profile?.role === "manager" && teamCan("add_staff"));
  // How each salesman is doing: the database's one judgement (_team_health). Feeds the table at
  // the top AND the status word on each card, so they can never disagree.
  const { scores: teamScores, byId: scoreById, loading: scoresLoading } = useTeamScores(dealerId);
  const showTeamMoney = teamCan("view_gross");
  // Persisted (IC material stripped) so the roster paints instantly; the
  // fetch below still replaces it. "loadingTeam" = nothing to show yet.
  const [salespeople, setSalespeople, teamCached] = usePersistentState(
    dealerId ? `team:${dealerId}` : null, [], { redact: (rows) => (rows || []).map(redactProfileForCache) },
  );
  const [teamFetching, setLoadingTeam] = useState(true);
  const loadingTeam = teamFetching && !teamCached;
  const [teamError, setTeamError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  useModalHistory(showAddForm, () => setShowAddForm(false), { isDirty: () => true });
  // "Do you have a manager?" = No (Settings > Team) takes Manager out of the add-staff choices.
  const [managerOn, setManagerOn] = useState(true);
  useEffect(() => {
    if (!dealerId) return;
    supabase.from('role_permissions').select('permissions').eq('dealer_id', dealerId).eq('role', 'manager').maybeSingle()
      .then(({ data }) => setManagerOn(data?.permissions?.[ROLE_ENABLED_KEY] !== false));
  }, [dealerId]);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [copiedPw, setCopiedPw] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  useModalHistory(!!deleteConfirmId, () => setDeleteConfirmId(null));
  const [newRole, setNewRole] = useState("salesman");
  const [openPersonId, setOpenPersonId] = useState(null); // whose sheet is open (Team > People)
  const [msgOpen, setMsgOpen] = useState(false);           // Message pop-up
  useModalHistory(msgOpen, () => setMsgOpen(false));
  useEffect(() => {
    if (!msgOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [msgOpen]);
  const [msgTarget, setMsgTarget] = useState('all');
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgDone, setMsgDone] = useState(false);
  const msgDoneTimer = useRef(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [slug, setSlug] = useState("");
  const [tempPw, setTempPw] = useState("");
  const [createdAccount, setCreatedAccount] = useState(null); // one-time password modal
  useModalHistory(!!createdAccount, () => setCreatedAccount(null));
  const [resendingId, setResendingId] = useState(null); // salesman id whose setup email is resending
  const [analyticsMap, setAnalyticsMap] = useState({});
  const [soldMap, setSoldMap] = useState({});
  const [lastActivityMap, setLastActivityMap] = useState({});
  const [activityCountMap, setActivityCountMap] = useState({});
  const [commissionApproveTarget, setCommissionApproveTarget] = useState(null); // salesman id
  useModalHistory(!!commissionApproveTarget, () => setCommissionApproveTarget(null));
  const [commissionPayTarget, setCommissionPayTarget] = useState(null);
  useModalHistory(!!commissionPayTarget, () => setCommissionPayTarget(null));
  const [commissionWorking, setCommissionWorking] = useState(false);
  const [assignedMap, setAssignedMap] = useState({}); // salesmanId -> [cars locked to them]
  const [openCars, setOpenCars] = useState([]);        // unassigned, unsold cars (assignable pool)
  const [assignPickerFor, setAssignPickerFor] = useState(null); // salesman id whose picker is open
  const [assignWorking, setAssignWorking] = useState(null);     // listing id mid-mutation

  const fetchAnalytics = async () => {
    if (!dealerId) return;
    const { data } = await supabase.rpc("get_dealer_slug_analytics", { p_dealer_id: dealerId, p_days: 30 }) // 30: the table says "last 30 days" (default is 90);
    if (!data) return;
    const map = {};
    data.forEach(({ slug, clicks, whatsapp }) => {
      if (slug) map[slug] = { clicks: Number(clicks) || 0, whatsapp: Number(whatsapp) || 0 };
    });
    setAnalyticsMap(map);
  };

  const fetchSoldPerSalesman = async () => {
    if (!dealerId) return;
    const { data, error } = await supabase
      .from("car_listings")
      // Cost comes from the stock record: a dealer car's listing holds no cost
      // (20261109f, batch 4 — salesmen can read listings, not stock).
      .select("assigned_to, commission_amount, commission_status, sold_price, selling_price, included_services_cost, stock_units(purchase_price, recon_cost)")
      .eq("dealer_id", dealerId)
      .eq("status", "sold")
      .not("assigned_to", "is", null);
    // This select once named a column that does not exist ("price"); PostgREST
    // rejected the whole query and every salesman showed 0 sold / RM0. Say so.
    if (error) { console.error("[TeamTab] sold per salesman:", error.message); return; }
    if (!data) return;
    const map = {};
    data.forEach((row) => {
      const { assigned_to, commission_amount, commission_status } = row;
      if (!map[assigned_to]) map[assigned_to] = { sold: 0, commission: 0, pending: 0, approved: 0, paid: 0, gross: 0 };
      map[assigned_to].sold += 1;
      const amt = Number(commission_amount) || 0;
      map[assigned_to].commission += amt;
      const cs = commission_status || 'pending';
      map[assigned_to][cs] = (map[assigned_to][cs] || 0) + amt;
      // Front gross per unit: sale - cost - recon - included services - commission.
      // Only counted when the stock record has a cost, so units with zero cost
      // don't show "full sale = profit".
      const su = Array.isArray(row.stock_units) ? row.stock_units[0] : row.stock_units;
      const cost = Number(su?.purchase_price) || 0;
      if (cost > 0) {
        const sale = Number(row.sold_price ?? row.selling_price) || 0;
        map[assigned_to].gross += sale - cost - (Number(su?.recon_cost) || 0) - (Number(row.included_services_cost) || 0) - amt;
      }
    });
    setSoldMap(map);
  };

  // Real activity per team member. This read activity_log alone, which only
  // THIS dashboard writes — nothing a salesman does lands there, so every
  // salesman older than 30 days showed "Inactive 30d+" however hard they worked.
  // get_team_activity also counts lead_activities (stage moves, calls,
  // WhatsApps, notes, claims) and seller chat replies. Counts only. Used for the NON-salesman
  // roles' cards; salesmen are judged by _team_health (useTeamScores).
  const fetchLastActivity = async () => {
    if (!dealerId) return;
    const { data, error } = await supabase.rpc('get_team_activity', { p_dealer_id: dealerId });
    if (error) { console.error('[TeamTab] team activity:', error.message); return; }
    const map = {};
    const counts = {};
    (data || []).forEach((r) => {
      map[r.user_id] = r.last_active_at;
      counts[r.user_id] = r.actions_30d || 0;
    });
    setLastActivityMap(map);
    setActivityCountMap(counts);
  };

  // Assigned-cars (exclusivity lock) per salesman. Sold units keep assigned_to as
  // the closer, but "responsibility" only means live inventory, so sold is excluded.
  const fetchAssignedCars = async () => {
    if (!dealerId) return;
    const { data } = await supabase
      .from("car_listings")
      .select("id, brand, model, year, status, assigned_to")
      .eq("dealer_id", dealerId)
      .neq("status", "sold");
    if (!data) return;
    const map = {};
    const open = [];
    data.forEach((c) => {
      if (c.assigned_to) (map[c.assigned_to] ||= []).push(c);
      else open.push(c);
    });
    const byName = (a, b) =>
      (a.brand || "").localeCompare(b.brand || "") || (a.model || "").localeCompare(b.model || "");
    Object.values(map).forEach((arr) => arr.sort(byName));
    open.sort(byName);
    setAssignedMap(map);
    setOpenCars(open);
  };

  // Mirror of the dealer-dash handleAssign exclusivity rule: locking a car to a rep
  // evicts every OTHER salesman's salesman_listings feature of it (retroactive lock).
  const handleAssignCar = async (listingId, salesmanId, name) => {
    setAssignWorking(listingId);
    const car = openCars.find((c) => c.id === listingId);
    // A refused write is "0 rows, no error": check a row came back before evicting anyone.
    const { data: saved, error } = await supabase
      .from("car_listings")
      .update({ assigned_to: salesmanId })
      .eq("id", listingId)
      .select("id");
    if (error || !saved?.length) toast.error("Could not assign. Try again.");
    else {
      await supabase.from("salesman_listings").delete()
        .eq("listing_id", listingId).neq("salesman_id", salesmanId);
      logActivity({ dealerId, actor: profile, tableName: 'car_listings', recordId: listingId, action: 'assigned', summary: `Assigned to ${name} — ${car?.brand || ''} ${car?.model || ''} ${car?.year || ''}`.trim(), fieldChanges: { assigned_to: { to: name } } });
      await fetchAssignedCars();
    }
    setAssignWorking(null);
    setAssignPickerFor(null);
  };

  const handleUnassignCar = async (listingId) => {
    setAssignWorking(listingId);
    const car = Object.values(assignedMap).flat().find((c) => c.id === listingId);
    const { data: saved, error } = await supabase
      .from("car_listings")
      .update({ assigned_to: null })
      .eq("id", listingId)
      .select("id");
    if (error || !saved?.length) toast.error("Could not unassign. Try again.");
    else {
      logActivity({ dealerId, actor: profile, tableName: 'car_listings', recordId: listingId, action: 'unassigned', summary: `Unassigned — ${car?.brand || ''} ${car?.model || ''} ${car?.year || ''}`.trim() });
      await fetchAssignedCars();
    }
    setAssignWorking(null);
  };

  const handleApproveCommission = async (salesmanId) => {
    setCommissionWorking(true);
    const { error } = await supabase
      .from('car_listings')
      .update({ commission_status: 'approved' })
      .eq('dealer_id', dealerId)
      .eq('assigned_to', salesmanId)
      .eq('status', 'sold')
      .eq('commission_status', 'pending');
    if (!error) {
      const s = salespeople.find(x => x.id === salesmanId);
      logActivity({ dealerId, actor: profile, tableName: 'car_listings', recordId: salesmanId, action: 'commission_approved', summary: `Commission payout approved for ${s?.full_name || salesmanId} — RM ${(soldMap[salesmanId]?.pending || 0).toLocaleString()}` });
      await fetchSoldPerSalesman();
    }
    setCommissionApproveTarget(null);
    setCommissionWorking(false);
  };

  const handleMarkCommissionPaid = async (salesmanId) => {
    setCommissionWorking(true);
    const { error } = await supabase
      .from('car_listings')
      .update({ commission_status: 'paid' })
      .eq('dealer_id', dealerId)
      .eq('assigned_to', salesmanId)
      .eq('status', 'sold')
      .eq('commission_status', 'approved');
    if (!error) {
      const s = salespeople.find(x => x.id === salesmanId);
      logActivity({ dealerId, actor: profile, tableName: 'car_listings', recordId: salesmanId, action: 'commission_paid', summary: `Commission marked as paid for ${s?.full_name || salesmanId} — RM ${(soldMap[salesmanId]?.approved || 0).toLocaleString()}` });
      await fetchSoldPerSalesman();
    }
    setCommissionPayTarget(null);
    setCommissionWorking(false);
  };

  useEffect(() => {
    fetchTeam();
    fetchAnalytics();
    fetchSoldPerSalesman();
    fetchLastActivity();
    fetchAssignedCars();
  }, [managerDealership, dealerId]); // dealerId must be here — fetchSold* guard on it


  const fetchTeam = async () => {
    if (!managerDealership) {
      setSalespeople([]);
      setTeamError("Dealership profile missing.");
      setLoadingTeam(false);
      return;
    }
    setLoadingTeam(true);
    setTeamError("");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["salesman","manager","accountant","fi_officer","admin"])
      .eq("dealer_id", dealerId)
      .order("created_at", { ascending: false });
    if (error) {
      setTeamError(error.message || "Failed to load team.");
      // Keep the cached roster on screen; the error line explains it is stale.
    } else setSalespeople(data || []);
    setLoadingTeam(false);
  };

  const slugify = (v) =>
    v
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  const handleNameChange = (v) => {
    setName(v);
    setSlug(slugify(v.trim().split(/\s+/)[0]));
  };
  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setSlug("");
    setTempPw("");
    setAddError("");
    setAddSuccess("");
    setNewRole("salesman");
  };

  const handleAdd = async () => {
    setAddError("");
    if (!canAddStaff) { setAddError("Only the owner can add staff."); return; }
    if (!isOwnerTeam && !["salesman", "admin"].includes(newRole)) { setAddError("You can add salesmen and admins only."); return; }
    const n = name.trim(),
      e = email.trim().toLowerCase(),
      s = slug.trim(),
      p = phone.trim() || null;
    if (!managerDealership) {
      setAddError("Dealership required.");
      return;
    }
    const isSalesman = newRole === "salesman";
    if (!n || !e || !s || (!isSalesman && isOwnerTeam && !tempPw)) {
      setAddError("All fields required.");
      return;
    }
    if (p && !isValidMyPhone(p)) {
      setAddError(MY_PHONE_ERROR);
      return;
    }
    if (!isSalesman && isOwnerTeam && tempPw.length < 8) {
      setAddError("Password min 8 chars.");
      return;
    }
    if (!/^[a-z0-9]+$/.test(s)) {
      setAddError("Slug: lowercase + numbers only.");
      return;
    }
    setAddLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Check seat cap before creating
      const { data: capCheck } = await supabase.rpc('check_seat_cap', { p_dealer_id: dealerId });
      if (capCheck && !capCheck.allowed) {
        setAddError(`Seat limit reached (${capCheck.current}/${capCheck.cap}). Upgrade your plan to add more team members.`);
        setAddLoading(false);
        return;
      }

      if (isSalesman) {
        // Auth-first salesman creation via edge function
        const res = await fetch(`${SERVER_URL}/create-salesman`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: e,
            full_name: n,
            phone: p,
            slug: s,
            dealer_id: dealerId,
            plan: "salesman_full",
            link: "set_password",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAddError(staffAddError(data));
          setAddLoading(false);
          return;
        }
        setShowAddForm(false);
        setCreatedAccount({ full_name: n, email: e, temp_password: data.temp_password, email_sent: data.email_sent, role: 'salesman' });
        await fetchTeam();
        resetForm();
      } else {
        // Non-salesman roles use existing invites function
        const res = await fetch(`${SERVER_URL}/invites`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            full_name: n,
            email: e,
            phone: p,
            dealership: managerDealership,
            dealer_id: dealerId,
            slug: s,
            password: isOwnerTeam ? tempPw : undefined,
            role: newRole,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAddError(staffAddError(data));
          setAddLoading(false);
          return;
        }
        setShowAddForm(false);
        // Same confirmation modal as salesman: shows "email sent" when the
        // invites function emailed a setup link, else the temp password to relay.
        setCreatedAccount({ full_name: n, email: e, temp_password: data.temp_password, email_sent: data.email_sent, role: newRole });
        setSalespeople((prev) => [data.invite, ...prev]);
        resetForm();
      }
    } catch {
      setAddError("Server unreachable.");
    }
    setAddLoading(false);
  };

  const copyLink = (s) => {
    navigator.clipboard.writeText(
      `${window.location.origin}/cars?ref=${s.slug}`,
    );
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const toggleActive = async (s) => {
    // Switching staff on or off is the owner's (owner-only list, Settings > Team).
    if (!["dealer", "owner", "superadmin"].includes(profile?.role)) { toast.error("Only the owner can do this."); return; }
    setTogglingId(s.id);
    // Through dealer_set_staff_active (migration 20261117a): profiles has no UPDATE rule for
    // the dealer, so a direct update changed 0 rows, and a switch back ON is refused by the
    // escalation guard unless that function asks for it (DASH-TEST 3).
    const next = s.is_active === false;
    const { data, error } = await supabase.rpc("dealer_set_staff_active", { p_staff: s.id, p_active: next });
    if (error) {
      const m = String(error.message || "");
      toast.error(error.code === "PGRST202" ? "Switching staff off goes live with tonight's update. Try again tomorrow."
        : m.includes("platform_suspended") ? "Drevo has suspended this account. Contact Drevo support."
        : m.includes("forbidden") ? "Only the owner can do this."
        : "Could not save. Try again.");
    } else {
      const saved = data?.is_active ?? next;
      setSalespeople((p) => p.map((x) => (x.id === s.id ? { ...x, is_active: saved } : x)));
      toast.success(saved ? `${s.full_name || "They"} can sign in again.` : `${s.full_name || "They"} can no longer open the dashboard.`);
    }
    setTogglingId(null);
  };
  const deleteSalesman = async (id) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`${SERVER_URL}/invites/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) setSalespeople((p) => p.filter((x) => x.id !== id));
    setDeleteConfirmId(null);
  };
  // Re-send the account-setup email to a salesman who hasn't finished onboarding.
  // The recovery link in the original email expires, so this regenerates a fresh
  // one via create-salesman's resend_setup action (no new account is created).
  const resendSetup = async (s) => {
    setResendingId(s.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SERVER_URL}/create-salesman`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: "resend_setup", email: s.email, link: "set_password" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.email_sent) toast.success(`Setup email resent to ${s.email}`);
      else if (res.ok) toast.error("Couldn't send the email — check the email address or try again.");
      else toast.error(data.error === "not_found" ? "Account not found." : "Resend failed.");
    } catch {
      toast.error("Server unreachable. Try again.");
    }
    setResendingId(null);
  };

  // A car sold, assigned or unassigned anywhere in the dealership refreshes the commission and
  // locked-car lists live (the all-time "cars sold" count that also lived here went with its tile).
  useEffect(() => {
    if (!managerDealership || !dealerId) return undefined;
    const ch = liveChannel(supabase, "team_sold")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "car_listings", filter: `dealer_id=eq.${dealerId}` },
        () => { fetchSoldPerSalesman(); fetchAssignedCars(); },
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [managerDealership, dealerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Team > People, 2026-11-16 design pass ──────────────────────────────────────────────
  const STAFF_ROLE_LABEL = { manager: 'Manager', admin: 'Admin', accountant: 'Accountant', fi_officer: 'F&I officer' };
  const teamSalesmen = salespeople.filter((p) => p.role === 'salesman');
  const teamOthers = salespeople.filter((p) => p.role !== 'salesman');
  const teamNeedLook = teamSalesmen.filter((p) => !p.setup_complete
    || (p.is_active !== false && (scoreById[p.id]?.issues || []).length > 0)).length;
  // Profit per salesman = Overview's engine grouped by seller, last 30 days, only with the money switch.
  const { money: teamMoney } = useCarMoney(showTeamMoney ? dealerId : null);
  const teamProfitBy = useMemo(() => (showTeamMoney && teamMoney
    ? sellerTotals(teamMoney.rows, Date.now() - 30 * 86400000, Date.now() + 1) : null), [showTeamMoney, teamMoney]);
  const openPerson = openPersonId ? salespeople.find((p) => p.id === openPersonId) || null : null;
  const isOwnerTeamRole = ["dealer", "owner", "superadmin"].includes(profile?.role);
  const canPayCommission = isOwnerTeamRole || profile?.role === 'manager';
  const canAssignCars = ['owner', 'dealer', 'superadmin', 'manager'].includes(profile?.role);
  // A tool that opens a confirm closes the sheet first (overlay rule 3).
  const closeAndRun = (fn) => () => { setOpenPersonId(null); fn(); };
  const TOOL = { background: PL.card, borderRadius: 16, boxShadow: PL.shadow, padding: '12px 14px' };
  const MICRO = { fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: PL.textMuted, fontWeight: 600, marginBottom: 8 };
  const greyBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 12.5 };
  const redBtn = { ...greyBtn, fontWeight: 600, color: '#fff', background: PL.accent, border: 'none', borderRadius: 10, cursor: 'pointer' };

  const renderPersonTools = (s) => {
    const sold = soldMap[s.id] || {};
    const cars = assignedMap[s.id] || [];
    return (
      <>
        {s.role === 'salesman' && !s.setup_complete && (
          <section>
            <div style={MICRO}>Setup</div>
            <div style={TOOL}>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: PL.text }}>
                <b>{s.email}</b> has not finished setting up their account. The setup link expires, so send a new one.
              </p>
              <button type="button" onClick={() => resendSetup(s)} disabled={resendingId === s.id} style={{ ...redBtn, opacity: resendingId === s.id ? 0.5 : 1 }}>
                <Mail style={{ width: 14, height: 14 }} /> {resendingId === s.id ? 'Sending...' : 'Resend setup email'}
              </button>
            </div>
          </section>
        )}

        {s.role === 'salesman' && sold.commission > 0 && (
          <section>
            <div style={MICRO}>Commission</div>
            <div style={TOOL}>
              {[['pending', 'Waiting for your approval'], ['approved', 'Approved, not paid yet'], ['paid', 'Paid']].map(([k, label]) => (sold[k] > 0 ? (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '3px 0' }}>
                  <span style={{ color: PL.textSec }}>{label}</span>
                  <b style={{ color: PL.text, fontVariantNumeric: 'tabular-nums' }}>{fmtRM(sold[k])}</b>
                </div>
              ) : null))}
              {canPayCommission && (sold.pending > 0 || sold.approved > 0) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {sold.pending > 0 && <button type="button" style={redBtn} onClick={closeAndRun(() => setCommissionApproveTarget(s.id))}>Approve payout</button>}
                  {sold.approved > 0 && <button type="button" className="pl-btn-grey" style={greyBtn} onClick={closeAndRun(() => setCommissionPayTarget(s.id))}>Mark paid</button>}
                </div>
              )}
            </div>
          </section>
        )}

        {s.role === 'salesman' && (
          <section>
            <div style={MICRO}>Cars only {s.full_name?.split(' ')[0] || 'they'} can sell ({cars.length})</div>
            <div style={TOOL}>
              {cars.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {cars.map((c) => (
                    <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: PL.text, background: PL.raised, borderRadius: 8, padding: '5px 9px' }}>
                      <Lock style={{ width: 11, height: 11, color: PL.textMuted }} />
                      {c.brand} {c.model}{c.year ? ` · ${c.year}` : ''}
                      {c.status === 'reserved' && <span style={{ fontSize: 10, fontWeight: 700, color: PL.textSec }}>Reserved</span>}
                      {canAssignCars && (
                        <button type="button" onClick={() => handleUnassignCar(c.id)} disabled={assignWorking === c.id} title="Unassign" aria-label="Unassign"
                          style={{ display: 'inline-flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: PL.textMuted, opacity: assignWorking === c.id ? 0.4 : 1 }}>
                          <X style={{ width: 12, height: 12 }} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: PL.textMuted }}>None. Any salesman can sell any car, and whoever wins the buyer earns it.</p>
              )}
              {canAssignCars && (
                <button type="button" className="pl-btn-grey" style={{ ...greyBtn, marginTop: 10 }} onClick={() => setAssignPickerFor(assignPickerFor === s.id ? null : s.id)}>
                  <PlusCircle style={{ width: 14, height: 14 }} /> {assignPickerFor === s.id ? 'Close' : 'Lock a car to them'}
                </button>
              )}
              {canAssignCars && assignPickerFor === s.id && (
                <div style={{ marginTop: 8, borderRadius: 10, maxHeight: 200, overflowY: 'auto', background: PL.raised }}>
                  {openCars.length === 0 ? (
                    <p style={{ fontSize: 12, color: PL.textMuted, padding: '10px 12px', margin: 0 }}>No open cars to lock.</p>
                  ) : openCars.map((c, i) => (
                    <button type="button" key={c.id} onClick={() => handleAssignCar(c.id, s.id, s.full_name)} disabled={assignWorking === c.id}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'none', border: 'none', borderTop: i ? `1px solid ${PL.line}` : 'none', color: PL.text, fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}>
                      <Car style={{ width: 13, height: 13, color: PL.textMuted, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.brand} {c.model}{c.year ? ` · ${c.year}` : ''}</span>
                      {c.status === 'reserved' && <span style={{ fontSize: 10, fontWeight: 700, color: PL.textSec }}>Reserved</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {s.role === 'salesman' && s.slug && (
          <section>
            <div style={MICRO}>Their link</div>
            <div style={{ ...TOOL, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: PL.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                /cars?ref=<b style={{ color: PL.text }}>{s.slug}</b>
              </span>
              <button type="button" className="pl-btn-grey" style={greyBtn} onClick={() => copyLink(s)}>
                {copiedId === s.id ? <><Check style={{ width: 14, height: 14 }} /> Copied</> : <><Copy style={{ width: 14, height: 14 }} /> Copy</>}
              </button>
            </div>
          </section>
        )}

        {s.role !== 'salesman' && (
          <section>
            <div style={MICRO}>Last 30 days</div>
            <div style={{ ...TOOL, fontSize: 13, color: PL.textSec }}>
              <b style={{ color: PL.text }}>{activityCountMap[s.id] || 0}</b> actions in the dashboard
            </div>
          </section>
        )}

        {isOwnerTeamRole && (
          <section>
            <div style={MICRO}>Account</div>
            <div style={{ ...TOOL, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(s.role !== 'salesman' || s.setup_complete) && (
                <button type="button" className="pl-btn-grey" style={greyBtn} onClick={() => toggleActive(s)} disabled={togglingId === s.id}>
                  {s.is_active !== false ? <><ToggleRight style={{ width: 14, height: 14 }} /> Switch off</> : <><ToggleLeft style={{ width: 14, height: 14 }} /> Switch on</>}
                </button>
              )}
              <button type="button" className="pl-btn-grey" style={{ ...greyBtn, color: PL.accentText }} onClick={closeAndRun(() => setDeleteConfirmId(s.id))}>
                <Trash2 style={{ width: 14, height: 14 }} /> Remove
              </button>
            </div>
          </section>
        )}
      </>
    );
  };

  const inputCls =
    "w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 transition-all";

  return (
    <div className="space-y-4">
      {/* Top line (2026-11-16 design pass): who is on the team, who needs a look, and the two
          actions. Replaced the all-time "cars sold" tile (Overview has it), the "Salespeople" card
          header and the role tabs. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, flex: '1 1 160px', minWidth: 0, fontSize: 14, color: PL.textSec }}>
          <b style={{ color: PL.text }}>{teamSalesmen.length}</b> salesm{teamSalesmen.length === 1 ? 'an' : 'en'}
          {teamNeedLook > 0 && <> · <b style={{ color: PL.accentText }}>{teamNeedLook} need{teamNeedLook === 1 ? 's' : ''} a look</b></>}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="pl-btn-grey" onClick={() => setMsgOpen(true)} disabled={salespeople.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', fontSize: 13 }}>
          <Send style={{ width: 14, height: 14 }} /> Message
        </button>
        <button type="button" onClick={() => { setShowAddForm(true); resetForm(); }}
          disabled={!managerDealership || !canAddStaff}
          title={canAddStaff ? undefined : "Only the owner can add staff"}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', fontSize: 13, fontWeight: 600, color: '#fff', background: PL.accent, border: 'none', borderRadius: 10, cursor: 'pointer', opacity: !managerDealership || !canAddStaff ? 0.4 : 1 }}>
          <UserPlus style={{ width: 14, height: 14 }} /> Add staff
        </button>
        </div>
      </div>
      {teamError && <div className="pl-note-bad" style={{ padding: '10px 14px', borderRadius: 12, fontSize: 12 }}>{teamError}</div>}

      <section style={{ background: PL.card, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: '6px 0' }}>
        {loadingTeam ? (
          <p style={{ fontSize: 13, color: PL.textMuted, padding: '18px 16px', margin: 0 }}>Loading team...</p>
        ) : (
          <TeamScoreboard
            salesmen={teamSalesmen}
            scoreById={scoreById}
            loading={scoresLoading}
            profitBy={teamProfitBy}
            soldMap={soldMap}
            onOpen={(p) => setOpenPersonId(p.id)}
          />
        )}
        <p style={{ fontSize: 11.5, color: PL.textMuted, margin: '4px 16px 10px' }}>
          Last 30 days, counting only what each salesman did themselves. Tap a name for details and tools.
        </p>
      </section>

      {teamOthers.length > 0 && (
        <section>
          <p style={{ fontSize: 11, fontWeight: 700, color: PL.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '6px 4px 8px' }}>Other staff</p>
          <div style={{ background: PL.card, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: 4 }}>
            {teamOthers.map((s, i) => {
              const w = personWord(s);
              return (
                <div key={s.id} role="button" tabIndex={0} className="tsb-srow"
                  onClick={() => setOpenPersonId(s.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenPersonId(s.id); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderBottom: i < teamOthers.length - 1 ? `1px solid ${PL.line}` : 'none', cursor: 'pointer', borderRadius: 12, opacity: s.is_active === false ? 0.6 : 1 }}>
                  <PersonAvatar person={s} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: PL.text }}>{s.full_name}</span>
                      {w.label && <StatusWord status={w.status} label={w.label} />}
                    </div>
                    <div style={{ fontSize: 12, color: PL.textMuted, marginTop: 1 }}>{STAFF_ROLE_LABEL[s.role] || 'Staff'} · Last active {lastActiveText(lastActivityMap[s.id])}</div>
                  </div>
                  <ChevronRight style={{ width: 16, height: 16, color: PL.textMuted, flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {openPerson && (
        <SalesmanHealthSheet
          person={openPerson.role === 'salesman'
            ? { ...(scoreById[openPerson.id] || {}), name: openPerson.full_name, avatar_url: openPerson.avatar_url }
            : { name: openPerson.full_name, avatar_url: openPerson.avatar_url }}
          staff={openPerson.role !== 'salesman' || !scoreById[openPerson.id]}
          word={personWord(openPerson, scoreById[openPerson.id]).label}
          subtitle={openPerson.role === 'salesman'
            ? (scoreById[openPerson.id] ? undefined : `Last active ${lastActiveText(lastActivityMap[openPerson.id])}`)
            : `${STAFF_ROLE_LABEL[openPerson.role] || 'Staff'} · Last active ${lastActiveText(lastActivityMap[openPerson.id])}`}
          onClose={() => setOpenPersonId(null)}
        >
          {renderPersonTools(openPerson)}
        </SalesmanHealthSheet>
      )}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md"
            style={undefined}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">Remove Salesman?</h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  Deletes their account and referral link permanently.
                </p>
              </div>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="text-gray-500 hover:text-gray-900 p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 transition-all border border-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteSalesman(deleteConfirmId)}
                className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                style={T.btnRed}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── One-time Password Modal ── */}
      {createdAccount && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md relative"
            style={{ background: "#fff", border: "1px solid #e5e7eb" }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#f5f6f8' }}
                >
                  <Check className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {({ salesman: 'Salesman', manager: 'Manager', admin: 'Admin', accountant: 'Accountant', fi_officer: 'F&I Officer' }[createdAccount.role] || 'Team member')} Added
                  </h3>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {createdAccount.email_sent
                      ? "Setup email sent"
                      : "Email couldn't be sent — share credentials"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreatedAccount(null)}
                className="text-gray-500 hover:text-gray-900 p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdAccount.email_sent ? (
              /* Happy path: setup link emailed — no password to relay. */
              <>
                <div
                  className="rounded-xl px-4 py-4 mb-4 text-center"
                  style={{ background: '#f5f6f8' }}
                >
                  <Mail className="w-7 h-7 text-emerald-600 mx-auto mb-2.5" />
                  <p className="text-gray-900 text-sm font-semibold mb-1">Email sent to {createdAccount.full_name}</p>
                  <p className="text-emerald-700 text-xs leading-relaxed">
                    We emailed <span className="font-semibold">{createdAccount.email}</span> a link to set their password and finish setup. Tell them to check their inbox (and spam) to activate their account.
                  </p>
                </div>
              </>
            ) : (
              /* Fallback: email delivery failed — fall back to sharing the temp
                 password so the salesman is never stranded. */
              <>
                <div
                  className="rounded-xl px-3.5 py-2.5 mb-4 flex items-start gap-2.5"
                  style={{ background: '#f5f6f8' }}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-700 text-xs leading-relaxed">
                    We couldn't send the setup email. Share this temporary password with <span className="font-semibold">{createdAccount.email}</span> — it <span className="font-semibold text-amber-800">won't be shown again</span>. They can change it from Settings after signing in.
                  </p>
                </div>
                <div className="rounded-xl px-3.5 py-3 mb-4" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Temporary Password</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdAccount.temp_password);
                        setCopiedPw(true);
                        setTimeout(() => setCopiedPw(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all"
                      style={copiedPw
                        ? { color: "#34d399", background: '#f5f6f8' }
                        : { color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb" }}
                    >
                      {copiedPw ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                  </div>
                  <p className="text-gray-900 text-base font-mono font-bold tracking-widest">{createdAccount.temp_password}</p>
                </div>
              </>
            )}

            <button
              onClick={() => setCreatedAccount(null)}
              className="btn-shimmer w-full px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
              style={T.btnRed}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {/* ── Message Team Panel ── */}
      {(() => {
        const MSG_ROLES = [
          { value: 'all',        label: 'Everyone',    color: '#111827' },
          { value: 'salesman',   label: 'Salesmen',    color: '#6b7280' },
          { value: 'manager',    label: 'Managers',    color: '#6b7280' },
          { value: 'accountant', label: 'Accountants', color: '#6b7280' },
          { value: 'fi_officer', label: 'F&I',         color: '#6b7280' },
          { value: 'admin',      label: 'Admins',      color: '#6b7280' },
        ];
        const recipients = salespeople.filter(s =>
          (msgTarget === 'all' || s.role === msgTarget) && s.is_active !== false
        );
        const sendToTeam = async () => {
          if (!msgText.trim() || recipients.length === 0 || msgSending) return;
          setMsgSending(true);
          const inserts = recipients.map(s => ({
            salesman_id: s.id,
            type: 'broadcast',
            title: 'Message from the owner',
            body: msgText.trim(),
          }));
          const { error } = await supabase.from('salesman_notifications').insert(inserts);
          setMsgSending(false);
          if (error) { toast.error('Failed to send: ' + error.message); return; }
          setMsgDone(true);
          setMsgText('');
          if (msgDoneTimer.current) clearTimeout(msgDoneTimer.current);
          msgDoneTimer.current = setTimeout(() => setMsgDone(false), 3000);
        };
        // A pop-up opened from Team's top line (it was a card that sat open under the team, always).
        if (!msgOpen) return null;
        return createPortal(
          <div onClick={() => setMsgOpen(false)} className="msg-wrap" style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <style>{`@media (min-width: 640px){.msg-wrap{align-items:center!important}.msg-card{border-radius:20px!important}}`}</style>
          <div className="msg-card" role="dialog" aria-modal="true" aria-label="Message your team" onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px 20px 0 0', boxShadow: PL.shadow }}>
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(17,24,39,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>Message your team</h2>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>Arrives as a notification in each person's app</p>
              </div>
              <button type="button" onClick={() => setMsgOpen(false)} aria-label="Close" style={{ border: 'none', background: PL.raised, borderRadius: 999, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X style={{ width: 16, height: 16, color: '#6b7280' }} />
              </button>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {/* Role filter pills */}
              <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Send To</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {MSG_ROLES.map(({ value, label, color }) => {
                  const cnt = value === 'all'
                    ? salespeople.filter(s => s.is_active !== false).length
                    : salespeople.filter(s => s.role === value && s.is_active !== false).length;
                  if (!cnt && value !== 'all') return null; // no "Admins 0": only roles someone holds
                  return (
                    <button
                      key={value}
                      onClick={() => setMsgTarget(value)}
                      style={{
                        padding: '6px 14px', borderRadius: 20,
                        border: 'none',
                        background: msgTarget === value ? '#111827' : '#f5f6f8',
                        color: msgTarget === value ? '#fff' : '#4b5563',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        fontFamily: "system-ui,sans-serif",
                        display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                      }}
                    >
                      {value !== 'all' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />}
                      {label}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                        background: msgTarget === value ? 'rgba(255,255,255,0.18)' : '#fff',
                        color: msgTarget === value ? '#fff' : '#4b5563',
                      }}>{cnt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Recipient preview */}
              {recipients.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {recipients.map(s => (
                    <span key={s.id} style={{ fontSize: 11.5, color: '#4b5563', background: PL.raised, borderRadius: 6, padding: '3px 8px' }}>
                      {s.full_name}
                    </span>
                  ))}
                </div>
              )}

              {/* Message input */}
              <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Message</p>
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                rows={4}
                placeholder="Type your message here…"
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  background: '#f9fafb', border: '1px solid #e5e7eb',
                  borderRadius: 10, padding: '10px 12px', color: '#111827', fontSize: 13,
                  fontFamily: "system-ui,sans-serif", outline: 'none', lineHeight: 1.6,
                  marginBottom: 12,
                }}
              />

              <button
                onClick={sendToTeam}
                disabled={!msgText.trim() || recipients.length === 0 || msgSending}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 16px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: "system-ui,sans-serif", fontSize: 14, fontWeight: 600,
                  border: 'none', transition: 'all 0.15s',
                  ...(msgDone
                    ? { background: '#f5f6f8', color: '#047857', border: 'none' }
                    : (!msgText.trim() || recipients.length === 0)
                      ? { background: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb', cursor: 'not-allowed' }
                      : T.btnRed),
                }}
              >
                {msgDone ? (
                  <><Check style={{ width: 15, height: 15 }} /> Sent to {recipients.length} member{recipients.length !== 1 ? 's' : ''}</>
                ) : msgSending ? (
                  'Sending…'
                ) : (
                  <><Send style={{ width: 14, height: 14 }} /> Send to {recipients.length} member{recipients.length !== 1 ? 's' : ''}</>
                )}
              </button>
            </div>
          </div>
          </div>,
          document.body,
        );
      })()}

      {showAddForm && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
            style={undefined}
          >
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={T.divider}
            >
              <div>
                <h3 className="font-semibold text-gray-900">Add Salesman</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Create account and trackable referral link
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-500 hover:text-gray-900 p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {addSuccess ? (
                <div className="text-center py-8">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{
                      background: '#f5f6f8',
                    }}
                  >
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-emerald-700 font-semibold mb-1">
                    Salesman added!
                  </p>
                  <p className="text-gray-500 text-sm mb-6">{addSuccess}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 transition-all"
                      style={{ border: "1px solid #e5e7eb" }}
                    >
                      Done
                    </button>
                    <button
                      onClick={resetForm}
                      className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                      style={T.btnRed}
                    >
                      Add Another
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Role selector */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2.5">Select Role</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { role: 'salesman',   label: 'Salesman',    color: '#111827', desc: 'Sells cars, manages leads' },
                        { role: 'manager',    label: 'Manager',     color: '#111827', desc: 'Manages sales team' },
                        { role: 'accountant', label: 'Accountant',  color: '#111827', desc: 'Financial view only' },
                        { role: 'fi_officer', label: 'F&I Officer', color: '#111827', desc: 'Finance & insurance' },
                        { role: 'admin',      label: 'Admin',       color: '#111827', desc: 'Listings management' },
                      ].filter(({ role }) => (role !== 'manager' || managerOn) && (isOwnerTeam || role === 'salesman' || role === 'admin')).map(({ role, label, color, desc }) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setNewRole(role)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: newRole === role ? '#e4e7ec' : '#f5f6f8',
                            cursor: 'pointer',
                            fontFamily: "system-ui,sans-serif",
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: newRole === role ? color : '#374151' }}>{label}</span>
                          </div>
                          <p style={{ fontSize: 10, color: '#4b5563', margin: '2px 0 0', textAlign: 'left' }}>{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Ahmad bin Abdullah"
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        autoComplete="off"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                        Email *
                      </label>
                      <input
                        type="email"
                        placeholder="ahmad@autocity.my"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="off"
                        className={inputCls}
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        Please use a real email — password reset and account recovery links are sent here.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                        Phone
                      </label>
                      <PhoneInput value={phone} onChange={(v) => setPhone(v)} autoComplete="off" className={inputCls} prefixClassName="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-200 bg-gray-50 flex-shrink-0" inputClassName="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 text-sm px-3 py-2.5" />
                    </div>
                    {newRole !== "salesman" && isOwnerTeam && (
                      <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                          Temp Password *
                        </label>
                        <input
                          type="text"
                          placeholder="Min 8 characters"
                          value={tempPw}
                          onChange={(e) => setTempPw(e.target.value)}
                          autoComplete="off"
                          className={inputCls}
                        />
                      </div>
                    )}
                    {(newRole === "salesman" || !isOwnerTeam) && (
                      <div className="flex items-end">
                        <div
                          className="w-full rounded-xl px-3 py-2.5 text-xs text-emerald-700"
                          style={{
                            background: '#f5f6f8',
                          }}
                        >
                          {isOwnerTeam
                            ? "Password auto-generated — shown once after creation."
                            : "They get an email to set their own password. The owner is told."}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                      Unique Slug *
                    </label>
                    <div className="flex">
                      <span
                        className="rounded-l-xl px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap bg-gray-50"
                        style={{ border: "1px solid #e5e7eb", borderRight: "none" }}
                      >
                        /cars?ref=
                      </span>
                      <input
                        type="text"
                        placeholder="ahmad"
                        value={slug}
                        onChange={(e) => setSlug(slugify(e.target.value))}
                        autoComplete="off"
                        className="flex-1 rounded-r-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-400 transition-colors"
                        style={{ background: "#fff", border: "1px solid #e5e7eb" }}
                      />
                    </div>
                    <p className="text-xs text-gray-700 mt-1">
                      Auto-filled from first name. Lowercase + numbers only.
                    </p>
                  </div>
                  {addError && (
                    <div
                      className="rounded-xl px-3 py-2.5 text-red-600 text-xs"
                      style={{ background: '#f5f6f8' }}
                    >
                      {addError}
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 transition-all"
                      style={{ border: "1px solid #e5e7eb" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={addLoading}
                      className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-40"
                      style={T.btnRed}
                    >
                      {addLoading ? "Creating..." : newRole === "salesman" ? "Create Salesman" : "Add Team Member"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Commission Approve Confirmation */}
      {commissionApproveTarget && (() => {
        const s = salespeople.find(x => x.id === commissionApproveTarget);
        const amt = soldMap[commissionApproveTarget]?.pending || 0;
        return (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
            <div className="modal-top rounded-2xl p-6 w-full max-w-sm">
              <h3 className="font-semibold text-gray-900 mb-1">Approve Commission Payout?</h3>
              <p className="text-gray-500 text-sm mb-1">Salesman: <span className="font-semibold text-gray-800">{s?.full_name}</span></p>
              <p className="text-gray-500 text-sm mb-5">Pending amount: <span className="font-bold text-amber-600">RM {amt.toLocaleString()}</span></p>
              <div className="flex gap-3">
                <button onClick={() => setCommissionApproveTarget(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 border border-gray-200 hover:text-gray-900 transition-all">Cancel</button>
                <button
                  onClick={() => handleApproveCommission(commissionApproveTarget)}
                  disabled={commissionWorking}
                  className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                  style={{ background: '#d97706', border: 'none' }}
                >
                  {commissionWorking ? 'Approving…' : 'Approve Payout'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Commission Mark Paid Confirmation */}
      {commissionPayTarget && (() => {
        const s = salespeople.find(x => x.id === commissionPayTarget);
        const amt = soldMap[commissionPayTarget]?.approved || 0;
        return (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
            <div className="modal-top rounded-2xl p-6 w-full max-w-sm">
              <h3 className="font-semibold text-gray-900 mb-1">Mark Commission as Paid?</h3>
              <p className="text-gray-500 text-sm mb-1">Salesman: <span className="font-semibold text-gray-800">{s?.full_name}</span></p>
              <p className="text-gray-500 text-sm mb-5">Approved amount: <span className="font-bold text-emerald-600">RM {amt.toLocaleString()}</span></p>
              <div className="flex gap-3">
                <button onClick={() => setCommissionPayTarget(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 border border-gray-200 hover:text-gray-900 transition-all">Cancel</button>
                <button
                  onClick={() => handleMarkCommissionPaid(commissionPayTarget)}
                  disabled={commissionWorking}
                  className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                  style={{ background: '#16a34a', border: 'none' }}
                >
                  {commissionWorking ? 'Saving…' : 'Mark as Paid'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default TeamTab;
