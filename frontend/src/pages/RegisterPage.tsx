import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { Cockatiel } from "../components/Cockatiel.js";

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      setDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg === "email in use" ? "Este email já está cadastrado." : "Não foi possível criar a conta. Verifique os dados (senha de 8+ caracteres).");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="auth">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <Cockatiel mood="cheer" size={150} />
          <h1>Conta criada! 🎉</h1>
          <p className="sub">
            Sua conta está <strong>aguardando a liberação</strong> de um administrador. Assim que for
            aprovada, você poderá entrar e começar.
          </p>
          <Link to="/login" className="btn btn-block" style={{ marginTop: "0.6rem" }}>
            Voltar para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={onSubmit} aria-label="cadastro">
        <div className="auth-brand">
          <span className="brand-mark">C</span>
          <span className="brand-text">
            <b>Colaborativa</b>
            <span>Certificações</span>
          </span>
        </div>
        <h1>Criar conta</h1>
        <p className="sub">Cadastre-se para estudar as certificações da Anthropic.</p>

        <label>
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Seu nome" />
        </label>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="voce@email.com" autoComplete="email" />
        </label>
        <label>
          Senha
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="mínimo 8 caracteres" autoComplete="new-password" />
        </label>

        <button type="submit" disabled={busy}>
          {busy ? "Criando…" : "Criar conta"}
        </button>

        {error && <p role="alert">{error}</p>}

        <p className="hint">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
