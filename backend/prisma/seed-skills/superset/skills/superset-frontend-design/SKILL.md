---
name: superset-frontend-design
description: Use when designing, styling, theming, or debugging the Apache Superset frontend — chart visual design, dashboard layout/CSS/branding, embedding — or when a Superset dashboard renders blank / ugly / "No data" in the browser even though the REST API returns data. Covers Superset 6.x (React + Ant Design + Emotion + ECharts), the LANGUAGES bootstrap crash, viz_type styling params, position_json layout, native filters, theming, and a Playwright debugging recipe.
---

# Superset Frontend & Design

## Overview

Apache Superset's UI is a **React + Ant Design (v5) + Emotion + Apache ECharts** single-page app. The server renders a small HTML shell with a `data-bootstrap` JSON blob on `#app`; the React app boots from that blob and then talks to the REST API for data.

**Core principle that drives all frontend debugging:**

> **API success ≠ render success.** A chart's SQL can return perfect rows over the REST API while the browser shows a blank card, "No data", an error tile, or a *completely blank page*. The render path (bootstrap → React → ECharts) is independent of the data path.

This skill is the **design + browser** companion to the `superset-agent` skill (which owns the MCP tools for creating databases/datasets/charts/dashboards). Use `superset-agent` to *build*; use this skill to make it *look right* and to *debug what the browser actually shows*.

## When to use

- Making charts/dashboards **look good**: colors, number formats, labels, axis, sorting, sizing.
- **Layout**: arranging charts in a grid, tabs, headers, rows/columns, dashboard CSS, branding.
- **Theming**: Superset 6 `THEME_DEFAULT`/`THEME_DARK` (Ant Design tokens), custom color palettes, dark mode.
- **Embedding**: standalone mode, guest tokens, the embedded SDK, hiding chrome.
- A dashboard is **blank / ugly / "No data" in the browser** but the API/`render_check_dashboard`/`get_chart_data` says the data is fine.
- The whole Superset UI (login included) is **blank/white** after a deploy or config change.

## When NOT to use

- Pure data/SQL/dataset/metric problems → use `superset-agent` (and check `get_chart_data`).
- Creating charts/dashboards via API → `superset-agent` has the MCP tools.
- Server won't start / DB won't connect → that's a deploy/infra problem, not frontend.

## ⚠️ #1 gotcha: blank browser, working API (the `languages[locale].flag` crash)

**Symptom:** Login page and/or dashboards are a **blank white screen**. The REST API works (you can log in via `/api/v1/security/login`, `get_chart_data` returns rows). `curl /login/` returns HTTP 200 with a `<title>`, but the page body is empty.

**Root cause (verified on Superset 6.1.0):** The frontend bootstrap shipped `common.languages = {}` (empty). The app reads `languages[currentLocale].flag` during init; with an empty dict that's `undefined.flag` →

```
TypeError: Cannot read properties of undefined (reading 'flag')
  at Object.useMemo (.../<hash>.entry.js)
Unhandled error during app initialization
```

…which kills the **entire** React bootstrap — so *nothing* renders, login included.

**Cause:** a custom `superset_config.py` set `BABEL_DEFAULT_LOCALE` to a non-English locale (e.g. `pt_BR`) **without defining `LANGUAGES`**. A non-`en` active locale with an empty `LANGUAGES` map triggers the crash.

**Fix:** define `LANGUAGES` including the active locale (and its negotiated short form), with valid flag codes:

```python
BABEL_DEFAULT_LOCALE = "pt_BR"
LANGUAGES = {
    "en":    {"flag": "us", "name": "English"},
    "pt":    {"flag": "pt", "name": "Portuguese"},
    "pt_BR": {"flag": "br", "name": "Brazilian Portuguese"},
}
```

Include the negotiated short locale (`pt`) too — Babel may resolve `pt_BR` down to `pt`, and the key the frontend looks up must exist. Then rebuild/redeploy (config baked into the image needs a rebuild, not just a restart).

**How to confirm it's this and not something else:** inspect the bootstrap (see the Playwright recipe). If `common.languages` is `[]`/`{}` and `common.locale` is not `en`, it's this bug.

## Other frontend-breaking config traps

| Trap | Symptom | Fix |
|------|---------|-----|
| Empty `LANGUAGES` + non-en locale | whole UI blank, `reading 'flag'` | define `LANGUAGES` (above) |
| Talisman **CSP** too strict | scripts/fonts/styles blocked; blank or unstyled page; console `Refused to load … violates CSP` | add the blocked origins to `TALISMAN_CONFIG["content_security_policy"]` (`script-src`, `style-src`, `img-src`, `connect-src`, `font-src`) |
| `ENABLE_PROXY_FIX` missing behind reverse proxy | redirect loops, mixed-content, assets 404 over HTTPS | set `ENABLE_PROXY_FIX=True` + `PROXY_FIX_CONFIG` |
| Bad `THEME_DEFAULT` (malformed AntD token object) | UI loads unstyled or theme errors | use a valid Ant Design v5 theme object, or omit to use the default |
| Static assets 404 (`/static/...`) | unstyled page, missing icons, SW registration fails | proxy/path or image-build problem, not code |

See `references/frontend-architecture-and-debugging.md` for the full bootstrap anatomy and CSP details.

## Designing charts (quick reference)

Build charts with `superset-agent`'s `create_simple_chart` (it picks modern ECharts viz_types). Then **style** them by updating `params`/form_data. The highest-leverage styling fields:

| Goal | form_data field | Example value |
|------|-----------------|---------------|
| Color palette | `color_scheme` | `"supersetColors"`, `"googleCategory10c"`, `"d3Category10"` |
| Number format | `y_axis_format` / `number_format` | `",d"` (int), `".1f"`, `".0%"`, `"$,.2f"`, `"SMART_NUMBER"` |
| Show value labels | `show_value` | `true` |
| Legend | `show_legend`, `legendOrientation` | `true`, `"top"` |
| Sort bars by value | `sort_by_metric` / `order_desc` | `true` |
| Rotate x labels | `xAxisLabelRotation` | `45` |
| Stack series | `stack` | `true` |
| Row cap | `row_limit` | `100` |

Full viz_type catalog, legacy→modern migration, the D3 number/time format table, and per-chart styling params: **`references/viz-types-and-styling.md`**.

> **Legacy viz_type trap (also in `superset-agent`):** `dist_bar`, `bar`, `line`, `area`, `dual_line` were **removed in Superset 6.0**. The API saves them but they render as a red *"Item with key X is not registered"* tile. Always use the modern ECharts ids (`echarts_timeseries_bar`, `echarts_timeseries_line`, `echarts_area`, `mixed_timeseries`).

## Designing dashboards (quick reference)

- **Grid:** 12 columns wide; `meta.width` 1–12. `meta.height` is in row units of **~8px** in current 6.x source (the old "~50px" lore is outdated — a `height: 50` chart ≈ 400px). Validate visually.
- **Components:** `ROOT → GRID → ROW → (CHART | COLUMN | MARKDOWN | DIVIDER)`, plus `TABS → TAB` and `HEADER`.
- **MCP helpers** (`superset-agent`): `build_dashboard_layout` (greedy row-packing), `add_markdown_block` (headers/notes), `add_dashboard_tab`, `add_native_filter`, `set_dashboard_css`.
- **Markdown blocks clip text** — they have a fixed height and scroll if content is taller. The `add_markdown_block` default (height 10) hides anything past ~2 lines. Size to content: **height ≥ 20 for a heading + up to 4 lines**; over-provision and confirm by screenshot (text wraps by width). See `references/dashboard-layout.md` → *Markdown block sizing*.
- **Polish moves that matter most:** a markdown title/intro row at top; consistent chart heights per row; a KPI row of `big_number` tiles first; native filters in the sidebar; light dashboard CSS for spacing and a branded header.

`position_json` schema, native-filter JSON, cross-filtering, tabs, and a clean modern dashboard-CSS example: **`references/dashboard-layout.md`**.

## Theming & branding (quick reference)

Superset 6 theming uses **Ant Design v5 theme config** via `THEME_DEFAULT` / `THEME_DARK` (objects with `token` + `algorithm`), plus custom palettes via `EXTRA_CATEGORICAL_COLOR_SCHEMES` / `EXTRA_SEQUENTIAL_COLOR_SCHEMES`, plus per-dashboard CSS. Branding: `APP_NAME`, `APP_ICON`, `FAVICONS`.

Token list, algorithm values, custom-palette format, and dark-mode setup: **`references/theming-and-branding.md`**.

## Embedding (quick reference)

- **Standalone URL:** `…/superset/dashboard/<id>/?standalone=1` (no nav). `standalone=2` hides more; `?show_filters=0` / `?expand_filters=0` tune the filter bar.
- **Guest tokens:** `superset-agent`'s `create_guest_token` → iframe with `X-GuestToken`. On Superset 6, `resources[].id` must be the embedded **UUID**, not the numeric dashboard id (see project memory `superset6_guest_token_uuid_required`).
- **SDK:** `@superset-ui/embedded-sdk` `embedDashboard({ id, supersetDomain, mountPoint, fetchGuestToken, dashboardUiConfig })`; `dashboardUiConfig` toggles `hideTitle`, `hideTab`, `hideChartControls`, `filters.visible`.

Details: **`references/embedding-and-guest-tokens.md`**.

## Debugging recipe: see what the browser actually renders (Playwright)

When the API is fine but the browser isn't, **look at the real page**. Superset 6.x login is an **Ant Design React form** that renders client-side — the old `#username`/`#password` selectors don't exist until JS runs, and if the bootstrap crashes they never appear.

```python
# py _check_dashboard.py  — login + bootstrap + console-error capture
from playwright.sync_api import sync_playwright
import json

BASE = "https://your-superset.example.com"
USER, PASS = "admin", "<password>"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_context(viewport={"width": 1600, "height": 1200}).new_page()
    errs = []
    pg.on("console", lambda m: errs.append(("console", m.text[:240])) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(("pageerror", str(e)[:240])))

    pg.goto(f"{BASE}/login/", wait_until="networkidle")
    pg.wait_for_timeout(3000)

    # 1) Is the bootstrap healthy? (catches the languages/flag crash)
    boot = pg.evaluate("() => document.getElementById('app')?.getAttribute('data-bootstrap')")
    if boot:
        d = json.loads(boot); c = d.get("common", {})
        print("locale:", c.get("locale"), "| languages:", list((c.get("languages") or {}).keys()))
    print("console/page errors:", errs[:8])

    # 2) Log in (AntD form — id selectors exist only once React renders)
    if pg.locator("#username").count():
        pg.fill("#username", USER); pg.fill("#password", PASS)
        pg.click("button[type=submit]"); pg.wait_for_load_state("networkidle")
    else:
        print("LOGIN FORM DID NOT RENDER -> bootstrap crashed, fix config first")

    # 3) Open the dashboard, let ECharts paint, screenshot, read per-chart text
    pg.goto(f"{BASE}/superset/dashboard/1/", wait_until="networkidle", timeout=60000)
    pg.wait_for_timeout(8000)
    pg.screenshot(path="dashboard.png", full_page=True)
    for i in range(pg.locator("[data-test='chart-container']").count()):
        print(i, repr(pg.locator("[data-test='chart-container']").nth(i).inner_text()[:120]))
    b.close()
```

**Reading the output:**
- Login form never renders + `reading 'flag'` in errors → the LANGUAGES crash. Fix config, redeploy.
- Login works, dashboard charts say **"No data"** → data-layer or query issue (check `get_chart_data`, time range, filters), not a render bug.
- A chart tile shows **"… is not registered"** → legacy viz_type; migrate it.
- Console `Refused to … Content Security Policy` → CSP too strict; widen `TALISMAN_CONFIG`.

A ready-to-run, parameterized version lives at `references/playwright_inspect.py`.

## Design workflow (build → render → refine loop)

1. Build/structure with `superset-agent` (datasets, `create_simple_chart`, `build_dashboard_layout`).
2. `render_check_dashboard` (static: viz_type + columns) — necessary, not sufficient.
3. **Screenshot with Playwright** — this is the only way to judge *design* and catch render-time failures.
4. Refine `params` (colors/format/labels/sort), layout (`build_dashboard_layout`), and `set_dashboard_css`.
5. Re-screenshot. Repeat until it looks right. **Never claim "looks good" without a screenshot.**

## Common mistakes

| Mistake | Reality |
|---------|---------|
| "API returns data, so the dashboard is fine" | Render path is separate. Screenshot it. |
| Trusting `render_check_dashboard` alone | Static only — misses blank-page crashes, CSP, ugly layout, runtime SQL errors. |
| Non-en `BABEL_DEFAULT_LOCALE` without `LANGUAGES` | Whole UI goes blank (`reading 'flag'`). |
| Using `#username` Playwright selector blindly | 6.x login is React/AntD; wait for render, handle the no-render case. |
| Restarting (not rebuilding) after a baked-in config change | Config COPY'd into the image needs an image rebuild to take effect. |
| Legacy `bar`/`dist_bar`/`line` viz_types | Removed in 6.0; render as "not registered". Use ECharts ids. |
| Empty/garbage `THEME_DEFAULT` | Theme must be a valid AntD v5 object, or omit it. |
| Default-height markdown block | Fixed-height card clips & scrolls; heading/last lines vanish. Size to content (height ≥ 20 for heading + 4 lines), verify by screenshot. |

## Reference files

- `references/viz-types-and-styling.md` — viz_type catalog, legacy→modern map, chart styling form_data, D3 number/time formats.
- `references/dashboard-layout.md` — position_json schema, rows/columns/tabs, native filters, cross-filtering, dashboard CSS example.
- `references/theming-and-branding.md` — Superset 6 theme tokens, algorithms, custom color palettes, dark mode, branding.
- `references/embedding-and-guest-tokens.md` — standalone mode, guest tokens, embedded SDK, uiConfig.
- `references/frontend-architecture-and-debugging.md` — bootstrap anatomy, CSP/Talisman, config traps, the Playwright recipe.
- `references/playwright_inspect.py` — runnable login + bootstrap + screenshot script.
