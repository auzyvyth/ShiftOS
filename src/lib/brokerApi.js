import { supabase } from '../supabaseClient';

// BROKER-1: every call into the broker network goes through here, so the words for
// every refusal live in ONE place (brokerError) and no screen reads a table directly.
// The database enforces all of it (migration 20261115a_broker_network.sql); this file
// only calls it. Keep these two numbers equal to the SQL (broker_add_to_page, the
// 14 days in broker_register_buyer).

export const BROKER_CAR_CAP = 30;
export const HOLD_DAYS = 14;

// A reason the database returned -> a sentence for the person. A new reason in SQL needs
// a line here, or the screen says the generic one.
const REASONS = {
  not_a_standalone_seller: 'Only a seller with their own page can work with a dealer.',
  dealer_not_found: 'No dealer found with that name. Check the spelling of their storefront name.',
  broker_not_found: 'No seller found with that page name.',
  too_many: 'You have done a lot of these today. Try again tomorrow.',
  forbidden: 'You cannot do that.',
  bad_action: 'That is no longer possible. Refresh and look again.',
  bad_commission: 'Commission must be between RM 0 and RM 100,000.',
  not_found: 'That connection no longer exists.',
  not_allowed: 'You need Premium and an active connection with this dealer.',
  unavailable: 'That car is no longer open to brokers.',
  cap: `Your page can hold ${BROKER_CAR_CAP} dealer cars. Remove one first.`,
  consent_required: 'Tick the box to confirm the buyer knows you are sharing their details.',
  bad_details: 'Check the buyer name and phone number.',
  held: 'This buyer is already held by another broker on this dealer\'s cars.',
  mine: 'You already registered this buyer on this dealer\'s cars.',
  network: 'Could not reach the server. Try again.',
};

export function brokerError(reason) {
  return REASONS[reason] || 'Something went wrong. Try again.';
}

// jsonb functions: { ok, reason?, ... }. A transport error becomes { ok:false, reason:'network' }.
async function call(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { ok: false, reason: 'network', message: error.message };
  return data && typeof data === 'object' ? data : { ok: false, reason: 'network' };
}

// table functions: { rows, error }
async function rows(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { rows: [], error: error.message };
  return { rows: data || [], error: null };
}

// broker side
export const myDealers = () => rows('broker_my_dealers');
export const myRegistrations = () => rows('broker_my_regs');
export const dealerStock = (dealerId) => rows('broker_dealer_stock', { p_dealer: dealerId });
// People paste "vyth.drevo.my", "https://vyth.drevo.my/cars" or "vyth": all mean "vyth".
export function cleanStorefrontName(raw) {
  let v = String(raw || '').trim().toLowerCase();
  v = v.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '');
  v = v.split(/[/?#\s]/)[0];
  return v.split('.')[0].replace(/[^a-z0-9-]/g, '');
}

// A broker's page name: "premiummotors", or a pasted ".../s/premiummotors" link.
export function cleanPageName(raw) {
  let v = String(raw || '').trim().toLowerCase();
  const m = v.match(/\/s\/([a-z0-9_-]+)/);
  if (m) return m[1];
  return v.replace(/^@/, '').replace(/[^a-z0-9_-]/g, '');
}

export const requestDealer = (subdomain) => call('broker_request', { p_subdomain: cleanStorefrontName(subdomain) });
export const respondToInvite = (dealerId, userId, action) =>
  call('broker_set_status', { p_dealer: dealerId, p_broker: userId, p_action: action });
export const addToPage = (listingId) => call('broker_add_to_page', { p_listing: listingId });
export const removeFromPage = (listingId) => call('broker_remove_from_page', { p_listing: listingId });
export const registerBuyer = (listingId, name, phone, consent) =>
  call('broker_register_buyer', { p_listing: listingId, p_name: name, p_phone: phone, p_consent: consent });

// dealer side
export const dealerBrokers = () => rows('dealer_my_brokers');
export const dealerRegistrations = () => rows('dealer_broker_regs');
export const inviteBroker = (slug, commission) =>
  call('broker_invite', { p_slug: cleanPageName(slug), p_commission: commission });
export const setBrokerStatus = (dealerId, brokerId, action, commission = null) =>
  call('broker_set_status', { p_dealer: dealerId, p_broker: brokerId, p_action: action, p_commission: commission });
export const markSold = (regId, commission = null) =>
  call('broker_mark_sold', { p_reg: regId, p_commission: commission });
export const markPaid = (regId) => call('broker_mark_paid', { p_reg: regId });

export const money = (n) => `RM ${Number(n || 0).toLocaleString('en-MY')}`;
export const shortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) : '';
