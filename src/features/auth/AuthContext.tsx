import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as authService from "./authService";
import type { LoginCredentials, SignUpDetails, SignUpResult, User } from "./types";
import { VERIFICATION_REQUIRED_EVENT } from "@/services/api";

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

  // Restore any existing session on first mount. The token is revalidated
  // against the server, so a revoked one signs out rather than lingering.
  useEffect(() => {
    let active = true;

    authService
      .restoreSession()
      .then((restored) => {
        if (active) setUser(restored);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // A reload mid-request must not write state into an unmounted provider.
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const loggedIn = await authService.login(credentials);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const signup = useCallback(async (details: SignUpDetails) => {
    const result = await authService.signup(details);
    setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    setUser(await authService.restoreSession());
  }, []);

  // The server turned a request away because this account has not confirmed
  // its address. Re-read the account rather than guess: the route guard then
  // sends it to verify from the state the server reports.
  useEffect(() => {
    const onVerificationRequired = () => {
      void refreshUser();
    };

    window.addEventListener(VERIFICATION_REQUIRED_EVENT, onVerificationRequired);
    return () => window.removeEventListener(VERIFICATION_REQUIRED_EVENT, onVerificationRequired);
  }, [refreshUser]);

  const verifyEmailCode = useCallback(async (code: string) => {
    const verified = await authService.verifyEmailCode(code);
    setUser(verified);
    return verified;
  }, []);

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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
