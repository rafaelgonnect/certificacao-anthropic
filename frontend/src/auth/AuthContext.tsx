import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "../api/client.js";
type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  onboarded: boolean;
  targetCertSlug?: string | null;
  experienceLevel?: string | null;
  dailyGoalMin?: number | null;
};
type AuthState = {
  user: User | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUserData: (u: Partial<User>) => void;
};
const Ctx = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState<boolean>(() => !!getToken());
  useEffect(() => {
    if (!getToken() || user) {
      setInitializing(false);
      return;
    }
    let active = true;
    api<User>("/auth/me")
      .then((u) => {
        if (active) setUser(u);
      })
      .catch(() => {
        setToken(null);
      })
      .finally(() => {
        if (active) setInitializing(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function login(email: string, password: string) {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    setUser(res.user);
  }
  function logout() {
    setToken(null);
    setUser(null);
  }
  function setUserData(u: Partial<User>) {
    setUser((prev) => (prev ? { ...prev, ...u } : prev));
  }
  return (
    <Ctx.Provider value={{ user, initializing, login, logout, setUserData }}>
      {children}
    </Ctx.Provider>
  );
}
export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fora de AuthProvider");
  return ctx;
}
