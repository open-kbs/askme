import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { config } from "../config";

type Status = "loading" | "authenticated" | "unauthenticated" | "no_client_id";

export type SessionUser = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

type SessionData = {
  idToken: string;
  user: SessionUser;
  expiresAt: number;
};

type SessionContextValue = {
  status: Status;
  data: SessionData | null;
  signOut: () => void;
  renderGisButton: (el: HTMLElement | null) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
          disableAutoSelect: () => void;
          prompt: () => void;
        };
      };
    };
  }
}

const STORAGE_KEY = config.branding.sessionStorageKey;

function decodeJwt(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function sessionFromIdToken(idToken: string): SessionData | null {
  const payload = decodeJwt(idToken);
  if (!payload || typeof payload !== "object") return null;
  const exp = typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  if (!exp || exp < Date.now()) return null;
  const sub = payload.sub;
  const email = payload.email;
  if (typeof sub !== "string" || typeof email !== "string") return null;
  return {
    idToken,
    expiresAt: exp,
    user: {
      sub,
      email,
      name: typeof payload.name === "string" ? payload.name : undefined,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    },
  };
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [data, setData] = useState<SessionData | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const restored = sessionFromIdToken(raw);
    if (!restored) window.sessionStorage.removeItem(STORAGE_KEY);
    return restored;
  });

  const clientId = import.meta.env.GOOGLE_OAUTH_CLIENT_ID || undefined;

  const handleCredential = useCallback((response: { credential: string }) => {
    const next = sessionFromIdToken(response.credential);
    if (!next) return;
    window.sessionStorage.setItem(STORAGE_KEY, response.credential);
    setData(next);
  }, []);

  // Wait for the GIS script (loaded via index.html), then initialize once.
  // Must complete before SignInButton calls renderButton — otherwise GSI logs
  // "Failed to render button before calling initialize()". `initialized` is
  // flipped AFTER initialize so the status transition gates button render.
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const tryInit = () => {
      if (cancelled) return true;
      const id = window.google?.accounts?.id;
      if (!id) return false;
      id.initialize({
        client_id: clientId,
        callback: handleCredential,
        auto_select: false,
        use_fedcm_for_prompt: true,
      });
      setInitialized(true);
      return true;
    };
    if (tryInit()) return;
    const interval = window.setInterval(() => {
      if (tryInit()) window.clearInterval(interval);
    }, 100);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [clientId, handleCredential]);

  // Auto-expire.
  useEffect(() => {
    if (!data) return;
    const ms = data.expiresAt - Date.now();
    if (ms <= 0) {
      setData(null);
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const t = window.setTimeout(() => {
      setData(null);
      window.sessionStorage.removeItem(STORAGE_KEY);
    }, ms);
    return () => window.clearTimeout(t);
  }, [data]);

  const signOut = useCallback(() => {
    window.sessionStorage.removeItem(STORAGE_KEY);
    setData(null);
    window.google?.accounts.id.disableAutoSelect();
  }, []);

  const renderGisButton = useCallback(
    (el: HTMLElement | null) => {
      if (!el || !initialized) return;
      el.innerHTML = "";
      window.google!.accounts.id.renderButton(el, {
        theme: "filled_blue",
        size: "large",
        type: "standard",
        shape: "pill",
        text: "signin_with",
        logo_alignment: "left",
        width: 200,
      });
    },
    [initialized],
  );

  const status: Status = !clientId ? "no_client_id" : !initialized ? "loading" : data ? "authenticated" : "unauthenticated";

  const value = useMemo<SessionContextValue>(
    () => ({ status, data, signOut, renderGisButton }),
    [status, data, signOut, renderGisButton],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

/**
 * Helper for protected fetches — attaches the id_token as a Bearer header.
 * If the session expired, returns a 401-like Response so callers can prompt
 * the user to re-sign-in without crashing.
 */
export function useAuthedFetch() {
  const { data } = useSession();
  const ref = useRef(data);
  ref.current = data;
  return useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const session = ref.current;
      if (!session) {
        return new Response(JSON.stringify({ error: "not_authenticated" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${session.idToken}`);
      return fetch(input, { ...init, headers });
    },
    [],
  );
}
