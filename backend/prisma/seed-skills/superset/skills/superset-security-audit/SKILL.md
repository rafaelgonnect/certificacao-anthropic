---
name: superset-security-audit
description: Use when asked to security-test, audit, harden, or check the security posture of a live Apache Superset 6.x instance you operate — "teste de segurança no superset", "auditar a instância", "o superset está seguro?", "hardening", "pentest do superset" (defensive, on your own instance). Runs read-only checks for common misconfigurations (TLS/headers, default creds, public registration, anonymous API, public dashboards, DML/file-upload, admin sprawl) and explains how to fix each.
---

# Superset Security Audit (read-only, defensive)

Audits a **Superset instance you own/operate** for common misconfigurations. Strictly
**non-destructive**: HTTP header inspection, a tiny default-credential probe, and
authenticated **read-only** API queries. No data is changed, nothing is exploited, no DoS.

> Use only on instances you are authorized to test. This is defensive hardening, not an
> attack tool.

## Run it
```bash
py references/security_audit.py --url https://superset.example.com --user admin \
   --password ****** --version 6.1.0
```
Exit code = number of FAIL findings (0 = clean). Output grades each check `[OK]/[WARN]/[FAIL]`
by severity (critical/high/medium/low). Pass `--version` (the Superset version, e.g. `6.1.0`)
so it can cross-check known CVEs — remote version detection is best-effort (the version only
appears in a JS-loaded telemetry pixel), so supplying it is recommended.

## Reports (one per run)
Every run also **saves a timestamped report** to `./superset_audit_reports/` (override with
`--out <dir>`; disable with `--no-report`):
- `audit_<host>_<YYYYMMDD_HHMMSS>.html` — styled, shareable (severity badges + summary).
- `audit_<host>_<YYYYMMDD_HHMMSS>.json` — structured findings for tooling/history.

The script prints the absolute paths and the command to open the HTML. **How to open:**
- **Windows:** `start "" "C:\...\audit_....html"` (or double-click the file).
- **macOS:** `open "/.../audit_....html"`  ·  **Linux:** `xdg-open "/.../audit_....html"`
- Or paste the printed `file:///...` URL into any browser.

Keep the dated reports to track posture over time (before/after hardening).

## What it checks
| Check | Why it matters |
|-------|----------------|
| HTTPS / TLS | credentials & tokens must not travel in clear |
| Security headers (CSP, HSTS, X-Content-Type-Options) | XSS/clickjacking/MIME-sniffing defense (Talisman) |
| Clickjacking (`frame-ancestors` / X-Frame-Options) | who may iframe the app |
| **Default credentials** | `admin/admin` & friends must NOT work |
| **Public self-registration** (`/register/`) | anyone creating accounts (`AUTH_USER_REGISTRATION`) |
| Anonymous API access | `/api/v1/*` must require auth |
| Swagger exposed anonymously | info disclosure |
| **Public dashboards** | dashboards attached to the `Public` role |
| `allow_dml` / `allow_file_upload` per database | SQL Lab can mutate data / file ingestion abuse |
| **Admin sprawl** | least privilege — too many Admin accounts |
| Test/default usernames | leftover `test`/`demo`/`guest` accounts |
| **Known CVEs (by version)** | flags CVEs whose fixed-in version is newer than yours |
| **Default/weak SECRET_KEY** (CVE-2023-27524) | forged session cookies → admin takeover (flagged version-independently) |
| CSP weakness | `unsafe-eval`/`unsafe-inline` without `strict-dynamic`, wildcards |
| Session cookie flags | `Secure` + `HttpOnly` + `SameSite` |
| Stack-trace / DEBUG disclosure | verbose errors leaking tracebacks |
| CORS reflection | arbitrary `Origin` reflected back |
| TLS certificate | valid cert on the served domain |

## Vulnerabilities / CVEs
The audit cross-checks the running version against a curated list of high-impact Superset
CVEs (`SUPERSET_CVES` in the script — each with its **fixed-in** version) and flags any whose
fix is newer than your version. Refresh the list from the authoritative source periodically:
**https://superset.apache.org/admin-docs/security/cves/** + the GitHub Security Advisories.

> As of June 2026, **every published Superset CVE is fixed at or before 6.0.0** — a clean
> **6.1.0** install has no known unpatched CVE. The exception always worth checking is the
> **default SECRET_KEY** (CVE-2023-27524): it's a *config* requirement, not a version fix, so
> the audit flags it for manual verification on every run (confirm `SECRET_KEY` is long,
> random and not the documented default). The classes to harden beyond version: strong
> SECRET_KEY, scoped `ENABLE_TEMPLATE_PROCESSING`, admin-only dashboard/dataset **import**,
> SSRF egress controls on DB connections, `FAB_ADD_SECURITY_API` off, strict CSP, simple
> column-equality RLS over free-form `sqlExpression`.

This is a **defensive, read-only** assessment (config + headers + known-CVE mapping), not an
exploit-based pentest. It will not catch a novel/unpublished application bug.

## Fixing common findings
- **Default creds work** (critical) → change the admin password immediately.
- **Registration enabled** → `AUTH_USER_REGISTRATION = False` in `superset_config.py` (rebuild).
- **Public dashboards** → remove the `Public` role from the dashboard (`set_dashboard_roles`) unless truly public.
- **allow_dml** → disable on production DBs unless SQL Lab write is intended; keep it only where needed.
- **Too many admins** → downgrade most users to a limited role (Gamma/custom) via the UI; keep 1–2 real admins. (Role permissions aren't REST-editable on 6.1 — use the UI or `cs_init`.)
- **Missing headers / no HTTPS** → fix the reverse proxy + `TALISMAN_*` / `ENABLE_PROXY_FIX` in config.

## Gotcha (false positives)
A bare `200` on `/register/` is **not** proof registration is on — the 6.x SPA returns 200 for
many routes. The audit confirms a **real registration form** (csrf + first_name + password
fields) before flagging. When extending the script, validate the actual content, never just
the status code.

## Scope notes
- Role-permission depth (e.g. exactly which permissions `Gamma`/`Public` hold) isn't fully
  readable via the 6.1 REST API (`roles` is name-only) — verify those in the UI.
- This audits configuration/exposure, not application-code vulnerabilities. For the Superset
  *codebase*, use a code-focused review instead.
