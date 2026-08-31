import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as authService from "./authService";
import type { LoginCredentials, SignUpDetails, User } from "./types";

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** True until the persisted session has been read, so guards don't redirect early. */
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  signup: (details: SignUpDetails) => Promise<User>;
  logout: () => Promise<void>;
  /** Re-reads the user from the server, after something changed their profile. */
  refreshUser: () => Promise<void>;
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
    const created = await authService.signup(details);
    setUser(created);
    return created;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    setUser(await authService.restoreSession());
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
    }),
    [user, loading, login, signup, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
