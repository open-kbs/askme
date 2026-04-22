import { useEffect, useRef } from "react";
import { useSession } from "../hooks/useSession";

export function SignInButton() {
  const { renderGisButton, status } = useSession();
  const gisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "unauthenticated") return;
    renderGisButton(gisRef.current);
  }, [status, renderGisButton]);

  return (
    <div className="relative inline-block overflow-hidden">
      <button
        type="button"
        tabIndex={-1}
        className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer pointer-events-none"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff" fillOpacity=".8"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" fillOpacity=".6"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" fillOpacity=".4"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" fillOpacity=".7"/>
        </svg>
        Sign in with Google
      </button>
      <div
        ref={gisRef}
        className="absolute inset-0 opacity-0"
        aria-label="Sign in with Google"
      />
    </div>
  );
}

export function SignOutButton() {
  const { signOut } = useSession();
  return (
    <button
      onClick={signOut}
      className="text-sm text-foreground/40 hover:text-foreground/70 transition-colors cursor-pointer"
    >
      Sign out
    </button>
  );
}
