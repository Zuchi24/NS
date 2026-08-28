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
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore any existing session on first mount.
  useEffect(() => {
    setUser(authService.getCurrentUser());
    setLoading(false);
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

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
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
    }),
    [user, loading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
