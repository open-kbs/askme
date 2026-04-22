import { config } from "../config";

export type ToolPart = {
  toolName: string;
  input?: unknown;
  output: unknown;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolParts?: ToolPart[];
};

type AvailabilityDay = { date: string; dayOfWeek: string; freeSlots: string[] };

function AvailabilityCard({ data }: { data: AvailabilityDay[] | unknown }) {
  const arr = Array.isArray(data) ? (data as AvailabilityDay[]) : [];
  if (arr.length === 0) {
    return (
      <div className="rounded-lg bg-foreground/[0.04] border border-foreground/10 p-3 my-1">
        <p className="text-xs text-foreground/50">No availability found for the next 7 days.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-foreground/[0.04] border border-foreground/10 p-3 my-1 space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">
        Available slots ({config.owner.timezoneLabel})
      </p>
      {arr.map((day) => (
        <div key={day.date}>
          <p className="text-xs font-medium text-foreground/70 mb-1">
            {day.dayOfWeek} {day.date}
          </p>
          <div className="flex flex-wrap gap-1">
            {day.freeSlots.map((slot) => (
              <span
                key={slot}
                className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              >
                {slot}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type ActionResult = { success: boolean; message?: string; error?: string };

function BookingCard({ data }: { data: unknown }) {
  const result = (data as ActionResult) ?? { success: false, error: "Unknown error" };
  if (result.success) {
    return (
      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 my-1 flex items-start gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 shrink-0 mt-0.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <p className="text-xs text-emerald-700 dark:text-emerald-300">{result.message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 my-1 flex items-start gap-2">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      <p className="text-xs text-red-600 dark:text-red-400">{result.error}</p>
    </div>
  );
}

function renderToolPart(part: ToolPart, key: number) {
  if (part.toolName === "checkAvailability") {
    return <AvailabilityCard key={key} data={part.output} />;
  }
  if (part.toolName === "createBooking" || part.toolName === "sendMessage") {
    return <BookingCard key={key} data={part.output} />;
  }
  return null;
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] md:max-w-[80%] rounded-2xl px-3 md:px-4 py-2 ${
          isUser ? "bg-accent text-white" : "bg-muted text-foreground"
        }`}
      >
        {message.content && (
          <p className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">{message.content}</p>
        )}
        {message.toolParts?.map((part, i) => renderToolPart(part, i))}
      </div>
    </div>
  );
}
