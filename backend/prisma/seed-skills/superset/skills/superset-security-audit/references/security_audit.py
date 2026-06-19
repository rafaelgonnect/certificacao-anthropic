"""security_audit.py — read-only defensive security audit of an Apache Superset 6.x instance.

Checks common misconfigurations on an instance you OWN/operate. Non-destructive:
no data is changed, no DoS, no exploitation — only HTTP header inspection, a tiny
default-credential probe, and authenticated read-only API queries.

Usage:
    py security_audit.py --url https://superset.example.com --user admin --password ******

Exit code = number of FAIL findings (0 = clean). Requires: httpx.
"""
from __future__ import annotations
import argparse, json, sys, os, html, re
from datetime import datetime
import httpx

R = []  # findings: (severity, status, id, detail)
def add(sev, status, id_, detail): R.append((sev, status, id_, detail))

PASS, WARN, FAIL = "PASS", "WARN", "FAIL"
DETECTED_VERSION = None

# Known high-impact Apache Superset CVEs -> "fixed in" version. A running version
# >= fixed_in is NOT affected. (Curated; cross-check GitHub Security Advisories for
# anything newer than your version.) Source: github.com/apache/superset/security/advisories
SUPERSET_CVES = [
    ("CVE-2023-27524", "Sessão forjável via SECRET_KEY padrão (takeover)", "2.1.0", "critical"),
    ("CVE-2024-53947", "Bypass de autorização SQL (Postgres)", "4.1.0", "critical"),
    ("CVE-2024-39887", "Bypass de autorização SQL", "4.0.2", "high"),
    ("CVE-2023-37941", "RCE via metadata DB (pickle)", "2.1.1", "high"),
    ("CVE-2025-27696", "Takeover de ownership de objeto (authz)", "4.1.2", "high"),
    ("CVE-2026-23984", "Bypass read-only no SQL Lab (Postgres) -> DML", "6.0.0", "medium"),
    ("CVE-2026-23982", "Bypass de authz na criação de dataset", "6.0.0", "medium"),
    ("CVE-2026-23980", "SQL injection via sqlExpression/where", "6.0.0", "medium"),
    ("CVE-2026-23983", "Exposição de hashes de senha via Tags", "6.0.0", "medium"),
    ("CVE-2025-48912", "Bypass de RLS via SQLi em sqlExpression", "4.1.2", "medium"),
    ("CVE-2025-55672", "Stored XSS em label de coluna", "4.1.3", "medium"),
    ("CVE-2024-34693", "Leitura arbitrária de arquivo no servidor", "4.0.1", "medium"),
    ("CVE-2024-53949", "Escalação: criar Role via security API", "4.1.0", "medium"),
    ("CVE-2023-39265", "SSRF / bypass de URI SQLite", "2.1.1", "medium"),
    ("CVE-2023-36388", "SSRF via API de import/dataset", "2.1.1", "medium"),
]


def _ver_tuple(v):
    try:
        return tuple(int(x) for x in v.split(".")[:3])
    except Exception:
        return None


def unauth_checks(base):
    c = httpx.Client(timeout=30, follow_redirects=False)
    # TLS
    if base.startswith("https://"):
        add("high", PASS, "tls", "instância servida por HTTPS")
        try:
            httpx.get(base.replace("https://", "http://", 1) + "/health", timeout=15, follow_redirects=False)
        except Exception:
            pass
    else:
        add("high", FAIL, "tls", "instância NÃO usa HTTPS — tráfego/credenciais em claro")

    # Security headers on the login page
    r = c.get(f"{base}/login/")
    h = {k.lower(): v for k, v in r.headers.items()}
    checks = {
        "content-security-policy": ("csp", "high", "CSP ausente — Talisman desligado? (clickjacking/XSS)"),
        "strict-transport-security": ("hsts", "medium", "HSTS ausente — sem força de HTTPS no browser"),
        "x-content-type-options": ("xcto", "low", "X-Content-Type-Options ausente (MIME sniffing)"),
    }
    for header, (cid, sev, msg) in checks.items():
        if header in h:
            add(sev, PASS, cid, f"{header} presente")
        else:
            add(sev, WARN if sev != "high" else FAIL, cid, msg)
    # frame protection (CSP frame-ancestors OR X-Frame-Options)
    if "frame-ancestors" in h.get("content-security-policy", "") or "x-frame-options" in h:
        add("medium", PASS, "clickjacking", "proteção contra clickjacking presente (frame-ancestors/XFO)")
    else:
        add("medium", FAIL, "clickjacking", "sem frame-ancestors nem X-Frame-Options — embed por qualquer site")

    # Server/version disclosure
    srv = h.get("server", "")
    add("low", WARN if srv and srv.lower() not in ("", "openresty") else PASS,
        "server_header", f"Server header = '{srv or '(oculto)'}'")

    # Public self-registration — require a REAL registration form (not just a 200
    # from the SPA shell, which is a false positive).
    rr = c.get(f"{base}/register/")
    body = rr.text.lower()
    real_form = ("csrf_token" in body and "first_name" in body
                 and ("password" in body or "recaptcha" in body))
    if rr.status_code == 200 and real_form:
        add("high", FAIL, "registration", "auto-registro de usuários HABILITADO (/register/) — qualquer um cria conta")
    else:
        add("high", PASS, "registration", "auto-registro desabilitado")

    # Anonymous API access
    a = c.get(f"{base}/api/v1/dashboard/")
    if a.status_code in (401, 403):
        add("high", PASS, "anon_api", "API exige autenticação (401/403 anônimo)")
    else:
        add("high", FAIL, "anon_api", f"/api/v1/dashboard/ respondeu {a.status_code} sem auth")

    # Swagger exposed unauthenticated
    sw = c.get(f"{base}/swagger/v1")
    add("low", WARN if sw.status_code == 200 else PASS, "swagger",
        "Swagger acessível sem auth (info disclosure)" if sw.status_code == 200 else "Swagger não exposto anonimamente")


def vuln_checks(base, version_override=None):
    """Read-only technical vulnerability checks (no exploitation)."""
    global DETECTED_VERSION
    c = httpx.Client(timeout=30, follow_redirects=False)
    r = c.get(f"{base}/login/")
    body, h = r.text, {k.lower(): v for k, v in r.headers.items()}

    # Version: prefer the operator-supplied --version; else try to detect from the
    # page (the telemetry pixel carries it but loads via JS, so detection is best-effort).
    m = (re.search(r"scarf\.sh/pixel/[^/]+/(\d+\.\d+\.\d+)", body)
         or re.search(r"version[\"']?\s*[:=]\s*[\"'](\d+\.\d+\.\d+)", body))
    DETECTED_VERSION = version_override or (m.group(1) if m else None)
    src = "informada" if version_override else ("detectada" if DETECTED_VERSION else "")
    add("low", PASS if DETECTED_VERSION else WARN, "version",
        f"versão {src}: {DETECTED_VERSION}" if DETECTED_VERSION
        else "versão desconhecida — passe --version 6.1.0 p/ cruzar CVEs")

    # CSP weakness analysis
    csp = h.get("content-security-policy", "")
    if csp:
        weak = []
        if "'unsafe-eval'" in csp:
            weak.append("'unsafe-eval'")
        if "'unsafe-inline'" in csp and "'strict-dynamic'" not in csp:
            weak.append("'unsafe-inline' sem strict-dynamic")
        seg = csp.split("script-src", 1)[1].split(";")[0] if "script-src" in csp else ""
        if "*" in seg and "strict-dynamic" not in seg:
            weak.append("wildcard em script-src")
        add("medium", WARN if weak else PASS, "csp_weak",
            (f"CSP com diretivas fracas: {', '.join(weak)}" +
             (" (strict-dynamic presente mitiga inline)" if "'strict-dynamic'" in csp else ""))
            if weak else "CSP sem diretivas obviamente fracas")

    # Session cookie flags
    cookies = r.headers.get_list("set-cookie") if hasattr(r.headers, "get_list") else \
        ([r.headers["set-cookie"]] if "set-cookie" in r.headers else [])
    sess = [x for x in cookies if "session=" in x.lower()]
    if sess:
        ck = sess[0].lower()
        miss = [f for f, t in (("Secure", "secure"), ("HttpOnly", "httponly"), ("SameSite", "samesite")) if t not in ck]
        add("medium", WARN if miss else PASS, "cookie_flags",
            f"cookie de sessão sem: {', '.join(miss)}" if miss else "cookie de sessão com Secure+HttpOnly+SameSite")
    else:
        add("low", PASS, "cookie_flags", "sem cookie de sessão em /login (setado no login real)")

    # Stack-trace / verbose-error disclosure (DEBUG)
    leaks = False
    for path in ("/api/v1/zz_nao_existe_zz", "/superset/zz_nao_existe_zz"):
        t = c.get(f"{base}{path}").text
        if "Traceback (most recent call last)" in t or "Werkzeug Debugger" in t or "werkzeug.exceptions" in t:
            leaks = True
    add("critical", FAIL if leaks else PASS, "trace_disclosure",
        "stack trace exposto (DEBUG ligado?)" if leaks else "nenhum stack trace exposto")

    # CORS reflection of arbitrary origin
    evil = "https://evil.example.org"
    acao = c.get(f"{base}/api/v1/_info", headers={"Origin": evil}).headers.get("access-control-allow-origin", "")
    if acao == "*" or acao == evil:
        add("high", FAIL, "cors", f"CORS reflete origem arbitrária (ACAO={acao})")
    else:
        add("low", PASS, "cors", "CORS não reflete origem arbitrária")

    # TLS certificate validity
    try:
        httpx.get(f"{base}/health", verify=True, timeout=15)
        add("high", PASS, "tls_cert", "certificado TLS válido")
    except Exception as e:
        bad = "cert" in str(e).lower() or "ssl" in str(e).lower()
        add("high" if bad else "low", FAIL if bad else WARN, "tls_cert",
            f"{'certificado TLS inválido' if bad else 'TLS não verificado'}: {str(e)[:70]}")

    # CVE-2023-27524 (default SECRET_KEY) — not safely testable; manual verify
    add("high", WARN, "secret_key",
        "VERIFICAR: SECRET_KEY não é o default conhecido (CVE-2023-27524: forja de sessão→admin)")


def cve_check():
    """Map the detected version to known CVE fix versions."""
    v = _ver_tuple(DETECTED_VERSION) if DETECTED_VERSION else None
    if not v:
        add("medium", WARN, "cve", "versão desconhecida — não foi possível cruzar CVEs; cheque GitHub Security Advisories")
        return
    affected = [(cid, title, fixed, sev) for cid, title, fixed, sev in SUPERSET_CVES
                if _ver_tuple(fixed) and v < _ver_tuple(fixed)]
    if affected:
        for cid, title, fixed, sev in affected:
            add(sev, FAIL, "cve", f"{cid}: {title} — corrigido em {fixed}, você roda {DETECTED_VERSION}. ATUALIZE.")
    else:
        add("low", PASS, "cve",
            f"v{DETECTED_VERSION}: além do fix de todos os CVEs conhecidos da lista — confira advisories > 6.x no GitHub")


def default_cred_probe(base):
    # tiny, defensive: only flags if a well-known default WORKS.
    defaults = [("admin", "admin"), ("admin", "admin123"), ("admin", "superset"), ("admin", "password")]
    c = httpx.Client(timeout=20)
    for u, p in defaults:
        try:
            r = c.post(f"{base}/api/v1/security/login",
                       json={"username": u, "password": p, "provider": "db", "refresh": True})
            if r.status_code == 200 and "access_token" in r.json():
                add("critical", FAIL, "default_creds", f"CREDENCIAL PADRÃO FUNCIONA: {u}/{p} — troque já")
                return
        except Exception:
            pass
    add("critical", PASS, "default_creds", "nenhuma credencial padrão comum funciona")


class Adm:
    def __init__(self, base, u, p):
        self.base, self.c = base, httpx.Client(timeout=40)
        r = self.c.post(f"{base}/api/v1/security/login",
                        json={"username": u, "password": p, "provider": "db", "refresh": True})
        r.raise_for_status()
        self.tok = r.json()["access_token"]

    def get(self, path):
        r = self.c.get(f"{self.base}{path}", headers={"Authorization": f"Bearer {self.tok}"})
        r.raise_for_status()
        return r.json()


def auth_checks(adm):
    # Public dashboards (Public role attached)
    ds = adm.get("/api/v1/dashboard/?q=(page_size:100)")
    pub = [d["dashboard_title"] for d in ds["result"]
           if any((r.get("name") == "Public") for r in (d.get("roles") or []))]
    if pub:
        add("high", FAIL, "public_dashboards", f"{len(pub)} dashboard(s) público(s) p/ a role Public: {pub[:5]}")
    else:
        add("high", PASS, "public_dashboards", "nenhum dashboard exposto à role Public")

    # Databases: DML / file upload / sqllab exposure
    dbs = adm.get("/api/v1/database/?q=(page_size:100)")["result"]
    dml = [d["database_name"] for d in dbs if d.get("allow_dml")]
    upl = [d["database_name"] for d in dbs if d.get("allow_file_upload")]
    if dml:
        add("medium", WARN, "allow_dml", f"DML habilitado em: {dml} — SQL Lab pode alterar dados")
    else:
        add("medium", PASS, "allow_dml", "nenhum database com DML habilitado")
    if upl:
        add("low", WARN, "file_upload", f"upload de arquivo habilitado em: {upl}")
    else:
        add("low", PASS, "file_upload", "upload de arquivo desabilitado")

    # Users / admins
    try:
        us = adm.get("/api/v1/security/users/?q=(page_size:100)")["result"]
        admins = [u["username"] for u in us
                  if any(r.get("name") == "Admin" for r in (u.get("roles") or []))]
        suspicious = [u["username"] for u in us
                      if u["username"].lower() in ("test", "demo", "guest", "user", "superset")]
        add("low", PASS, "users", f"{len(us)} usuário(s), {len(admins)} admin(s)")
        if len(admins) > 2:
            add("medium", WARN, "too_many_admins",
                f"{len(admins)} contas Admin ({admins}) — princípio do menor privilégio: a maioria deveria ter role limitada")
        if suspicious:
            add("medium", WARN, "test_users", f"usuários suspeitos de teste: {suspicious}")
    except Exception as e:
        add("low", WARN, "users", f"não foi possível listar usuários ({str(e)[:60]})")

    # Embedding feature flag (from /api/v1/menu or bootstrap is limited; note)
    add("low", PASS, "note_embed", "RLS/embed: confirme que datasets embedados têm RLS (ver superset-embedding)")


_SEV_COLOR = {"critical": "#b3093c", "high": "#cf3b4c", "medium": "#c47d12", "low": "#5b6678"}
_ST_COLOR = {"FAIL": "#cf3b4c", "WARN": "#c47d12", "PASS": "#1a9d6a"}


def write_reports(base, out_dir, nf, nw):
    os.makedirs(out_dir, exist_ok=True)
    host = re.sub(r"[^a-z0-9]+", "-", base.split("://")[-1].lower()).strip("-")
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    when = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    stem = os.path.join(out_dir, f"audit_{host}_{stamp}")

    findings = [{"severity": s, "status": st, "check": cid, "detail": d} for s, st, cid, d in R]
    summary = {"instance": base, "generated_at": when,
               "fail": nf, "warn": nw, "ok": len(R) - nf - nw, "findings": findings}
    json_path = stem + ".json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    rows = "\n".join(
        f'<tr><td><span class="b" style="background:{_ST_COLOR[st]}">{st}</span></td>'
        f'<td><span class="sev" style="color:{_SEV_COLOR.get(s,"#5b6678")}">{s}</span></td>'
        f'<td><code>{html.escape(cid)}</code></td><td>{html.escape(d)}</td></tr>'
        for s, st, cid, d in R)
    verdict = ("SEM falhas críticas" if nf == 0 else f"{nf} FALHA(S) a corrigir")
    vcolor = "#1a9d6a" if nf == 0 else "#cf3b4c"
    html_path = stem + ".html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(f"""<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Auditoria de Segurança — Superset</title><style>
body{{font-family:Inter,system-ui,Arial,sans-serif;background:#f4f6fa;color:#16223b;margin:0;padding:30px}}
.card{{max-width:1000px;margin:0 auto;background:#fff;border:1px solid #e5eaf1;border-radius:14px;padding:28px 32px}}
h1{{margin:0 0 4px;font-size:22px}} .sub{{color:#5b6678;font-size:13px;margin-bottom:18px}}
.summary{{font-size:18px;font-weight:700;color:{vcolor};margin:10px 0 18px}}
.kpi{{display:inline-block;border-radius:999px;padding:4px 14px;margin-right:8px;font-size:13px;font-weight:600;color:#fff}}
table{{border-collapse:collapse;width:100%;font-size:13.5px;margin-top:8px}}
th,td{{border:1px solid #e5eaf1;padding:8px 11px;text-align:left;vertical-align:top}}
th{{background:#eef3f8}} code{{background:#eef2f7;border-radius:4px;padding:1px 5px;font-family:ui-monospace,Consolas,monospace}}
.b{{color:#fff;border-radius:5px;padding:2px 8px;font-size:11.5px;font-weight:700}}
.sev{{font-weight:600;text-transform:uppercase;font-size:11px}}
footer{{color:#97a1b3;font-size:11.5px;margin-top:18px}}
</style></head><body><div class="card">
<h1>🔒 Auditoria de Segurança — Apache Superset</h1>
<div class="sub">Instância: <b>{html.escape(base)}</b> · gerado em {when}</div>
<div class="summary">{verdict}</div>
<div>
  <span class="kpi" style="background:#cf3b4c">{nf} FAIL</span>
  <span class="kpi" style="background:#c47d12">{nw} WARN</span>
  <span class="kpi" style="background:#1a9d6a">{len(R)-nf-nw} OK</span>
</div>
<table><tr><th>Status</th><th>Severidade</th><th>Check</th><th>Detalhe</th></tr>
{rows}
</table>
<footer>Auditoria read-only (não-destrutiva). superset-security-audit · Superset Colaborativa.</footer>
</div></body></html>""")
    return json_path, html_path


def main():
    try:  # make console output UTF-8 safe on Windows (cp1252)
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--user", default="admin")
    ap.add_argument("--password", required=True)
    ap.add_argument("--out", default="superset_audit_reports",
                    help="pasta onde salvar os relatórios (default: ./superset_audit_reports)")
    ap.add_argument("--no-report", action="store_true", help="não salvar arquivos de relatório")
    ap.add_argument("--version", default=None,
                    help="versão do Superset (ex: 6.1.0) p/ cruzar CVEs (detecção remota é best-effort)")
    a = ap.parse_args()
    base = a.url.rstrip("/")

    print(f"== Auditoria de segurança (read-only) — {base} ==\n")
    unauth_checks(base)
    vuln_checks(base, a.version)
    cve_check()
    default_cred_probe(base)
    try:
        auth_checks(Adm(base, a.user, a.password))
    except Exception as e:
        add("high", WARN, "auth", f"checks autenticados pulados: {str(e)[:80]}")

    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    R.sort(key=lambda x: (0 if x[1] == FAIL else 1 if x[1] == WARN else 2, order.get(x[0], 9)))
    nf = nw = 0
    for sev, status, id_, detail in R:
        mark = {"PASS": "[OK]  ", "WARN": "[WARN]", "FAIL": "[FAIL]"}[status]
        print(f"{mark} ({sev:8}) {id_:18} {detail}")
        nf += status == FAIL; nw += status == WARN
    print(f"\nResumo: {nf} FAIL, {nw} WARN, {len(R)-nf-nw} OK")

    if not a.no_report:
        jp, hp = write_reports(base, a.out, nf, nw)
        hp_abs = os.path.abspath(hp)
        opener = ("start" if sys.platform.startswith("win")
                  else "open" if sys.platform == "darwin" else "xdg-open")
        print(f"\nRelatórios salvos:")
        print(f"  HTML: {hp_abs}")
        print(f"  JSON: {os.path.abspath(jp)}")
        print(f"\nPara abrir o HTML no navegador:")
        if sys.platform.startswith("win"):
            print(f"  start \"\" \"{hp_abs}\"")
        else:
            print(f"  {opener} \"{hp_abs}\"")
        print(f"  (ou abra o arquivo: file:///{hp_abs.replace(os.sep, '/')})")

    sys.exit(nf)


if __name__ == "__main__":
    main()
