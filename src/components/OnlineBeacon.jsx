import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase, publicClient } from '../supabaseClient';
import { matchesPathPrefix } from '../utils/routeMatch';
import { isInternalDevice } from '../utils/internalTraffic';
import { ONLINE_CHANNEL, SELLER_PREFIXES, deviceKey, isLiveOpen } from '../lib/onlinePresence';

// Mounted once inside the Router (App.jsx). Announces this tab on the
// "online now" presence channel (src/lib/onlinePresence.js): seller, buyer,
// visitor or team (our own devices), plus whether Live presentation is open. Writes nothing to the DB.
//
// Waits a few seconds after load so it never competes with first paint, and
// skips the platform console (the admin is not a user).
const JOIN_DELAY_MS = 4000;

export default function OnlineBeacon() {
  const { pathname } = useLocation();
  const [user, setUser] = useState(undefined); // undefined = not known yet
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(isLiveOpen());
  // Shared by every tab on this device, so two tabs count as one (deviceKey).
  const keyRef = useRef(deviceKey());
  const chanRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), JOIN_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => { if (!cancelled) setUser(data?.session?.user || null); });
    // Never return a promise from this callback (it runs under the auth lock).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    const onLive = () => setLive(isLiveOpen());
    window.addEventListener('xd:live', onLive);
    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
      window.removeEventListener('xd:live', onLive);
    };
  }, []);

  const onConsole = pathname.startsWith('/platform');
  const signedIn = Boolean(user && !user.is_anonymous);
  // A guest in chat (anonymous sign-in) is a buyer, not a visitor. A device
  // that is ours (isInternalDevice: a seller/admin once signed in on it, or
  // ?internal=1) never counts as a visitor or buyer: it is the team.
  const internal = isInternalDevice();
  const kind = signedIn && (internal || matchesPathPrefix(pathname, SELLER_PREFIXES)) ? 'seller'
    : internal ? 'team'
    : user ? 'buyer'
    : 'visitor';
  // Tabs with a session (incl. guests) ride the main client's socket (sellers
  // already have one for chat and notifications); visitors use the
  // session-free public client.
  const useMain = Boolean(user);

  // Join (or re-join when the client changes). Track updates ride the same channel.
  useEffect(() => {
    if (!ready || user === undefined || onConsole) return undefined;
    const client = useMain ? supabase : publicClient;
    const channel = client.channel(ONLINE_CHANNEL, { config: { presence: { key: keyRef.current } } });
    chanRef.current = channel;
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track({ a: kind, live: isLiveOpen() || undefined }).catch(() => {});
    });
    return () => {
      chanRef.current = null;
      client.removeChannel(channel);
    };
    // kind/live changes are sent by the effect below, without re-joining.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, useMain, onConsole, user === undefined]);

  useEffect(() => {
    const channel = chanRef.current;
    if (!channel) return;
    channel.track({ a: kind, live: live || undefined }).catch(() => {});
  }, [kind, live]);

  return null;
}
