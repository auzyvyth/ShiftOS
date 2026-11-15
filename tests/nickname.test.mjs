// Run: npm run test:nickname
// Guards NICKNAME-1 (src/utils/nickname.js): the typed rules equal the database's nickname_problem().
import fs from 'fs';
import { cleanNickname, nicknameProblem, nicknameErrorCode, NICK_MIN, NICK_MAX } from '../src/utils/nickname.js';

let pass = 0;
const fails = [];
const eq = (a, e, label) => { if (JSON.stringify(a) === JSON.stringify(e)) pass++; else fails.push(`${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(e)}`); };

eq(cleanNickname('  @Fedaus  '), 'Fedaus', 'the @ and the spaces go');
eq(cleanNickname('fe daus'), 'fedaus', 'no spaces inside');
eq(cleanNickname(null), '', 'null is empty');
eq(nicknameProblem(''), null, 'no nickname is allowed');
eq(nicknameProblem('fedaus'), null, 'a normal one');
eq(nicknameProblem('Auzyvyth'), null, 'capitals are kept, not a problem');
eq(nicknameProblem('fe.daus_88'), null, 'dot, underscore and numbers');
eq(nicknameProblem('a'), 'too_short', 'one character');
eq(nicknameProblem('x'.repeat(NICK_MAX + 1)), 'too_long', 'over the limit');
eq(nicknameProblem('x'.repeat(NICK_MAX)), null, 'exactly the limit');
eq(nicknameProblem('fe-daus'), 'characters', 'a hyphen is not allowed');
eq(nicknameProblem('fédaus'), 'characters', 'an accent is not allowed');
eq(nicknameProblem('.fedaus'), 'characters', 'no dot at the start');
eq(nicknameProblem('fedaus.'), 'characters', 'no dot at the end');
eq(nicknameProblem('fe..daus'), 'characters', 'no double dot');
eq(nicknameProblem('0123456789'), 'phone', 'a phone number');
eq(nicknameProblem('012.345.6789'), 'phone', 'a phone number with dots');
eq(nicknameProblem('fedaus88'), null, 'two digits are fine');
eq(nicknameProblem('DrevoOfficial'), 'reserved', 'official + Drevo');
eq(nicknameProblem('verified_agent'), 'reserved', 'verified');
eq(nicknameProblem('Authorised.Proton'), 'reserved', 'authorised');
eq(nicknameProblem('admin1'), 'reserved', 'admin');
eq(nicknameErrorCode({ message: 'nickname_taken' }), 'taken', 'database taken');
eq(nicknameErrorCode({ message: 'duplicate key value violates unique constraint "profiles_nickname_unique"', code: '23505' }), 'taken', 'unique index');
eq(nicknameErrorCode({ message: 'nickname_reserved' }), 'reserved', 'database reserved');
eq(nicknameErrorCode({ message: 'something else' }), null, 'unknown error');

// The SQL says the same numbers and words as this file.
const sql = fs.readFileSync(new URL('../supabase/migrations/20261116b_seller_nickname.sql', import.meta.url), 'utf8');
eq(sql.includes(`char_length(p) < ${NICK_MIN}`), true, 'SQL minimum = JS minimum');
eq(sql.includes(`char_length(p) > ${NICK_MAX}`), true, 'SQL maximum = JS maximum');
eq(sql.includes('(official|authori[sz]ed|verified|drevo|admin|support|moderator)'), true, 'SQL banned words = JS banned words');
eq(sql.includes("[0-9]{9,}"), true, 'SQL phone rule = JS phone rule');

if (fails.length) { console.error(`FAIL ${fails.length}\n` + fails.join('\n')); process.exit(1); }
console.log(`nickname: ${pass} passed`);
