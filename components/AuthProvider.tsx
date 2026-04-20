"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type Role = "player" | "captain" | "admin" | null;

type LoginSuccess = { ok: true; role: Exclude<Role, null>; scope: string | null };
type LoginFailure = { ok: false; error: string };
export type LoginResult = LoginSuccess | LoginFailure;

type AuthState = {
  role: Role;
  scope: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [scope, setScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setRole(data.role ?? null);
      setScope(data.scope ?? null);
    } catch {
      setRole(null);
      setScope(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (password: string): Promise<LoginResult> => {
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error ?? "Incorrect password" };
      }
      setRole(data.role);
      setScope(data.scope ?? null);
      return { ok: true, role: data.role, scope: data.scope ?? null };
    } catch {
      return { ok: false, error: "Network error" };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setRole(null);
    setScope(null);
  }, []);

  return (
    <AuthContext.Provider value={{ role, scope, loading, refresh, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
