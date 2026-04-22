export type Slot = { start: string; end: string; free: boolean };

export type DayAvailability = {
  date: string;
  dayOfWeek: string;
  slots: Slot[];
};

function groupSlotsByPeriod(slots: Slot[]) {
  const morning: Slot[] = [];
  const afternoon: Slot[] = [];
  const evening: Slot[] = [];

  for (const slot of slots) {
    if (!slot.free) continue;
    const hour = parseInt(slot.start.split(":")[0]);
    if (hour < 12) morning.push(slot);
    else if (hour < 17) afternoon.push(slot);
    else evening.push(slot);
  }

  return { morning, afternoon, evening };
}

function PeriodSection({
  label,
  slots,
  onSlotClick,
  date,
  allSlots,
}: {
  label: string;
  slots: Slot[];
  onSlotClick?: (date: string, startTime: string, daySlots: Slot[]) => void;
  date: string;
  allSlots: Slot[];
}) {
  if (slots.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/35 mb-2">
        {label}
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-2 gap-1.5">
        {slots.map((slot) => (
          <button
            key={slot.start}
            onClick={() => onSlotClick?.(date, slot.start, allSlots)}
            className="group relative px-2.5 py-2.5 rounded-md text-xs font-medium
              bg-emerald-500/10 text-emerald-700 dark:text-emerald-300
              hover:bg-emerald-500/20 hover:shadow-sm
              active:scale-[0.97]
              transition-all duration-150 cursor-pointer"
          >
            {slot.start}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AvailabilityGrid({
  day,
  onSlotClick,
}: {
  day: DayAvailability;
  onSlotClick?: (date: string, startTime: string, daySlots: Slot[]) => void;
}) {
  const { morning, afternoon, evening } = groupSlotsByPeriod(day.slots);
  const totalFree = morning.length + afternoon.length + evening.length;

  if (totalFree === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <div className="w-10 h-10 rounded-full bg-foreground/[0.04] flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/25">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </div>
        <p className="text-xs text-foreground/35">No available slots this day</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-foreground/40">
        {totalFree} slot{totalFree !== 1 ? "s" : ""} available
      </p>
      <PeriodSection label="Morning" slots={morning} onSlotClick={onSlotClick} date={day.date} allSlots={day.slots} />
      <PeriodSection label="Afternoon" slots={afternoon} onSlotClick={onSlotClick} date={day.date} allSlots={day.slots} />
      <PeriodSection label="Evening" slots={evening} onSlotClick={onSlotClick} date={day.date} allSlots={day.slots} />
    </div>
  );
}
