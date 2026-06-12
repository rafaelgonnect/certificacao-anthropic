import { createContext, useContext, useState, type ReactNode } from "react";
import { api, setToken } from "../api/client.js";
type User = { id: string; email: string; name: string; role: string };
type AuthState = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};
const Ctx = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  async function login(email: string, password: string) {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    setUser(res.user);
  }
  function logout() { setToken(null); setUser(null); }
  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}
export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fora de AuthProvider");
  return ctx;
}
