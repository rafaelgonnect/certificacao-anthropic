---
name: superset-embedding
description: Use when embedding Apache Superset dashboards into another web app (iframe / Embedded SDK), minting guest tokens, or setting up multi-tenant Row Level Security (RLS) so each tenant/user sees only their own rows. Triggers — "embed", "iframe", "guest token", "RLS", "row level security", "multi-tenant", "cada escola/rede vê só os dados dela", "filtrar por cliente". Covers Superset 6.x via the local `superset` MCP.
---

# Superset Embedding & Row Level Security

## Overview

Two jobs, usually together:
1. **Embed** a dashboard into an external app (e.g. colabsystem / formacoes) via an
   iframe + a short-lived **guest token**.
2. **Row Level Security (RLS)** — make each tenant (school, network, client) see only
   *their* rows of the same dataset.

> RLS filters **rows**. It is NOT the same as `DASHBOARD_RBAC` (which controls who may
> open the dashboard) — those are separate layers and often combined.

This skill is the access/embedding companion to `superset-agent` (build) and
`superset-frontend-design` (look & feel). It drives the RLS + embed MCP tools.

## ⚠️ First: run the setup interview (ask the OPERATOR, don't assume)

Before creating anything, **ask the person setting this up** (e.g. the Colaborativa
team) — do NOT guess the tenant model. Ask in their language, one topic at a time:

1. **What identifies a tenant?** Which column marks who a row belongs to —
   `escola_id`, `rede_id`, `municipio_id`, `cliente_id`, …? In which dataset(s)?
   - *Tip:* you can propose candidates: run `get_dataset_columns(dataset_id)` and offer
     the columns that look like an id/owner (`*_id`, `escola`, `rede`, `tenant`, `uf`).
2. **How do people access the dashboards?**
   - **Embed-only** — the host app (colabsystem) logs users in and knows their tenant →
     use **guest-token RLS** (per-session, no stored rules).
   - **Direct Superset login** — real Superset users/roles per tenant → use
     **persistent RLS rules**.
   - **Both** — set up both.
3. **One tenant per role, or per user?**
   - Role = one tenant (e.g. a "Rede 42" role) → **static** rule.
   - The tenant value lives on each user (user id / username = tenant key) → **dynamic**
     (one Jinja rule for everyone).

Use the answers to pick the path below. If they don't know a column exists, help them
add one (`add_dataset_column` / a calculated column) before proceeding.

## Decision guide

```
Embedding into an external app, host knows the tenant?   -> guest-token RLS  (A)
Real Superset users, one role per tenant?                -> static rule      (B)
Real Superset users, tenant value lives on the user?     -> dynamic rule     (C)
```

## A) Guest-token RLS (embed per tenant) — the colabsystem path

The host app requests a token scoped to the logged-in user's tenant; the clause applies
to that iframe session only. No stored rule.

```python
embed_token_for_tenant(
    dashboard_id=12,
    tenant_column="escola_id",
    tenant_value=42,          # the host app supplies this per user
    dataset_id=1,             # scope to one dataset; omit to apply to all in the dash
)
# -> {token, embedded_uuid, rls_clause}
```
Then embed with the SDK (see *Iframe / SDK* below) using `embedded_uuid` + `token`.

**Prereqs:** `EMBEDDED_SUPERSET=True`, a strong `GUEST_TOKEN_JWT_SECRET`, and the
`GUEST_ROLE_NAME` role (default `embed`/`Public`) must have **dataset access** to the
datasets used (grant via `superset-agent`'s `grant_dataset_to_role`). The wrapper auto-
creates the embedded record + resolves the UUID (Superset 6 needs the **embedded UUID**,
not the numeric id).

## B) Static persistent RLS (one role = one tenant)

```python
grant_tenant_rls(dataset_id=1, column="rede_id", value=42, role_ids=[<role_id>])
# clause: rede_id = 42  (value auto-quoted by type), filter_type "Regular"
```
Users with that role only ever see `rede_id = 42`. Create the role + assign users with
`superset-agent`'s `create_role` / `create_user`.

## C) Dynamic persistent RLS (one rule, every tenant) — needs Jinja

One rule that reads the logged-in user. Requires `ENABLE_TEMPLATE_PROCESSING` (on by
default in Colaborativa).

```python
grant_dynamic_rls(dataset_id=1, column="rede_id", role_ids=[<role_id>], user_field="user_id")
# clause: rede_id = {{ current_user_id() }}
# or user_field="username" -> column = '{{ current_username() }}'
```
Use when each user's id/username equals their tenant key (so you don't make one rule per
tenant). The tenant value must live somewhere the Jinja context exposes.

## Full RLS rule control

`list_rls_rules`, `get_rls_rule`, `create_rls_rule`, `update_rls_rule`, `delete_rls_rule`.

`create_rls_rule(name, clause, dataset_ids, role_ids, filter_type, group_key, description)`:
- **`filter_type`** — `"Regular"` (applies to users WITH the roles) or `"Base"` (applies
  to users WITHOUT the roles → a default restriction the listed roles are exempt from).
- **`group_key`** — rules sharing a key are combined with **OR**; different keys with
  **AND**. Use the same key for "tenant A OR tenant B" access.
- **`clause`** — raw SQL WHERE fragment, **no** `WHERE` keyword (`"rede_id = 42"`,
  `"categoria = 'Tropical'"`, or a Jinja expression).

## Iframe / SDK

```html
<div id="dash"></div>
<script src="https://unpkg.com/@superset-ui/embedded-sdk"></script>
<script>
  supersetEmbeddedSdk.embedDashboard({
    id: "<embedded_uuid>",                 // from embed_token_for_tenant
    supersetDomain: "https://superset-dev.colaborativa.com.br",
    mountPoint: document.getElementById("dash"),
    fetchGuestToken: () => fetchTokenFromYourBackend(), // backend calls embed_token_for_tenant
    dashboardUiConfig: { hideTitle: true, filters: { visible: false } },
  });
</script>
```
The **token must be minted server-side** (the backend holds the admin creds / MCP), never
in the browser. See `superset-frontend-design/references/embedding-and-guest-tokens.md`
for standalone-mode URLs and uiConfig options.

## Testing RLS

Use the bundled **`references/rls_smoke_test.py`** — it proves RLS actually filters rows:

```bash
py rls_smoke_test.py --url https://superset.example.com --password ****** \
   --dashboard 1 --dataset 1 --column escola_id --tenants 1,2
```

Two modes:
- **`persistent`** (default, reliable, generic): a controlled experiment on the Admin role —
  baseline count → temporary RLS rule per tenant → count → delete → confirm it returns to
  baseline. Prints `RLS (motor): [OK] filtra` and exits 0 when the engine filters. This is
  the authoritative automated check (verified: 26 → 9 → 17 → 26 on the frutas mock).
- **`guest` / `both`**: also tries the embed path by minting a guest token per tenant and
  querying. ⚠️ A standalone HTTP guest query usually hits `403 "Guest user cannot modify
  chart payload"` — Superset only accepts from a guest the **exact** query its Embedded SDK
  builds. That is **not** an RLS failure (persistent already proved filtering); validate the
  embed visually by loading the iframe with `@superset-ui/embedded-sdk` in a browser as two
  different tenants and confirming each sees only its rows.

Note: `get_chart_data` via the MCP runs in the **admin** context, so it won't reflect a
tenant rule unless the rule targets a role the admin holds — which is exactly why the
persistent mode targets the Admin role temporarily.

## Gotchas
- **Embedded UUID, not numeric id** in guest-token `resources[].id` (the wrapper handles it).
- **Jinja clauses need `ENABLE_TEMPLATE_PROCESSING`**; without it `{{ ... }}` is literal text → empty results.
- **The guest role must EXIST and have datasource access.** `GUEST_ROLE_NAME` (Colaborativa
  config = `"embed"`) names the role guests map to. Verified failure modes on superset-dev
  (2026-06-08): role **missing** → guest data endpoint returns **HTTP 500**; role exists but
  **no datasource access** → **HTTP 403**. Fix: the role must exist AND have `all_datasource_access`
  (+ `can read` on Chart/Dashboard/Dataset); RLS then filters per tenant on top.
  - The Colaborativa **deploy YML now does this automatically** in `cs_init` (a
    `bootstrap_embed.py` that creates the `embed` role and grants those permissions on every
    deploy). Check the cs_init logs for `[embed-role] 'embed' -> ...`.
  - You **cannot** grant role permissions via the REST API on Superset 6.1+ (the roles
    `edit_columns` is name-only — `create_role` makes the role, but `grant_dataset_to_role`/
    `grant_database_to_role` raise and tell you to use the UI or the cs_init bootstrap).
    Persistent RLS rules and guest tokens are unaffected — those tools work.
- **Cross-site iframe cookies:** `SESSION_COOKIE_SAMESITE="None"` + `SESSION_COOKIE_SECURE=True`, and add the host origin to `frame-ancestors` (Talisman CSP) + `CORS_OPTIONS["origins"]` + `EMBED_ORIGINS`.
- **RLS clause is raw SQL** — build it server-side from trusted values (the MCP helpers quote literals); never interpolate raw user input into `create_rls_rule`.
- **Base vs Regular** is the #1 confusion: `Base` filters everyone EXCEPT the roles.
