import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { MessageBubble, type ChatMessage } from "./MessageBubble";
import { config } from "../config";

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const STARTER_PROMPTS = config.starterPrompts;

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { id: generateId(), role: "user", content: text };
      const next = [...messages, userMsg];
      setMessages(next);
      setIsSending(true);
      setError(null);

      try {
        const res = await fetch("/api-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Chat failed");

        const assistantMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: data.text ?? "",
          toolParts: Array.isArray(data.toolParts) ? data.toolParts : undefined,
        };
        setMessages([...next, assistantMsg]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsSending(false);
      }
    },
    [messages],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    sendMessage(text);
  }

  return (
    <div className="chat-area flex flex-1 flex-col h-full max-w-2xl mx-auto w-full px-2 sm:px-4 py-4">
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 rounded-2xl border border-foreground/10 bg-muted/30">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-2">
            <img
              src={config.branding.avatarUrl}
              alt={config.owner.name}
              width={96}
              height={96}
              className="rounded-full object-cover object-top w-24 h-24"
            />
            <p className="text-lg md:text-xl font-medium text-foreground/70">
              Hey, I&apos;m {config.owner.firstName}!
            </p>
            <p className="text-sm text-foreground/60 text-center">
              {config.owner.bioTagline}
            </p>
            <p className="text-sm md:text-base text-foreground/50 text-center">
              Skip the resume — ask me anything in plain language.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={isSending}
                  className="rounded-full border border-foreground/15 bg-background px-3.5 py-1.5 text-sm text-foreground/80 transition-colors hover:border-accent hover:text-accent disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3 flex gap-1">
                  <span className="typing-dot" />
                  <span className="typing-dot animation-delay-200" />
                  <span className="typing-dot animation-delay-400" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      <div className="border-t border-foreground/10 px-2 sm:px-4 py-3 md:py-4">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask me anything..."
            rows={1}
            className="flex-1 rounded-2xl border border-foreground/15 bg-background px-3 md:px-4 py-2.5 md:py-3 text-base outline-none focus:border-accent transition-colors resize-none max-h-32 overflow-y-auto"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="rounded-full bg-accent px-5 py-3 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
