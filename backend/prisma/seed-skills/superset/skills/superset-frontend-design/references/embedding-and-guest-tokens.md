# Embedding & guest tokens (Superset 6.x)

Verified against `superset-embedded-sdk` README + `src/constants.ts` URL_PARAMS + `DashboardStandaloneMode` enum.

## Standalone mode (iframe without SDK)

`…/superset/dashboard/<id>/?standalone=<n>`:
- `standalone=1` → `HideNav` (chrome/nav hidden, title kept)
- `standalone=2` → `HideNavAndTitle`
- `standalone=3` → `Report` (screenshot mode)

Filter-bar params: `?show_filters=0` (hide native filter bar), `?expand_filters=1` (expand it).
Other useful params: `uiConfig`, `preselect_filters`, `native_filters`, `native_filters_key`, `permalink_key`, `force=1` (bypass cache).

## Embedded SDK (`@superset-ui/embedded-sdk`)

Also on CDN as global `supersetEmbeddedSdk`.

```js
import { embedDashboard } from "@superset-ui/embedded-sdk";
embedDashboard({
  id: "abc123",                       // EMBEDDED UUID from the Embed dialog (NOT numeric id)
  supersetDomain: "https://superset.example.com",
  mountPoint: document.getElementById("container"),
  fetchGuestToken: () => fetchGuestTokenFromYourBackend(),
  dashboardUiConfig: {
    hideTitle: true,
    hideTab: true,
    hideChartControls: true,
    filters: { visible: true, expanded: false },
    urlParams: { foo: "value1" }
  },
  iframeSandboxExtras: ["allow-top-navigation", "allow-popups-to-escape-sandbox"],
  iframeAllowExtras: ["clipboard-write", "fullscreen"],
  referrerPolicy: "same-origin",
  resolvePermalinkUrl: ({ key }) => `https://my-app.com/share/${key}`
});
```

**`dashboardUiConfig`:** `hideTitle`, `hideTab`, `hideChartControls`, `filters.visible`, `filters.expanded`, `urlParams`.

## Guest tokens

Backend `POST /api/v1/security/guest_token/` (caller needs `can_grant_guest_token`):
```json
{
  "user": { "username": "embed_user", "first_name": "E", "last_name": "U" },
  "resources": [ { "type": "dashboard", "id": "<EMBEDDED UUID>" } ],
  "rls": [ { "clause": "tenant_id = 42" } ]
}
```
Use it in the iframe via the `X-GuestToken` header (or the SDK's `fetchGuestToken`).

**Prereqs:**
- Feature flag `EMBEDDED_SUPERSET = True`.
- Strong `GUEST_TOKEN_JWT_SECRET`.
- `GUEST_ROLE_NAME` (default `"Public"`) must have access to the dashboard's datasets.
- `GUEST_TOKEN_JWT_AUDIENCE` must match the token `aud` if set.

### ⚠️ Superset 6 gotcha
`resources[].id` must be the **embedded dashboard UUID string** (from the "Embed dashboard" dialog), **NOT** the numeric dashboard id. Passing the numeric id yields an invalid token / blank embed. (The `superset-agent` MCP `create_guest_token` is known-broken on Superset 6 for this reason — build the payload with the UUID directly.)

## CSP for embedding
The parent site must be allowed to frame Superset: add it to `TALISMAN_CONFIG["content_security_policy"]["frame-ancestors"]`, and add it to `CORS_OPTIONS["origins"]` + `EMBED_ORIGINS`. Session cookies for embedding need `SESSION_COOKIE_SAMESITE = "None"` + `SESSION_COOKIE_SECURE = True` when the iframe is cross-site.
