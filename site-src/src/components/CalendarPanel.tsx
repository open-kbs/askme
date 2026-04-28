import { useCallback, useEffect, useState } from "react";
import { SignInButton, SignOutButton } from "./AuthButtons";
import { useAuthedFetch, useSession } from "../hooks/useSession";
import { AvailabilityGrid, type DayAvailability, type Slot } from "./AvailabilityGrid";
import { BookingModal } from "./BookingModal";
import { config } from "../config";

type Props = {
  onBooked?: () => void;
};

export function CalendarPanel({ onBooked }: Props = {}) {
  const { status, data } = useSession();
  const authedFetch = useAuthedFetch();
  const firstName = data?.user.name?.split(" ")[0] ?? "";

  const [days, setDays] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    startTime: string;
    daySlots: Slot[];
  } | null>(null);

  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-availability" }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to load availability");
      setDays(payload.days);
      setSelectedDayIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchAvailability();
  }, [status, fetchAvailability]);

  function handleSlotClick(date: string, startTime: string, daySlots: Slot[]) {
    setSelectedSlot({ date, startTime, daySlots });
  }

  function handleModalClose(success?: boolean) {
    setSelectedSlot(null);
    fetchAvailability();
    if (success) onBooked?.();
  }

  const selectedDay = days[selectedDayIndex] ?? null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-3 border-b border-foreground/10">
        <div className="flex items-center justify-between mb-0.5">
          <h2 className="text-base font-semibold tracking-tight">Availability</h2>
          {status === "authenticated" && <SignOutButton />}
        </div>
        <p className="text-xs text-foreground/40">{config.owner.timezoneLabel}</p>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {status === "no_client_id" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
            <p className="text-xs text-foreground/30 leading-relaxed">
              Calendar is not configured yet.
            </p>
          </div>
        )}

        {status === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <span className="w-5 h-5 border-2 border-foreground/10 border-t-foreground/50 rounded-full animate-spin" />
          </div>
        )}

        {status === "unauthenticated" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 md:px-6 py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground/80 mb-1">
                Want to book a call?
              </p>
              <p className="text-xs text-foreground/45 leading-relaxed">
                Sign in to see my live calendar and pick a time that works for you.
              </p>
            </div>
            <SignInButton />
          </div>
        )}

        {status === "authenticated" && (
          <>
            <div className="px-4 pt-3 pb-2">
              <p className="text-xs text-foreground/50">
                Hi {firstName}, pick a day and time below.
              </p>
            </div>

            {!loading && days.length > 0 && (
              <div className="px-4 pb-3">
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                  {days.map((day, i) => {
                    const freeCount = day.slots.filter((s) => s.free).length;
                    const isSelected = i === selectedDayIndex;
                    const dateParts = day.date.split("-");
                    const dayNum = dateParts[0];

                    return (
                      <button
                        key={day.date}
                        onClick={() => setSelectedDayIndex(i)}
                        className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg text-xs transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? "bg-accent text-white shadow-sm"
                            : freeCount > 0
                              ? "bg-foreground/[0.04] text-foreground/70 hover:bg-foreground/[0.08]"
                              : "bg-foreground/[0.02] text-foreground/25 cursor-default"
                        }`}
                        disabled={freeCount === 0}
                      >
                        <span className="font-medium uppercase tracking-wide text-[10px]">
                          {day.dayOfWeek}
                        </span>
                        <span className={`text-sm font-semibold ${isSelected ? "text-white" : ""}`}>
                          {dayNum}
                        </span>
                        {!isSelected && freeCount > 0 && (
                          <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <span className="w-5 h-5 border-2 border-foreground/10 border-t-foreground/50 rounded-full animate-spin" />
              </div>
            )}

            {error && (
              <div className="mx-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-500">{error}</p>
              </div>
            )}

            {!loading && !error && selectedDay && (
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <AvailabilityGrid day={selectedDay} onSlotClick={handleSlotClick} />
              </div>
            )}
          </>
        )}
      </div>

      {selectedSlot && (
        <BookingModal
          date={selectedSlot.date}
          startTime={selectedSlot.startTime}
          daySlots={selectedSlot.daySlots}
          userName={data?.user.name ?? ""}
          userEmail={data?.user.email ?? ""}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
