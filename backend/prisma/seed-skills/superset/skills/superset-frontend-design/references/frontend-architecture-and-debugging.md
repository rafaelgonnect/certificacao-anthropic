# Frontend architecture, config traps & debugging

## The bootstrap

Superset's server renders a thin HTML shell with a `data-bootstrap` JSON blob on `<div id="app">`. The React app (Webpack `entry.js` bundles) boots from that blob, then calls the REST API for data.

Inspect it in the browser console / Playwright:
```js
JSON.parse(document.getElementById('app').getAttribute('data-bootstrap'))
```
Key fields: `common.locale`, `common.languages`, `common.language_pack`, `common.feature_flags`, `common.theme` (`{default, dark, enableUiThemeAdministration}`), `user`.

**Core principle:** the **render path** (bootstrap → React → ECharts) is independent of the **data path** (REST API). The API can be 100% healthy while the browser shows nothing.

## ⚠️ The `LANGUAGES={}` bootstrap crash (verified)

**Superset's own default is `LANGUAGES = {}`** — `config.py` defines a full languages dict and then immediately overrides it with `LANGUAGES = {}` ("Turning off i18n by default"). With `BABEL_DEFAULT_LOCALE` left at `"en"`, the frontend tolerates the empty map. But set `BABEL_DEFAULT_LOCALE` to a **non-English** locale (e.g. `pt_BR`) and leave `LANGUAGES` empty, and the bootstrap ships `common.languages={}` while `common.locale` is `pt`/`pt_BR`. The app reads `languages[locale].flag` during init → `undefined.flag`:

```
TypeError: Cannot read properties of undefined (reading 'flag')  (Object.useMemo)
Unhandled error during app initialization
```

…which kills the **entire** React bootstrap — login included → blank white page. The REST API keeps working (it doesn't use this bootstrap).

**Fix:** define `LANGUAGES` with the active locale **and** its negotiated short form, valid flag codes:
```python
BABEL_DEFAULT_LOCALE = "pt_BR"
LANGUAGES = {
    "en":    {"flag": "us", "name": "English"},
    "pt":    {"flag": "pt", "name": "Portuguese"},
    "pt_BR": {"flag": "br", "name": "Brazilian Portuguese"},
}
```
`flag` is a 2-letter **country** code (ISO-3166), not the locale: `br` (pt_BR), `cn` (zh), `jp` (ja), `kr` (ko), `ua` (uk), `us` (en). Babel may resolve `pt_BR`→`pt`, so include `pt`. **Rebuild** the image if the config is baked in (a restart won't pick up a COPY'd config).

## Other config traps that break the frontend

| Trap | Symptom | Fix |
|------|---------|-----|
| Strict Talisman **CSP** | console `Refused to load … violates Content Security Policy`; blank/unstyled page; charts/fonts missing | add origins to `TALISMAN_CONFIG["content_security_policy"]`: `script-src`, `style-src` (often needs `'unsafe-inline'`), `img-src`, `connect-src`, `font-src`, `worker-src` (`blob:`) |
| Missing `ENABLE_PROXY_FIX` behind a reverse proxy | redirect loops, mixed-content, assets 404 over HTTPS | `ENABLE_PROXY_FIX=True` + `PROXY_FIX_CONFIG` |
| Cross-site embed cookie | iframe won't authenticate | `SESSION_COOKIE_SAMESITE="None"` + `SESSION_COOKIE_SECURE=True` |
| Static `/static/...` 404 | unstyled page, missing icons | image build / proxy path problem, not code |
| Stale Redis bootstrap cache | config change not reflected | bootstrap data is memoized; a fresh container/rebuild clears it |

> **Harmless noise** (don't chase these): `service-worker.js` 404, the `apachesuperset.gateway.scarf.sh` telemetry-pixel CSP warning, "Failed to fetch language pack … falling back to default" (cosmetic — translations fall back to English; not the `.flag` crash).

## Feature flags relevant to design (6.x defaults)

| Flag | Default | Relevance |
|---|---|---|
| `AG_GRID_TABLE_ENABLED` | False | Table Chart V2 (AG Grid) |
| `DASHBOARD_RBAC` | False | per-dashboard roles |
| `EMBEDDED_SUPERSET` | False | guest-token embedding |
| `EMBEDDABLE_CHARTS` | True | chart-level embed |
| `DRILL_TO_DETAIL` | True | right-click drill |
| `DRILL_BY` | True | drill-by dimension |
| `THUMBNAILS` | False | chart/dashboard thumbnails (needs webdriver/Playwright) |
| `DASHBOARD_VIRTUALIZATION` | True | lazy-render off-screen charts |
| `CSS_TEMPLATES` | True | reusable dashboard CSS |
| `ALERT_REPORTS` | False | scheduled reports (needs Celery beat) |

Removed-as-flags in 6.0 (now always-on): `DASHBOARD_CROSS_FILTERS`, `HORIZONTAL_FILTER_BAR`.

## Playwright debugging recipe

Superset 6.x login is an **Ant Design React form** rendered client-side. `#username`/`#password` exist **only after** JS renders — and not at all if the bootstrap crashed. Always wait for the field before filling.

See `playwright_inspect.py` in this folder for a runnable, parameterized version. Essentials:

```python
pg.goto(f"{BASE}/login/", wait_until="networkidle")
pg.wait_for_timeout(3500)                      # let the AntD form render

# 1) bootstrap health (catches the languages/flag crash)
boot = pg.evaluate("() => document.getElementById('app')?.getAttribute('data-bootstrap')")
# parse -> check common.locale and common.languages

# 2) login ONLY once the field exists
pg.wait_for_selector("#username", timeout=15000)
pg.fill("#username", USER); pg.fill("#password", PASS)
pg.click("button[type=submit]")                # button text "Sign in", type=submit
pg.wait_for_load_state("networkidle")
# success => url is /superset/welcome/ (not back to /login)

# 3) dashboard
pg.goto(f"{BASE}/superset/dashboard/<id>/", wait_until="networkidle")
pg.wait_for_timeout(8000)                       # ECharts paint
pg.screenshot(path="dash.png", full_page=True)
```

**Interpreting results:**
| Observation | Meaning |
|---|---|
| `#username` never renders + `reading 'flag'` | LANGUAGES crash → fix config, rebuild |
| login bounces back to `/login` | wrong creds, OR filled before the AntD form rendered (add the wait) |
| chart tile "No data" | data/query/time-range issue → check `get_chart_data` |
| chart tile "… is not registered" | legacy viz_type → migrate |
| console `Refused to … Content Security Policy` | CSP too strict → widen Talisman |
| login OK, charts paint | render path healthy; judge design from the screenshot |

**`render_check_dashboard` (MCP) is static** — viz_type + columns only. It does NOT catch blank-page crashes, CSP, ugly layout, or runtime SQL errors. The screenshot is the source of truth for design.
