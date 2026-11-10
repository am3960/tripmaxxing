import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export type AuthUser = {
  sub: string;
  email: string;
  name: string;
  picture: string;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  signInReady: boolean;
  signIn: () => void;
  logout: () => Promise<void>;
};

type AuthConfig = {
  clientId: string;
  redirectUri: string;
};

const AuthContext = createContext<AuthState | null>(null);
const STATE_KEY = "tripmaxxing_oauth_state";
let pendingExchange: Promise<AuthUser | null> | null = null;

function exchangeCode(code: string) {
  if (!pendingExchange) {
    pendingExchange = fetch("/api/auth/google/code", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { user: AuthUser };
        return data.user;
      })
      .catch(() => null);
  }
  return pendingExchange;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signInReady, setSignInReady] = useState(false);
  const navigate = useNavigate();
  const clientIdRef = useRef("");
  const redirectUriRef = useRef("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const expected = sessionStorage.getItem(STATE_KEY);
    if (code && state && expected && state === expected) {
      sessionStorage.removeItem(STATE_KEY);
      void exchangeCode(code);
    }

    (async () => {
      try {
        const [meRes, configRes] = await Promise.all([
          fetch("/api/auth/me", { credentials: "include" }),
          fetch("/api/auth/config"),
        ]);
        if (configRes.ok) {
          const config = (await configRes.json()) as AuthConfig;
          clientIdRef.current = config.clientId;
          redirectUriRef.current = config.redirectUri;
          if (active) setSignInReady(Boolean(config.clientId && config.redirectUri));
        }
        const exchanged = code && pendingExchange ? await pendingExchange : null;
        const me = meRes.ok ? ((await meRes.json()) as { user: AuthUser | null }) : { user: null };
        const nextUser = exchanged ?? me.user;
        if (!active) return;
        setUser(nextUser);
        if (code) {
          if (nextUser) navigate("/", { replace: true });
          else navigate("/?auth_error=token", { replace: true });
        }
      } catch {
        if (active && code) navigate("/?auth_error=token", { replace: true });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [navigate]);

  const signIn = useCallback(() => {
    const state = crypto.randomUUID();
    sessionStorage.setItem(STATE_KEY, state);
    const params = new URLSearchParams({
      client_id: clientIdRef.current,
      redirect_uri: redirectUriRef.current,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
      access_type: "online",
    });
    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInReady, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function GoogleSignInButton({ className, children }: { className: string; children: ReactNode }) {
  const { signIn, signInReady } = useAuth();
  return (
    <button type="button" className={className} disabled={!signInReady} onClick={signIn}>
      {children}
    </button>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function authErrorMessage(code: string | null) {
  switch (code) {
    case null:
    case "":
      return null;
    case "access_denied":
      return "Google sign-in was cancelled.";
    case "config":
      return "Google sign-in is not configured on the server.";
    case "state":
      return "Google sign-in could not be verified. Start again from the landing page.";
    case "popup":
      return "The Google sign-in window was blocked. Allow popups for this site and try again.";
    case "token":
      return "Google rejected the sign-in. Confirm this OAuth client allows http://localhost:5173, then try again.";
    case "profile":
      return "Google signed you in, but the profile could not be loaded.";
    default:
      return "Google sign-in failed. Try again.";
  }
}
