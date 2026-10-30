import ErrorScreen from "./ErrorScreen";

// What every signed-in panel shows when reading the user's OWN profile fails
// (a timeout or server error, i.e. the database stalled). It used to send them
// to /login, which reads as "you were logged out" when the session was fine
// (2026-10-30: an 11:18 MYT DB stall bounced a Premium seller to the sign-in
// page). Only a CLEAN empty answer (no row, no error) still goes to /login.
export default function ProfileLoadError({ onRetry }) {
  return (
    <ErrorScreen
      variant="load"
      eyebrow="Slow connection"
      title="Hold up, we're stuck in traffic"
      body="We couldn't load your account just now. You're still signed in, give it another go."
      actions={[
        { label: "Try again", onClick: onRetry || (() => window.location.reload()) },
        { label: "Go to the marketplace", href: "/" },
      ]}
    />
  );
}
