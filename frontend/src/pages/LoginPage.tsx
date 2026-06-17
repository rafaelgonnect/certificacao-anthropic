import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Credenciais inválidas");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={onSubmit} aria-label="login">
        <div className="auth-brand">
          <span className="brand-mark">C</span>
          <span className="brand-text">
            <b>Colaborativa</b>
            <span>Certificações</span>
          </span>
        </div>
        <h1>Entrar</h1>
        <p className="sub">Acesse sua trilha de certificações Claude.</p>

        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="voce@colaborativa.dev"
            autoComplete="email"
          />
        </label>
        <label>
          Senha
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>

        <button type="submit" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>

        {error && <p role="alert">{error}</p>}

        <p className="hint">Plataforma de certificações da Colaborativa</p>
      </form>
    </div>
  );
}
