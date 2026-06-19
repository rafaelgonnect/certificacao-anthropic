---
name: django-superset-embed
description: Use when building a Django (Python) web app that embeds Apache Superset 6.x dashboards — especially multi-tenant, where each logged-in user/tenant (school, network, client) must see only their own rows via Row Level Security. Triggers — "Django + Superset", "embed dashboard in Django", "guest token", "iframe Superset", "cada usuário vê só seus dados", "embedded SDK", building the Colaborativa app. Covers the server-side token mint, the frontend SDK, RLS per tenant, and the security model.
---

# Django + Superset Embedding (done right)

## Overview

Embed Superset dashboards in a Django app so each logged-in user sees **only their tenant's
rows**. The golden rule:

> **Mint the guest token on the SERVER (Django), never in the browser.** Django holds the
> Superset admin credentials, derives the tenant from `request.user` (never from client
> input), and returns a short-lived guest token carrying the tenant's RLS clause. The
> browser only ever sees that scoped token.

This is the Django-native companion to the `superset-embedding` skill (which covers the
Superset side: RLS rules, the `embed` role, guest tokens). Read that for the Superset
concepts; this skill is the **Django implementation**.

## Architecture

```
Browser (logged-in user)                Django backend                 Superset
  │                                         │                             │
  │ 1. GET /dashboard/  (login_required)    │                             │
  │────────────────────────────────────────▶  renders template with SDK  │
  │                                         │                             │
  │ 2. SDK calls fetchGuestToken()          │                             │
  │    GET /superset/guest-token/  ─────────▶  derive tenant from         │
  │                                         │  request.user               │
  │                                         │  ── admin login (cached) ──▶ │ /security/login
  │                                         │  ── get embedded uuid ─────▶ │ /dashboard/{id}/embedded
  │                                         │  ── mint guest token ──────▶ │ /security/guest_token/
  │                                         │     rls=[{clause,dataset}]   │
  │  ◀──────────  { token }  ───────────────│                             │
  │ 3. SDK loads iframe with X-GuestToken ──────────────────────────────▶ │ /embedded/<uuid>
  │     (Superset applies RLS → tenant rows only)                         │
```

**Why server-side:** the admin password and the tenant→value mapping must never reach the
client. A user must not be able to ask for another tenant's data — so the RLS value comes
from `request.user`, server-side, every time.

## The token service (reusable)

Put a single service that: caches the admin access token, resolves the embedded UUID, and
mints per-tenant guest tokens. Full code: **`references/superset_service.py`** — adapt it.
Essentials:

```python
# settings.py
SUPERSET_URL = env("SUPERSET_URL")                 # https://superset-dev.colaborativa.com.br
SUPERSET_ADMIN_USERNAME = env("SUPERSET_ADMIN_USERNAME")
SUPERSET_ADMIN_PASSWORD = env("SUPERSET_ADMIN_PASSWORD")  # secret — env only, never in VCS
SUPERSET_TENANT_COLUMN = "escola_id"               # the RLS column
```

```python
# the mint call, per request:
token = superset.guest_token_for_tenant(
    dashboard_id=12,
    tenant_value=request.user.escola_id,   # SERVER-derived, never from the client
    dataset_id=1,                          # scope the RLS clause to this dataset
)
```

## The view + URL

`login_required`, derive the tenant from the user, return the token as JSON. The SDK calls
this whenever it needs a token (initial load + on expiry).

```python
# views.py
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from .superset import superset

@login_required
def guest_token(request):
    token = superset.guest_token_for_tenant(
        dashboard_id=request.GET.get("dashboard", 12),
        tenant_value=request.user.escola_id,   # the security boundary
        dataset_id=1,
    )
    return JsonResponse({"token": token})

@login_required
def dashboard_page(request):
    return render(request, "dashboard.html", {
        "embedded_uuid": superset.embedded_uuid(12),
        "superset_domain": settings.SUPERSET_URL,
    })
```

```python
# urls.py
path("superset/guest-token/", views.guest_token, name="superset_guest_token"),
path("dashboard/", views.dashboard_page, name="dashboard"),
```

## The frontend (Embedded SDK)

Let the SDK manage the iframe + token refresh. Full template: **`references/dashboard.html`**.

```html
<div id="superset-dash" style="height: 80vh;"></div>
<script src="https://unpkg.com/@superset-ui/embedded-sdk"></script>
<script>
  supersetEmbeddedSdk.embedDashboard({
    id: "{{ embedded_uuid }}",                 // the EMBEDDED UUID, not the numeric id
    supersetDomain: "{{ superset_domain }}",
    mountPoint: document.getElementById("superset-dash"),
    fetchGuestToken: () =>
      fetch("{% url 'superset_guest_token' %}", { credentials: "same-origin" })
        .then(r => r.json()).then(d => d.token),
    dashboardUiConfig: { hideTitle: true, filters: { visible: false } },
  });
</script>
```

> **Let the SDK build the chart requests.** Don't hand-craft `/api/v1/chart/data` calls —
> a guest sending a modified payload gets `403 "Guest user cannot modify chart payload"`.
> The SDK always sends the chart's exact stored query, so it just works.

## Gotchas (each verified the hard way)

| Gotcha | Fix |
|--------|-----|
| Token minted in the browser | NEVER. Admin creds stay in Django. Mint server-side. |
| Tenant value from the client (query param / JS) | Security hole — a user could request another tenant. Derive from `request.user` only. |
| Using the numeric dashboard id as `id` | Use the **embedded UUID** (`/api/v1/dashboard/{id}/embedded`). |
| `403 Guest user cannot modify chart payload` | Don't hand-roll chart-data calls; the SDK sends the exact query. |
| Admin token expires (~30 min) → 401 mid-session | Cache the admin token with a TTL margin and re-login on 401 (the service does this). |
| Guest token short TTL → dashboard stops refreshing | Expected — the SDK calls `fetchGuestToken` again. Keep that endpoint cheap (cache admin login + embedded uuid). |
| Cross-site iframe shows blank / cookie errors | Superset config: `SESSION_COOKIE_SAMESITE="None"` + `SESSION_COOKIE_SECURE=True`; the Django origin must be in Superset's `frame-ancestors` (Talisman CSP) + `CORS_OPTIONS["origins"]` + `EMBED_ORIGINS`. |
| `embed` role missing/unprivileged on Superset | Guest data → 500 (missing) / 403 (no datasource access). The Colaborativa deploy YML's `cs_init` creates + grants the `embed` role. |
| Calling Superset on every page render | Cache the admin token and the embedded UUID (Django cache). Only the guest token is per-request. |

## Django best practices for this integration
- **Secrets in env** (`django-environ` / `os.environ`), never committed. The admin password is the crown jewel.
- **`requests`/`httpx` with timeouts** on every Superset call; handle failures with a clear 502 to the user, not a stack trace.
- **Cache** the admin access token (e.g. `cache.set("superset_admin_token", tok, 25*60)`) and embedded UUIDs; re-login on 401.
- **`login_required`** on both views; the guest-token endpoint must never be anonymous.
- **Map tenant on the User model** (`request.user.escola_id` or a profile FK) so the RLS value is unambiguous and server-controlled.
- **One dashboard, many tenants**: the same embedded dashboard serves everyone; RLS does the isolation. Don't duplicate dashboards per tenant.
- **Tests**: mock the Superset HTTP calls; assert the guest token request carries the RLS clause built from the test user's tenant (and NOT from request params).

## Setup checklist
1. On Superset: embed the dashboard (Settings → Embed dashboard) to get/confirm the embedded UUID; ensure the `embed` role exists with datasource access (YML `cs_init` handles it).
2. Add the tenant column (e.g. `escola_id`) to the datasets and create the RLS strategy (guest-token clause per tenant — no persistent rule needed for embed-only).
3. Django: env vars, the `superset.py` service, the two views + urls, the template.
4. Superset config: Django origin in `frame-ancestors`/`CORS`/`EMBED_ORIGINS`; `SESSION_COOKIE_SAMESITE="None"`+`SECURE` if cross-site.
5. Verify: log in as two different tenants, confirm each sees only its rows.

## Reference files
- `references/superset_service.py` — the full Django token service (admin-login cache, embedded UUID, per-tenant guest token).
- `references/dashboard.html` — the embed template with the SDK + token refresh.
- `references/views_urls.py` — views + urls wired together.
