---
name: superset-dev-rules
description: Use whenever DEVELOPING on the Superset Colaborativa stack — building or editing Superset datasets/charts/dashboards, setting up RLS/embedding, designing/theming, deploying the YML, or writing an app that consumes Superset. Establishes the team's best-practice rules and points to the current Apache Superset 6.x documentation so the work follows known-good patterns and avoids the documented traps.
---

# Superset Colaborativa — Development Rules

These are the **rules of engagement** for building anything on the Superset Colaborativa
stack. Apply them proactively; they encode hard-won gotchas. When a task matches a companion
skill, **use that skill** — this one is the umbrella that says *which* rules and *which* skill.

## Companion skills — reach for the right one
| Task | Skill |
|------|-------|
| Build/inspect databases, datasets, charts, dashboards, SQL | `superset-agent` |
| Make it look good: chart design, theming, CSS, blank-page/"No data" debugging | `superset-frontend-design` |
| Multi-tenant RLS, guest tokens, who-sees-what | `superset-embedding` |
| Embed into a Django app | `django-superset-embed` |

## Hard rules (do / don't)

1. **Never hand-build legacy viz_types** (`dist_bar`, `bar`, `line`, `area`, `dual_line`) — removed in 6.0, they save but don't render. Use `create_simple_chart` (picks modern ECharts ids) or the `*_v2`/`echarts_*` keys.
2. **Verify before claiming done.** After building: `render_check_dashboard` (static) **and** a real browser screenshot (`superset-frontend-design/references/playwright_inspect.py`). API success ≠ render success.
3. **Secrets stay in env.** Admin password, JWT secrets, API keys → environment variables, never in code, VCS, or a shared ZIP. Rotate anything that leaked.
4. **Multi-tenant = server-side tenant + RLS.** The tenant value (e.g. `escola_id`, `codigo_ibge`) comes from `request.user` / the server, NEVER from the client. One dashboard serves all tenants; RLS does the isolation. Don't duplicate dashboards per tenant.
5. **Embedding uses the embedded UUID**, not the numeric dashboard id, in `resources[].id`. Let the Embedded SDK send chart requests — a guest sending a custom payload gets `403 "cannot modify chart payload"`.
6. **Role permissions are NOT editable via REST on Superset 6.1** (roles API is name-only). Create roles with `create_role`; grant permissions in the UI or the deploy's `cs_init` bootstrap (the `embed` role is handled there).
7. **Layout reality:** the dashboard grid height unit is **~8px** (not ~50px); a markdown block clips text unless its height ≥ ~20 for a heading + 4 lines. Size to content and screenshot.
8. **Config baked into the image needs a rebuild**, not just a restart. Never reuse the old `SECRET_KEY`; always set a non-empty `LANGUAGES` (else the 6.x UI goes blank).
9. **Data modeling for the education product:** every dataset that will be embedded multi-tenant carries a tenant key column (`codigo_ibge` / `escola_id`); keep one table per source and join via a virtual dataset on that key.
10. **Don't double-count.** Federal education money is reported by multiple sources (FNDE liberações, Transparência federal função 12, Transferegov) — pick one primary feed per metric.

## Dev workflow
```
understand → build (superset-agent) → render_check → screenshot (frontend-design)
→ refine design → add RLS (superset-embedding) → embed (django-superset-embed)
→ verify with TWO tenants (each sees only its rows)
```

## Current Apache Superset documentation (6.x)
Prefer **version-accurate** sources first:
- **Live REST API (your instance, exact version):** `<SUPERSET_URL>/swagger/v1` — the authoritative API reference. Also `/api/v1/_openapi`.
- **Official docs:** https://superset.apache.org/docs/intro
  - Configuration: https://superset.apache.org/docs/configuration/configuring-superset
  - Security & roles: https://superset.apache.org/docs/security
  - Theming: https://superset.apache.org/docs/configuration/theming
  - Creating charts/dashboards: https://superset.apache.org/docs/using-superset/creating-your-first-dashboard
- **Embedded SDK:** https://www.npmjs.com/package/@superset-ui/embedded-sdk · source: https://github.com/apache/superset/tree/master/superset-embedded-sdk
- **Source of truth for behavior/version specifics:** the `apache/superset` repo (`superset/config.py`, the `plugin-chart-echarts` controls). Doc pages move between versions — when a doc and the live Swagger/`config.py` disagree, trust the instance.

> When unsure about a current API field, viz_type key, or config option: check the **live Swagger** on the instance and the bundled `superset-frontend-design` references (viz-types, theming, dashboard-layout) before guessing.

## Red flags (stop and apply the rule)
- "The API returned data, so it's done" → screenshot it (rule 2).
- "I'll pass the tenant from the front-end" → no (rule 4).
- "I'll just use a `bar` chart" → modern ECharts (rule 1).
- "I'll grant the role via the API" → not on 6.1 (rule 6).
- "Restart will pick up the config" → rebuild for baked-in config (rule 8).
