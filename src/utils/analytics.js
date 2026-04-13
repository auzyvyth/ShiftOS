const SESSION_KEY = 'xdrive_session_id';

export function getOrCreateSessionId() {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

/**
 * Fire an analytics event. Always fails silently — analytics must never break a page.
 * Automatically attaches session_id, page_path, and referrer.
 */
export async function fireEvent(supabase, payload) {
  try {
    await supabase.from('analytics_events').insert({
      ...payload,
      session_id: getOrCreateSessionId(),
      page_path: window.location.pathname,
      referrer: document.referrer || null,
    });
  } catch {
    // Fail silently
  }
}
