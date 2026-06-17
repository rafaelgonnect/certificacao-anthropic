import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

/** Casca visual das páginas autenticadas: header com a marca Colaborativa + usuário. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">C</span>
          <span className="brand-text">
            Colaborativa <strong>Certificações</strong>
          </span>
        </Link>
        {user && (
          <div className="topbar-user">
            <span className="user-name">{user.name}</span>
            <button type="button" className="btn-ghost" onClick={logout}>
              Sair
            </button>
          </div>
        )}
      </header>
      <div className="app-content">{children}</div>
    </div>
  );
}
