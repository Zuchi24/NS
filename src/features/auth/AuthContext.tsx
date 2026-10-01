import { Fragment, createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as authService from "./authService";
import type { LoginCredentials, SignUpDetails, SignUpResult, User } from "./types";
import { UNAUTHENTICATED_EVENT, VERIFICATION_REQUIRED_EVENT } from "@/services/api";

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** True until the persisted session has been read, so guards don't redirect early. */
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  signup: (details: SignUpDetails) => Promise<SignUpResult>;
  logout: () => Promise<void>;
  /**
   * Re-reads the user from the server, after something changed their profile.
   * The one way the signed-in user is refreshed; it goes through the same
   * session restore as a page load, so a server that cannot be reached keeps
   * the cached user rather than signing anyone out.
   */
  refreshUser: () => Promise<void>;
  /** Checks an emailed code; the signed-in user becomes the verified one it returns. */
  verifyEmailCode: (code: string) => Promise<User>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Bumped when a different account replaces the one on screen, so that no page
  // still mounted goes on showing the old account's data under the new name.
  const [generation, setGeneration] = useState(0);

  // What the screen is showing now, readable from a listener without stale state.
  const shown = useRef<User | null>(null);

  // Which answer to "who is signed in?" is the newest. Every path that can
  // change the answer takes a ticket, and a slower, older answer that arrives
  // after a newer one is dropped rather than allowed to overwrite it.
  const version = useRef(0);

  const show = useCallback((next: User | null) => {
    const previous = shown.current;

    if (previous && next && previous.id !== next.id) {
      setGeneration((count) => count + 1);
    }

    shown.current = next;
    setUser(next);
  }, []);

  // Restore any existing session on first mount. The token is revalidated
  // against the server, so a revoked one signs out rather than lingering.
  useEffect(() => {
    let active = true;
    const ticket = ++version.current;

    authService
      .restoreSession()
      .then((restored) => {
        if (active && ticket === version.current) show(restored);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [show]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const loggedIn = await authService.login(credentials);
      version.current += 1;
      show(loggedIn);
      return loggedIn;
    },
    [show],
  );

  const signup = useCallback(
    async (details: SignUpDetails) => {
      const result = await authService.signup(details);
      version.current += 1;
      show(result.user);
      return result;
    },
    [show],
  );

  const logout = useCallback(async () => {
    await authService.logout();
    version.current += 1;
    show(null);
  }, [show]);

  const refreshUser = useCallback(async () => {
    const ticket = ++version.current;
    const restored = await authService.restoreSession();
    if (ticket === version.current) show(restored);
  }, [show]);

  /*
   * One account per browser profile.
   *
   * Another tab signing in or out changes the session under this one, and this
   * tab is not told by anything but the browser's `storage` event. The token is
   * read afresh for every request while the name on screen is state, so left
   * alone the two part company: the screen keeps the old account and the
   * requests go out as the new one.
   *
   * planSessionSync decides whether anything actually changed, and drops a
   * token private to this tab when it must yield. An echo — this tab's own
   * session, or a change that leaves the same token — plans nothing, takes no
   * ticket and asks nothing of the server.
   */
  const reconcile = useCallback(async () => {
    const plan = authService.planSessionSync();

    if (plan === null) return;

    const ticket = ++version.current;

    if (plan === "signed-out") {
      show(null);
      return;
    }

    const restored = await authService.restoreSession();
    if (ticket === version.current) show(restored);
  }, [show]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      // Only the shared store speaks across tabs; a tab's own is not ours to read.
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      if (!authService.concernsSession(event.key)) return;

      void reconcile();
    };

    // The token was refused, so the account it belonged to must not stay on
    // screen. Deliberately not for a 403: that is a refusal to do something,
    // not the end of the session.
    const onUnauthenticated = () => {
      authService.forgetUser();
      version.current += 1;
      show(null);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    };
  }, [reconcile, show]);

  useEffect(() => {
    const onVerificationRequired = () => {
      void refreshUser();
    };

    window.addEventListener(VERIFICATION_REQUIRED_EVENT, onVerificationRequired);
    return () => window.removeEventListener(VERIFICATION_REQUIRED_EVENT, onVerificationRequired);
  }, [refreshUser]);

  const verifyEmailCode = useCallback(
    async (code: string) => {
      const verified = await authService.verifyEmailCode(code);
      version.current += 1;
      show(verified);
      return verified;
    },
    [show],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isAdmin: user?.role === "admin",
      loading,
      login,
      signup,
      logout,
      refreshUser,
      verifyEmailCode,
    }),
    [user, loading, login, signup, logout, refreshUser, verifyEmailCode]
  );

  return (
    <AuthContext.Provider value={value}>
      <Fragment key={generation}>{children}</Fragment>
    </AuthContext.Provider>
  );
}
