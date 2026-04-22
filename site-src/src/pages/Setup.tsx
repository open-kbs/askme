import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

type Values = {
  config: any;
  envPresence: Record<string, boolean>;
};

type TestState = { state: "idle" | "running" | "ok" | "fail"; message?: string };

const initialTest: TestState = { state: "idle" };

export default function Setup() {
  const navigate = useNavigate();
  const [values, setValues] = useState<Values | null>(null);
  const [loadError, setLoadError] = useState("");

  // Config form state
  const [ownerName, setOwnerName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [nameLocal, setNameLocal] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("");
  const [timezoneLabel, setTimezoneLabel] = useState("");
  const [bioTagline, setBioTagline] = useState("");
  const [siteName, setSiteName] = useState("");
  const [logoText, setLogoText] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");

  // Env form state
  const [googleOauthClientId, setGoogleOauthClientId] = useState("");
  const [googleServiceAccountKey, setGoogleServiceAccountKey] = useState("");
  const [googleCalendarIds, setGoogleCalendarIds] = useState("");
  const [googleCalendarWriteId, setGoogleCalendarWriteId] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [openkbsApiKey, setOpenkbsApiKey] = useState("");

  // Test feedback
  const [llmTest, setLlmTest] = useState<TestState>(initialTest);
  const [calTest, setCalTest] = useState<TestState>(initialTest);
  const [emailTest, setEmailTest] = useState<TestState>(initialTest);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/setup/values");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Values = await res.json();
        setValues(data);
        const c = data.config;
        setOwnerName(c.owner?.name ?? "");
        setFirstName(c.owner?.firstName ?? "");
        setNameLocal(c.owner?.nameLocal ?? "");
        setTitle(c.owner?.title ?? "");
        setLocation(c.owner?.location ?? "");
        setTimezone(c.owner?.timezone ?? "");
        setTimezoneLabel(c.owner?.timezoneLabel ?? "");
        setBioTagline(c.owner?.bioTagline ?? "");
        setSiteName(c.branding?.siteName ?? "");
        setLogoText(c.branding?.logoText ?? "");
        setMetaDescription(c.branding?.metaDescription ?? "");
        setLinkedin(c.social?.linkedin ?? "");
        setGithub(c.social?.github ?? "");
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "failed to load");
      }
    })();
  }, []);

  async function runLlmTest() {
    if (!openkbsApiKey) {
      setLlmTest({ state: "fail", message: "Paste OPENKBS_API_KEY first" });
      return;
    }
    setLlmTest({ state: "running" });
    try {
      const res = await fetch("/api/setup/test/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: openkbsApiKey }),
      });
      const data = await res.json();
      setLlmTest({ state: data.ok ? "ok" : "fail", message: data.message || data.error });
    } catch (err) {
      setLlmTest({ state: "fail", message: err instanceof Error ? err.message : "network error" });
    }
  }

  async function runCalTest() {
    if (!googleServiceAccountKey || !googleCalendarIds) {
      setCalTest({ state: "fail", message: "Need service account key + calendar IDs" });
      return;
    }
    setCalTest({ state: "running" });
    try {
      const res = await fetch("/api/setup/test/google-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceAccountKey: googleServiceAccountKey,
          calendarIds: googleCalendarIds,
        }),
      });
      const data = await res.json();
      setCalTest({ state: data.ok ? "ok" : "fail", message: data.message || data.error });
    } catch (err) {
      setCalTest({ state: "fail", message: err instanceof Error ? err.message : "network error" });
    }
  }

  async function runEmailTest() {
    if (!openkbsApiKey || !contactEmail) {
      setEmailTest({ state: "fail", message: "Need API key + contact email" });
      return;
    }
    setEmailTest({ state: "running" });
    try {
      const res = await fetch("/api/setup/test/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: openkbsApiKey, to: contactEmail, from: fromEmail }),
      });
      const data = await res.json();
      setEmailTest({ state: data.ok ? "ok" : "fail", message: data.message || data.error });
    } catch (err) {
      setEmailTest({ state: "fail", message: err instanceof Error ? err.message : "network error" });
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveStatus("saving");
    setSaveError("");

    const configPatch: any = {
      owner: { name: ownerName, firstName, nameLocal, title, location, timezone, timezoneLabel, bioTagline },
      branding: { siteName, logoText, metaDescription },
      social: { linkedin: linkedin || null, github: github || null },
    };
    const envPatch: Record<string, string> = {};
    if (googleOauthClientId) envPatch.GOOGLE_OAUTH_CLIENT_ID = googleOauthClientId;
    if (googleServiceAccountKey) envPatch.GOOGLE_SERVICE_ACCOUNT_KEY = googleServiceAccountKey;
    if (googleCalendarIds) envPatch.GOOGLE_CALENDAR_IDS = googleCalendarIds;
    if (googleCalendarWriteId) envPatch.GOOGLE_CALENDAR_WRITE_ID = googleCalendarWriteId;
    if (appUrl) envPatch.APP_URL = appUrl;
    if (contactEmail) envPatch.CONTACT_EMAIL = contactEmail;
    if (fromEmail) envPatch.FROM_EMAIL = fromEmail;
    if (openkbsApiKey) envPatch.OPENKBS_API_KEY = openkbsApiKey;

    try {
      const res = await fetch("/api/setup/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: configPatch, env: envPatch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSaveStatus("saved");
      setTimeout(() => navigate("/"), 800);
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "save failed");
    }
  }

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Setup unavailable</h1>
        <p className="text-sm text-foreground/70">
          Couldn't load <code>/api/setup/values</code>: {loadError}. The setup wizard only runs when{" "}
          <code>local/server.mjs</code> is up. Run <code>npm run dev</code>.
        </p>
      </div>
    );
  }

  if (!values) {
    return <div className="p-6 text-sm text-foreground/60">Loading…</div>;
  }

  const envPresent = (k: string) => values.envPresence[k];

  return (
    <div className="flex-1 overflow-y-auto">
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold mb-2">Setup</h1>
          <p className="text-sm text-foreground/70">
            Fill in your identity and the OpenKBS / Google secrets below. Values are
            written to <code>config.json</code> and <code>.env.local</code> in the
            repo root. Restart <code>npm run dev</code> after saving for backend
            handlers to pick up the new env.
          </p>
        </header>

        <Section title="Identity">
          <Field label="Full name" value={ownerName} onChange={setOwnerName} required />
          <Field label="First name (shown in chat)" value={firstName} onChange={setFirstName} required />
          <Field label="Local-script name (optional)" value={nameLocal} onChange={setNameLocal} />
          <Field label="Title" value={title} onChange={setTitle} required placeholder="Senior Software Engineer" />
          <Field label="Location" value={location} onChange={setLocation} required placeholder="Berlin, Germany" />
          <Field label="Timezone (IANA)" value={timezone} onChange={setTimezone} required placeholder="Europe/Berlin" />
          <Field label="Timezone label" value={timezoneLabel} onChange={setTimezoneLabel} placeholder="CET" />
          <Field label="Bio tagline" value={bioTagline} onChange={setBioTagline} />
        </Section>

        <Section title="Branding">
          <Field label="Site name" value={siteName} onChange={setSiteName} required placeholder="Ask Alice" />
          <Field label="Logo text" value={logoText} onChange={setLogoText} placeholder="ASK ALICE" />
          <Field label="Meta description" value={metaDescription} onChange={setMetaDescription} />
        </Section>

        <Section title="Social">
          <Field label="LinkedIn URL" value={linkedin} onChange={setLinkedin} placeholder="https://linkedin.com/in/..." />
          <Field label="GitHub URL" value={github} onChange={setGithub} placeholder="https://github.com/..." />
        </Section>

        <Section
          title="Google"
          subtitle="Service account for Calendar + OAuth client for visitor sign-in."
        >
          <Field
            label="GOOGLE_OAUTH_CLIENT_ID"
            value={googleOauthClientId}
            onChange={setGoogleOauthClientId}
            placeholder={envPresent("GOOGLE_OAUTH_CLIENT_ID") ? "(set — leave blank to keep)" : ""}
          />
          <Field
            label="GOOGLE_SERVICE_ACCOUNT_KEY (base64 of JSON)"
            value={googleServiceAccountKey}
            onChange={setGoogleServiceAccountKey}
            multiline
            placeholder={envPresent("GOOGLE_SERVICE_ACCOUNT_KEY") ? "(set — leave blank to keep)" : ""}
          />
          <Field
            label="GOOGLE_CALENDAR_IDS (comma-separated, read access)"
            value={googleCalendarIds}
            onChange={setGoogleCalendarIds}
            placeholder={envPresent("GOOGLE_CALENDAR_IDS") ? "(set)" : "you@example.com,work@example.com"}
          />
          <Field
            label="GOOGLE_CALENDAR_WRITE_ID (where bookings get written)"
            value={googleCalendarWriteId}
            onChange={setGoogleCalendarWriteId}
            placeholder={envPresent("GOOGLE_CALENDAR_WRITE_ID") ? "(set)" : "you@example.com"}
          />
          <TestRow
            label="Test Calendar access"
            state={calTest}
            onRun={runCalTest}
          />
        </Section>

        <Section
          title="App + Email"
          subtitle="App URL is the public CloudFront origin. FROM must be a verified SES sender."
        >
          <Field label="APP_URL" value={appUrl} onChange={setAppUrl} placeholder={envPresent("APP_URL") ? "(set)" : "https://your-site"} />
          <Field label="CONTACT_EMAIL (where forms land)" value={contactEmail} onChange={setContactEmail} placeholder={envPresent("CONTACT_EMAIL") ? "(set)" : "you@example.com"} />
          <Field label="FROM_EMAIL" value={fromEmail} onChange={setFromEmail} placeholder={envPresent("FROM_EMAIL") ? "(set)" : "no-reply@yourdomain"} />
          <TestRow label="Send test email" state={emailTest} onRun={runEmailTest} />
        </Section>

        <Section title="OpenKBS API">
          <Field
            label="OPENKBS_API_KEY (local dev only — prod injects)"
            value={openkbsApiKey}
            onChange={setOpenkbsApiKey}
            placeholder={envPresent("OPENKBS_API_KEY") ? "(set — leave blank to keep)" : ""}
          />
          <TestRow label="Ping /v1/models" state={llmTest} onRun={runLlmTest} />
        </Section>

        <div className="flex items-center gap-3 border-t border-foreground/10 pt-6">
          <button
            type="submit"
            disabled={saveStatus === "saving"}
            className="rounded-lg bg-accent px-5 py-2.5 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save & continue"}
          </button>
          {saveStatus === "error" && <span className="text-sm text-red-500">{saveError}</span>}
          {saveStatus === "saved" && (
            <span className="text-sm text-foreground/60">
              Redirecting… restart <code>npm run dev</code> if API keys changed.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3 border border-foreground/10 rounded-lg p-4">
      <legend className="px-2 text-sm font-medium text-foreground/80">{title}</legend>
      {subtitle && <p className="text-xs text-foreground/60 -mt-2">{subtitle}</p>}
      {children}
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  const commonClass =
    "rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm outline-none focus:border-accent transition-colors font-mono";
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-foreground/70">{label}{required && " *"}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          rows={4}
          className={commonClass + " resize-y"}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={commonClass}
        />
      )}
    </label>
  );
}

function TestRow({
  label,
  state,
  onRun,
}: {
  label: string;
  state: TestState;
  onRun: () => void;
}) {
  const color =
    state.state === "ok"
      ? "text-green-500"
      : state.state === "fail"
        ? "text-red-500"
        : "text-foreground/60";
  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        type="button"
        onClick={onRun}
        disabled={state.state === "running"}
        className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs hover:bg-foreground/5 disabled:opacity-50 cursor-pointer"
      >
        {state.state === "running" ? "Testing…" : label}
      </button>
      {state.message && <span className={"text-xs " + color}>{state.message}</span>}
    </div>
  );
}
