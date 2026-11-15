// The "social media name" box in Settings, Lite AND Premium (NICKNAME-1, owner 2026-11-15). It saves on its
// OWN button, not with the rest of the profile, for two reasons: the main profile save must never fail
// because of this column (the database change may not be applied yet), and a taken name is an answer the
// seller needs at once, not after pressing Save on a long form. The value is the page's form state, so
// the "how you look on Google" preview follows what is typed. The rules live in src/utils/nickname.js and
// are enforced again by the database (migration 20261116b), so this box is a courtesy, never the lock.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../supabaseClient';
import { premiumDark as PD } from '../../theme/tokens';
import { cleanNickname, nicknameProblem, nicknameErrorCode, NICK_WORDS, NICK_MAX } from '../../utils/nickname';

const lbl = { display: 'block', fontSize: 12.5, fontWeight: 600, color: PD.textSec, marginBottom: 6 };

export default function NicknameField({ userId, value, savedValue = '', onChange, onSaved }) {
  const { t } = useTranslation();
  const clean = cleanNickname(value);
  const saved = cleanNickname(savedValue);
  const [state, setState] = useState('idle'); // idle | checking | free | taken | saving
  const [problem, setProblem] = useState(null);
  const [note, setNote] = useState('');
  const seq = useRef(0);

  // Ask the database if the name is free, 450ms after the last keystroke.
  useEffect(() => {
    setNote('');
    const local = nicknameProblem(clean);
    setProblem(local);
    if (!clean || local || clean.toLowerCase() === saved.toLowerCase()) { setState('idle'); return undefined; }
    setState('checking');
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('is_nickname_available', { p_nick: clean });
      if (seq.current !== mine) return;
      // A missing function (the database change not applied yet) must not block anyone: the save decides.
      setState(error ? 'free' : data === false ? 'taken' : 'free');
    }, 450);
    return () => clearTimeout(timer);
  }, [clean, saved]);

  const changed = clean !== saved;
  const canSave = changed && !problem && state !== 'checking' && state !== 'taken' && state !== 'saving';

  const save = async () => {
    if (!canSave) return;
    setState('saving');
    const next = clean || null;
    const { data, error } = await supabase.from('profiles').update({ nickname: next }).eq('id', userId).select('id');
    if (error) {
      const code = nicknameErrorCode(error);
      if (code === 'taken') setState('taken');
      else { setState('idle'); setProblem(code && code !== 'taken' ? code : null); }
      setNote(code ? '' : (error.code === '42703' || /nickname/.test(error.message || '')
        ? t('nickname.notReady', { defaultValue: 'This is not switched on yet. Try again tomorrow.' })
        : t('nickname.saveFailed', { defaultValue: 'Could not save. Try again.' })));
      return;
    }
    if (!data || !data.length) { setState('idle'); setNote(t('nickname.saveFailed', { defaultValue: 'Could not save. Try again.' })); return; }
    setState('idle');
    setNote(next ? t('nickname.saved', { defaultValue: 'Saved. It shows on your page and on Google.' }) : t('nickname.removed', { defaultValue: 'Removed.' }));
    onSaved?.(next || '');
  };

  const status = problem
    ? { text: NICK_WORDS[problem], color: PD.accentText }
    : state === 'taken' ? { text: NICK_WORDS.taken, color: PD.accentText }
    : state === 'checking' ? { text: t('nickname.checking', { defaultValue: 'Checking...' }), color: PD.textMuted }
    : changed && clean && state === 'free' ? { text: t('nickname.free', { defaultValue: 'Free. Press Save to take it.' }), color: PD.up }
    : null;

  return (
    <div>
      <label style={lbl} htmlFor="nick-field">{t('nickname.label', { defaultValue: 'Your social media name' })}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <span aria-hidden="true" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: PD.textMuted, fontSize: 15 }}>@</span>
          <input id="nick-field" value={value || ''} onChange={(e) => onChange(e.target.value)} maxLength={NICK_MAX + 2}
            autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="text"
            placeholder={t('nickname.placeholder', { defaultValue: 'fedaus' })}
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px 12px 30px', borderRadius: PD.radius.row, background: PD.raised, border: 'none', color: PD.text, fontSize: 16, outline: 'none', fontFamily: 'inherit' }} />
        </div>
        <button type="button" onClick={save} disabled={!canSave} className="lk-red"
          style={{ flex: '0 0 auto', padding: '0 18px', minHeight: 44, borderRadius: PD.radius.row, border: 'none', color: PD.onAccent, fontSize: 14, fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.4, fontFamily: 'inherit' }}>
          {state === 'saving' ? t('nickname.saving', { defaultValue: 'Saving...' }) : t('nickname.save', { defaultValue: 'Save' })}
        </button>
      </div>
      <p role="status" style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.5, color: status?.color || PD.textMuted }}>
        {status?.text || note || t('nickname.hint', { defaultValue: 'The name you use on TikTok or Facebook, so buyers who know you by it can find your page. Shown as @name, never your phone number. Your page link does not change.' })}
      </p>
    </div>
  );
}
