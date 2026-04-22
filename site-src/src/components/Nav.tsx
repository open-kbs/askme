import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { href: "/", label: "Chat" },
  { href: "/contact", label: "Contact" },
];

const LOGO_TEXT = "ASK IVO";

function TypewriterLogo() {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(LOGO_TEXT.slice(0, i));
      if (i >= LOGO_TEXT.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 120);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className="text-base md:text-lg font-bold tracking-widest inline-block whitespace-nowrap"
      style={{ fontFamily: "var(--font-orbitron)" }}
    >
      {displayed}
      {!done && <span className="animate-blink">|</span>}
    </span>
  );
}

type Props = {
  onOpenSchedule?: () => void;
};

export function Nav({ onOpenSchedule }: Props) {
  const { pathname } = useLocation();

  return (
    <nav className="border-b border-foreground/10 px-3 md:px-4 py-3 flex items-center gap-3 md:gap-6">
      <Link to="/" className="flex items-center shrink-0">
        <TypewriterLogo />
      </Link>
      <div className="flex items-center gap-3 md:gap-4">
        {links.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              to={link.href}
              className={`text-sm transition-colors ${
                isActive
                  ? "text-accent font-medium"
                  : "text-foreground/50 hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-3 md:gap-4">
        {onOpenSchedule && (
          <button
            type="button"
            onClick={onOpenSchedule}
            className="md:hidden text-sm text-accent hover:opacity-80 transition-opacity cursor-pointer"
          >
            Schedule
          </button>
        )}
        <a
          href="https://www.linkedin.com/in/ivo-stoynovski-b159b8182/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LinkedIn"
          className="text-accent hover:opacity-80 transition-opacity flex items-center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
          </svg>
        </a>
        <a
          href="https://github.com/ivostoynovski"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="text-accent hover:opacity-80 transition-opacity flex items-center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.6-2.8 5.7-5.5 6 .5.4.9 1 .9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3" />
          </svg>
        </a>
        <a
          href="/media/Ivo_Stoynovski_CV.pdf"
          download
          aria-label="Download CV"
          className="text-sm text-accent hover:opacity-80 transition-opacity flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="hidden sm:inline">Download CV</span>
        </a>
        <ThemeToggle />
      </div>
    </nav>
  );
}
