import { type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import {
  IconTrack,
  IconCards,
  IconQuiz,
  IconExam,
  IconChart,
  IconLogout,
} from "./icons.js";

const navClass = ({ isActive }: { isActive: boolean }) =>
  "nav-item" + (isActive ? " is-active" : "");

/** Casca das páginas autenticadas: sidebar de navegação + conteúdo (padrão EAD). */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const isGestor = user?.role === "gestor" || user?.role === "admin";
  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="layout">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">C</span>
          <span className="brand-text">
            <b>Colaborativa</b>
            <span>Certificações</span>
          </span>
        </Link>

        <nav className="nav">
          <div className="nav-label">Aprender</div>
          <NavLink to="/" end className={navClass}>
            <IconTrack />
            <span>Certificações</span>
          </NavLink>
          <NavLink to="/revisoes" className={navClass}>
            <IconCards />
            <span>Revisões</span>
          </NavLink>
          <NavLink to="/quiz" className={navClass}>
            <IconQuiz />
            <span>Praticar</span>
          </NavLink>
          <NavLink to="/simulado" className={navClass}>
            <IconExam />
            <span>Simulado</span>
          </NavLink>
          {isGestor && (
            <>
              <div className="nav-label">Gestão</div>
              <NavLink to="/gestor" className={navClass}>
                <IconChart />
                <span>Painel do gestor</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-foot">
          <span className="avatar">{initial}</span>
          <span className="who">
            <b>{user?.name}</b>
            <small>{user?.role}</small>
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={logout}
            aria-label="Sair"
            title="Sair"
          >
            <IconLogout />
          </button>
        </div>
      </aside>

      <div className="content">{children}</div>
    </div>
  );
}
