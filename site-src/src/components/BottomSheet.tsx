import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
};

export function BottomSheet({ open, onClose, children, className = "", title }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-50 ${className}`} role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/50 animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
      />
      <div
        className="absolute bottom-0 inset-x-0 max-h-[88vh] bg-background rounded-t-2xl border-t border-foreground/10 shadow-2xl flex flex-col animate-[slideUp_200ms_ease-out] overflow-hidden"
      >
        <div className="relative shrink-0">
          <div className="flex justify-center pt-2 pb-1">
            <span className="w-10 h-1 rounded-full bg-foreground/20" aria-hidden />
          </div>
          {title && (
            <p className="absolute left-4 top-2.5 text-xs font-medium text-foreground/60">
              {title}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2 top-1.5 w-8 h-8 rounded-full flex items-center justify-center text-foreground/40 hover:text-foreground/80 hover:bg-foreground/[0.06] transition-all cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </div>
    </div>
  );
}
