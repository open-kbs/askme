import { useState, type FormEvent } from "react";
import type { Slot } from "./AvailabilityGrid";
import { useAuthedFetch } from "../hooks/useSession";

type Props = {
  date: string;
  startTime: string;
  daySlots: Slot[];
  userName?: string;
  userEmail?: string;
  onClose: (success?: boolean) => void;
};

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function computeEndTime(startTime: string, duration: number) {
  const [h, m] = startTime.split(":").map(Number);
  const endMin = h * 60 + m + duration;
  const endH = Math.floor(endMin / 60);
  const endM = endMin % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

export function BookingModal({
  date,
  startTime,
  daySlots,
  userName,
  userEmail,
  onClose,
}: Props) {
  const authedFetch = useAuthedFetch();
  const [duration, setDuration] = useState<30 | 60>(30);
  const [name, setName] = useState(userName ?? "");
  const [email, setEmail] = useState(userEmail ?? "");
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const [h, m] = startTime.split(":").map(Number);
  const actualNextTime = m === 0
    ? `${String(h).padStart(2, "0")}:30`
    : `${String(h + 1).padStart(2, "0")}:00`;
  const nextSlot = daySlots.find((s) => s.start === actualNextTime);
  const can60 = nextSlot?.free === true && !(h === 20 && m === 30);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await authedFetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-booking", name, email, topic, date, startTime, duration }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Booking failed");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const endTime = computeEndTime(startTime, duration);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out] p-4"
      onClick={() => onClose()}
    >
      <div
        className="bg-background rounded-2xl max-w-sm w-full shadow-2xl border border-foreground/[0.08] overflow-hidden animate-[slideUp_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "success" ? (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckIcon className="text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold mb-1">Request sent!</h3>
              <p className="text-xs text-foreground/50 leading-relaxed">
                I&apos;ll review your request and send a calendar invite once confirmed.
              </p>
            </div>
            <button
              onClick={() => onClose(true)}
              className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 cursor-pointer transition-opacity"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="p-4 md:p-5 pb-4 border-b border-foreground/[0.06]">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-semibold">Book a call</h3>
                <button
                  onClick={() => onClose()}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-foreground/30 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-all cursor-pointer -mr-1 -mt-1"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs text-foreground/60">
                  <CalendarIcon className="text-foreground/35 shrink-0" />
                  <span>{date}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-foreground/60">
                  <ClockIcon className="text-foreground/35 shrink-0" />
                  <span>{startTime} &mdash; {endTime} ({duration} min)</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-5 flex flex-col gap-3.5">
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider text-foreground/35 mb-2 block">
                  Duration
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDuration(30)}
                    className={`flex-1 rounded-lg py-2.5 text-xs font-medium cursor-pointer transition-all ${
                      duration === 30
                        ? "bg-accent text-white shadow-sm"
                        : "bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08]"
                    }`}
                  >
                    30 min
                  </button>
                  <button
                    type="button"
                    onClick={() => can60 && setDuration(60)}
                    disabled={!can60}
                    className={`flex-1 rounded-lg py-2.5 text-xs font-medium transition-all ${
                      duration === 60
                        ? "bg-accent text-white shadow-sm cursor-pointer"
                        : can60
                          ? "bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08] cursor-pointer"
                          : "bg-foreground/[0.02] text-foreground/15 cursor-not-allowed"
                    }`}
                    title={!can60 ? "Next slot is not available" : ""}
                  >
                    60 min
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-3 text-sm outline-none focus:border-accent/50 focus:bg-transparent transition-all placeholder:text-foreground/25"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
                  required
                  className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-3 text-sm outline-none focus:border-accent/50 focus:bg-transparent transition-all placeholder:text-foreground/25"
                />

                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What would you like to discuss? (optional)"
                  rows={2}
                  className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-3 text-sm outline-none focus:border-accent/50 focus:bg-transparent transition-all resize-none placeholder:text-foreground/25"
                />
              </div>

              <button
                type="submit"
                disabled={status === "submitting"}
                className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-opacity mt-1"
              >
                {status === "submitting" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  "Request booking"
                )}
              </button>

              {status === "error" && (
                <p className="text-xs text-red-500 text-center">{errorMsg}</p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
