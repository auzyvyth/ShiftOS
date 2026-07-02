-- Reject reserved subdomains at the DB layer (defense in depth). Without this a
-- dealer could claim infra/auth/brand namespaces like admin, login, api, www,
-- xdrive → routing collisions / phishing. Client mirror for friendly inline
-- errors lives in src/utils/reservedSubdomains.js — keep the two lists in sync.

CREATE OR REPLACE FUNCTION public.is_reserved_subdomain(p_sub text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(coalesce(p_sub,'')) IN (
    'www','ftp','mail','smtp','imap','pop','ns1','ns2','mx','email','webmail',
    'cpanel','whm','host','hosting','server','db','database','redis','ws','socket',
    'cdn','static','assets','media','img','images','files','download','downloads',
    'admin','administrator','superadmin','root','system','sys','sysadmin',
    'auth','login','signin','signup','register','logout','oauth','sso',
    'dashboard','portal','account','accounts','my','me','user','users','secure','vpn','proxy','gateway',
    'api','app','apps','graphql','rest',
    'xdrive','shiftos','dealer','dealers','salesman','salesmen','manager','buyer','buyers','owner',
    'staging','preview','prod','production','dev','test','demo','sandbox','beta','alpha',
    'blog','news','help','support','docs','status','about','contact','legal','terms','privacy',
    'billing','pay','payment','payments','checkout','invoice','store','shop','cart'
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_subdomain_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subdomain IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.subdomain IS DISTINCT FROM OLD.subdomain) THEN
    IF NOT is_superadmin() AND is_reserved_subdomain(NEW.subdomain) THEN
      RAISE EXCEPTION 'subdomain is reserved: %', NEW.subdomain
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_subdomain_rules ON public.profiles;
CREATE TRIGGER trg_enforce_subdomain_rules
  BEFORE INSERT OR UPDATE OF subdomain ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subdomain_rules();
