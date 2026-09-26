import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// The opt-out every notification email links to. No sign-in required — the
// person clicking it is in their inbox, not in the app, and an unsubscribe that
// demands a password is an unsubscribe that turns into a spam report.
//
// The token is checked by email_unsubscribe(p_token), a SECURITY DEFINER
// function that takes it as an ARGUMENT. It is deliberately not a policy or a
// view: those can only describe the token's SHAPE, which matches every row for
// anybody. See CLAUDE.md "A share token is a PASSWORD". Nothing here ever
// renders the token back, so the link cannot be replayed off the page.

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('t');
  const [state, setState] = useState('working'); // working | done | bad

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) { setState('bad'); return; }
      const { data, error } = await supabase.rpc('email_unsubscribe', { p_token: token });
      if (!alive) return;
      setState(!error && data === true ? 'done' : 'bad');
    })();
    return () => { alive = false; };
  }, [token]);

  return (
    <div style={{ minHeight:'100vh', background:'#080C14', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:420, background:'#0f1420', border:'1px solid rgba(255,255,255,0.10)', borderRadius:16, padding:'28px 24px', textAlign:'center' }}>
        {state === 'working' && (
          <p style={{ margin:0, fontSize:14, color:'rgba(255,255,255,0.65)' }}>Turning these emails off…</p>
        )}
        {state === 'done' && (
          <>
            <p style={{ margin:'0 0 8px', fontSize:17, fontWeight:700, color:'#f3f4f6' }}>Done</p>
            <p style={{ margin:'0 0 20px', fontSize:13.5, lineHeight:1.6, color:'rgba(255,255,255,0.60)' }}>
              We will not email you about unread messages or waiting leads again.
              You will still see everything when you open the app.
            </p>
          </>
        )}
        {state === 'bad' && (
          <>
            <p style={{ margin:'0 0 8px', fontSize:17, fontWeight:700, color:'#f3f4f6' }}>That link did not work</p>
            <p style={{ margin:'0 0 20px', fontSize:13.5, lineHeight:1.6, color:'rgba(255,255,255,0.60)' }}>
              It may have already been used. You can turn these emails off from
              your account settings instead.
            </p>
          </>
        )}
        <Link to="/" style={{ display:'inline-block', padding:'10px 18px', borderRadius:9, background:'#dc2626', color:'#fff', fontSize:13.5, fontWeight:700, textDecoration:'none' }}>
          Back to XDrive
        </Link>
      </div>
    </div>
  );
}
