import { type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { api } from "../api/client.js";
import {
  IconTrack,
  IconCards,
  IconQuiz,
  IconExam,
  IconChart,
  IconLogout,
  IconReplay,
  IconRocket,
  IconUsers,
} from "./icons.js";

const navClass = ({ isActive }: { isActive: boolean }) =>
  "nav-item" + (isActive ? " is-active" : "");

/** Casca das páginas autenticadas: sidebar de navegação + conteúdo (padrão EAD). */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, setUserData } = useAuth();
  const navigate = useNavigate();
  const isGestor = user?.role === "gestor" || user?.role === "admin";
  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase();

  // Reseta o onboarding no backend e volta para a tela de boas-vindas (para testar o fluxo).
  async function refazerOnboarding() {
    try {
      const u = await api<Record<string, unknown>>("/auth/onboarding/reset", { method: "POST" });
      setUserData({ ...(u as object), onboarded: false });
    } catch {
      setUserData({ onboarded: false });
    }
    navigate("/bem-vindo");
  }

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

          <div className="nav-label">Jogar</div>
          <NavLink to="/jogo" className={navClass}>
            <IconRocket />
            <span>Minha Startup</span>
          </NavLink>
          {isGestor && (
            <>
              <div className="nav-label">Gestão</div>
              <NavLink to="/gestor" className={navClass}>
                <IconChart />
                <span>Painel do gestor</span>
              </NavLink>
              <NavLink to="/admin/usuarios" className={navClass}>
                <IconUsers />
                <span>Usuários</span>
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
            onClick={refazerOnboarding}
            aria-label="Refazer onboarding"
            title="Refazer onboarding"
          >
            <IconReplay />
          </button>
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
