import { useLocation } from 'react-router-dom';
import { useLayoutEffect, useEffect } from 'react';

// Height of the sticky marketplace header, so a #hash target lands below it
// instead of under it (mh-bar is 70px desktop / 64px mobile).
const HEADER_OFFSET = 78;
// The section a hash points at can be inside a lazily-rendered chunk, so the
// element often does not exist on the tick the route changes. Retry across a
// few frames rather than giving up on the first miss.
const HASH_RETRY_MS = [0, 60, 160, 320, 640];

const ScrollToTop = () => {
    const { pathname, hash } = useLocation();

    // Always land at the top on a route change. With a hash this is the
    // fallback position — if the target never renders, the visitor is at the
    // start of the new page rather than stranded at the old page's scroll.
    useLayoutEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, [pathname]);

    // Then resolve the hash. React Router navigates with pushState, and the
    // browser does NOT scroll to a fragment on pushState — so without this,
    // every "/shiftos#pricing" link (footer plan rows, header Dealer Pricing)
    // dropped the visitor at the top of the page instead. Keyed on hash as
    // well as pathname so a hash link works while already on that page.
    useEffect(() => {
        const id = hash.replace(/^#/, '');
        if (!id) return;

        let cancelled = false;
        const timers = HASH_RETRY_MS.map(delay => setTimeout(() => {
            if (cancelled) return;
            // decodeURIComponent: a hash can arrive percent-encoded.
            let el = null;
            try { el = document.getElementById(decodeURIComponent(id)); } catch { el = document.getElementById(id); }
            if (!el) return;
            cancelled = true;
            const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
            window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
        }, delay));

        return () => { cancelled = true; timers.forEach(clearTimeout); };
    }, [pathname, hash]);

    return null;
}

export default ScrollToTop;
