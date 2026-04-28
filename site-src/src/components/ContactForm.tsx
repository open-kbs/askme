import { useState, type FormEvent } from "react";
import { config } from "../config";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-contact", name, email, message, website }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");
      setStatus("sent");
      setName("");
      setEmail("");
      setMessage("");
      setWebsite("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div aria-hidden="true" className="absolute left-[-9999px] w-px h-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm text-foreground/70">Name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-lg border border-foreground/20 bg-background px-3 md:px-4 py-2.5 text-base outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm text-foreground/70">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-foreground/20 bg-background px-3 md:px-4 py-2.5 text-base outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="message" className="text-sm text-foreground/70">Message</label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          className="rounded-lg border border-foreground/20 bg-background px-3 md:px-4 py-2.5 text-base outline-none focus:border-accent transition-colors resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-lg bg-accent px-5 py-2.5 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {status === "sending" ? "Sending..." : "Send Message"}
      </button>

      {status === "sent" && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Message sent! {config.owner.firstName} will get back to you.
        </p>
      )}

      {status === "error" && <p className="text-sm text-red-500">{errorMsg}</p>}
    </form>
  );
}
