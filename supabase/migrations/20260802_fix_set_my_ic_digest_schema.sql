-- set_my_ic hashed the IC with digest(...) but was pinned to search_path=public,
-- while pgcrypto (which provides digest) is installed in the `extensions` schema.
-- Result: every IC submission failed with "function digest(text, unknown) does not
-- exist", blocking onboarding "Save & Continue" and "Activate Account" whenever an
-- IC was entered -- so premium activation could never reach the payment/QR gate.
-- Fix: schema-qualify digest as extensions.digest and add extensions to the
-- function's search_path.
CREATE OR REPLACE FUNCTION public.set_my_ic(p_ic text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_digits text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_digits := regexp_replace(coalesce(p_ic,''), '\D', '', 'g');
  if length(v_digits) <> 12 then raise exception 'invalid_ic'; end if;
  update profiles
    set ic_hash        = encode(extensions.digest(v_digits || id::text, 'sha256'), 'hex'),
        ic_last4       = right(v_digits, 4),
        ic_verified_at = now(),
        ic_deadline    = null,
        ic_number      = null            -- never persist plaintext
  where id = v_uid;
  return right(v_digits, 4);
end;
$function$;
