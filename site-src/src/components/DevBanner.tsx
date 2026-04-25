import { useState } from "react";

const DISMISSED_KEY = "dev-banner-dismissed";

export function DevBanner() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISSED_KEY) === "1",
  );

  if (!import.meta.env.DEV || dismissed) return null;

  function handleDismiss() {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-1.5 flex items-center justify-between gap-2">
      <p className="text-xs text-amber-400/80">
        Running locally — sign-in, email, and booking notifications require deployment
      </p>
      <button
        onClick={handleDismiss}
        className="text-amber-400/50 hover:text-amber-400 transition-colors shrink-0 cursor-pointer"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
