---
name: superset-agent
description: Use when working with Apache Superset — creating/editing/inspecting databases, datasets, charts and dashboards on an Apache Superset 6.x instance through the local `superset` MCP. Triggers on requests involving "superset", "dashboard", "criar gráfico", "criar dashboard", "criar dataset", "registrar database no superset", "consultar via SQL Lab". Also use when the user reports that a Superset chart "não renderiza" / "está com erro" — the skill knows the legacy-viz_type trap and how to diagnose.
---

# Superset Agent

Bridges Claude to a local stdio MCP server (`server.py`) that wraps the REST API of an
Apache Superset 6.x instance. The MCP is configured by the **Superset Colaborativa
installer** (run `instalar superset colaborativa`) — it points at whatever instance the
operator entered. The same tools work against any Superset 6.x URL.

**Companion skills:** `superset-frontend-design` (chart/dashboard design, theming, blank-page
debugging), `superset-embedding` (multi-tenant RLS + guest tokens), and
`django-superset-embed` (embedding into a Django app). Reach for those when the task is
design, row-level security, or app integration rather than building objects.

## When to use

- The user asks to **create** anything in Superset: database connection, dataset, chart, dashboard, SQL Lab query.
- The user reports a chart "renderiza com erro", "data error", or a viz_type complaint — start with `render_check_dashboard` before opening a browser.
- The user wants to **inspect** what already exists: "lista os dashboards", "mostra os charts da dashboard X", "quais colunas o dataset Y tem".
- The user wants to **bulk-edit** charts (e.g., migrate viz_types after a Superset upgrade).

## MCP setup (handled by the installer)

The installer registers the `superset` MCP in `~/.claude.json` and writes the credentials to
`~/.superset-colaborativa/mcp/.env`:

```
SUPERSET_URL=https://<your-superset-host>
SUPERSET_USERNAME=admin
SUPERSET_PASSWORD=<your admin password>
SUPERSET_TIMEOUT=60
```

After install, restart Claude and the `mcp__superset__*` tools are available. (Manual wiring,
if ever needed: `claude mcp add superset --scope user -- <python> <path>/server.py`.)

## Available MCP tools

All tools are prefixed `mcp__superset__` once registered.

### Databases
- `list_databases`, `get_database(id)`, `create_database(...)`, `update_database(id, payload)`, `delete_database(id)`
- `list_database_schemas(id)`, `list_database_tables(id, schema)`, `get_table_metadata(id, schema, table)`

### Datasets
- `list_datasets`, `find_datasets(name_contains)`, `get_dataset(id)`
- `get_dataset_columns(id)` — shortcut for `[{column_name, type, is_dttm}]`; use this to pick columns before creating a chart
- `create_dataset(database_id, table_name, schema)`, `update_dataset(id, payload)`, `delete_dataset(id)`, `refresh_dataset(id)`

### Charts
- `list_charts`, `find_charts(name_contains, viz_type)`, `get_chart(id)`
- `create_chart(slice_name, viz_type, datasource_id, params, ...)` — for full control; rejects legacy viz_types
- **`create_simple_chart(slice_name, dataset_id, chart_type, ...)`** — preferred for common types; takes high-level args (`x_axis`, `dimension`, `metric_column`, `metric_aggregate`) and produces correct form_data
- `update_chart(id, payload)`, `delete_chart(id)`
- `list_supported_viz_types()` — returns the modern `chart_type` keys and the legacy-to-modern migration map

### Dashboards
- `list_dashboards`, `find_dashboards(title_contains)`, `get_dashboard(id)`, `get_dashboard_charts(id)`
- `create_dashboard(dashboard_title, ...)`, `update_dashboard(id, payload)` (use to set `position_json`), `delete_dashboard(id)`
- **`attach_charts_to_dashboard(dashboard_id, chart_ids)`** — links charts to a dashboard. Without this the charts won't render even if referenced in `position_json`.
- **`render_check_dashboard(dashboard_id)`** — static validation: checks every chart's viz_type is registered in 6.0+ and every referenced column exists in the dataset. Run this **immediately after creating charts via API** — it catches the legacy-viz_type bug before the user opens a browser.

### SQL Lab
- `execute_sql(database_id, sql, schema, limit)` — synchronous; returns columns + rows

### Layout, filters, and dashboard structure (tools_layout.py)
- **`build_dashboard_layout(dashboard_id, charts_spec)`** — auto position_json with greedy row packing; `charts_spec` is `[{"chart_id":int,"width":int,"height":int,"slice_name":str?}]`. Replaces the external `_apply_layout.py`.
- **`add_native_filter(dashboard_id, column, filter_type="value", default_value=None, label=None, target_chart_ids=None)`** — adds a sidebar filter (`value`, `range`, `time`, `time_range`, `time_grain`). Auto-infers dataset id from a chart on the dashboard.
- `add_markdown_block(dashboard_id, markdown, width, height)` — explanatory text/headers in the layout
- `add_dashboard_tab(dashboard_id, tab_name, chart_ids)` — turn a dashboard into a multi-tab layout
- `set_dashboard_css(dashboard_id, css)` — custom CSS for branding/themes
- `set_dashboard_roles(dashboard_id, role_ids)` — restrict viewing to specific roles (empty list = all viewers with dataset perms)
- `set_dashboard_owners(dashboard_id, user_ids)` — set editors

### Dataset ingest + calculated fields (tools_datasets_ext.py)
- **`create_virtual_dataset(database_id, table_name, sql, schema)`** — dataset backed by a SQL query (no VIEW needed)
- **`upload_csv(database_id, schema, table_name, csv_path, if_exists)`** — multipart CSV → table + dataset in one call. Requires `allow_file_upload=true` on the DB connection.
- `add_dataset_metric(dataset_id, metric_name, sql_expression, d3format, description)` — reusable metric (e.g. `eFG% = (FG + 0.5*3P)/FGA`)
- `add_dataset_column(dataset_id, column_name, sql_expression, type, is_dttm)` — calculated column
- `get_dataset_sample(dataset_id, limit)` — N rows via SQL Lab
- `find_unused_datasets()` — datasets that no chart references (housekeeping)
- `swap_chart_dataset(chart_id, new_dataset_id)` — repoint a chart to a different dataset

### Chart batch + diagnosis (tools_charts_ext.py)
- **`clone_chart(source_chart_id, new_name, param_overrides, target_dashboard_id)`** — duplicate with optional param edits
- `bulk_delete_charts(chart_ids)` / `bulk_delete_dashboards(dashboard_ids)` / `bulk_delete_datasets(dataset_ids)` — Rison-bulk endpoint with per-id fallback
- `find_orphan_charts()` — charts not on any dashboard
- **`migrate_legacy_viz_types(dashboard_id=None, dry_run=True)`** — auto-finds and migrates `dist_bar`/`bar`/`line`/`area`/`dual_line` charts (dashboard scope or all)
- `get_chart_data(chart_id)` — execute the chart's stored query, return rows (two-path: GET /chart/{id}/data → POST /chart/data fallback for API-created charts without stored query_context)
- `describe_chart(chart_id)` — natural-language summary of a chart

### Users, roles, permissions (tools_access.py)
- `list_users(name_contains)`, `get_user(id)`, `create_user(username, first_name, last_name, email, password, role_ids, active)`, `update_user(id, payload)`, `delete_user(id)`
- `list_roles(name_contains)`, `get_role(id)`, `create_role(name, permission_view_ids)`
- **`grant_dataset_to_role(role_id, dataset_id)`** — adds `datasource_access on [db].[table](id:X)` PVM to the role
- **`grant_database_to_role(role_id, database_id)`** — adds `database_access on [db](id:X)` PVM

### Export, embed, diagnostics (tools_misc.py)
- `export_dashboard(dashboard_id, save_to)` — ZIP (base64 or filesystem)
- `import_dashboard(zip_path, passwords, overwrite)` — multipart import
- **`create_guest_token(dashboard_id, username, ttl_seconds, rls_clauses)`** — JWT for iframe embed at `/superset/dashboard/<id>/?standalone=1&token=<token>`
- `make_dashboard_public(dashboard_id, public=True)` — toggle Public role access
- `get_dashboard_thumbnail(dashboard_id, save_to)` — PNG via the digest-suffixed thumbnail URL
- `get_superset_version()` / `get_health()` — server diagnostics

## Common workflows

### 1. "Build a dashboard from a database table I already have"

1. `list_databases()` → pick `database_id`
2. `list_database_tables(database_id, schema)` → pick table
3. `create_dataset(database_id, table_name, schema)` → save dataset id (or `create_virtual_dataset(...)` if you need joined/derived data)
4. `get_dataset_columns(dataset_id)` → see what columns exist (pick x_axis/dimension/metric)
5. (optional) `add_dataset_metric(dataset_id, "efg_pct", "(SUM(fg)+0.5*SUM(fg3))/SUM(fga)")` for reusable computed metrics
6. For each chart use `create_simple_chart(...)` with `chart_type` in `{bar, line, area, pie, big_number, table, scatter, histogram, heatmap, treemap, sankey}` — never hand-build `dist_bar`/`bar`/`line` legacy form_data
7. `create_dashboard(title, slug, published=True)`
8. `attach_charts_to_dashboard(dashboard_id, [chart_ids...])`
9. **`build_dashboard_layout(dashboard_id, [{"chart_id":..., "width":..., "height":...}])`** — replaces hand-crafted `position_json`
10. (optional) `add_native_filter(dashboard_id, column="season", filter_type="value")` — sidebar filters
11. **`render_check_dashboard(dashboard_id)` — verify before reporting done**
12. Tell the user the URL: `<SUPERSET_URL>/superset/dashboard/<id>/`

### 1b. "Upload a CSV and build a dashboard from it"

1. `upload_csv(database_id=1, schema="public", table_name="my_data", csv_path="...")` (requires `allow_file_upload=true` on the DB)
2. Continue from step 4 of workflow 1.

### 1c. "Give a colleague view-only access to a dashboard"

1. `create_role(name="Gestor")` → role_id
2. `grant_dataset_to_role(role_id, dataset_id)` for each dataset used by the dashboard's charts
3. `create_user(username, first_name, last_name, email, password, role_ids=[role_id])`
4. `set_dashboard_roles(dashboard_id, [role_id])` — restrict viewing

### 2. "A dashboard is broken / charts show Data error"

1. `render_check_dashboard(dashboard_id)` first — if `all_ok: false`, the `issues` list per chart tells you exactly what's wrong.
2. Common issue: `viz_type 'dist_bar' was removed in Superset 6.0` → migrate with `update_chart(id, {viz_type: 'echarts_timeseries_bar', params: <new form_data>})`. The new form_data should move `groupby[0]` to `x_axis` and set `groupby=[]`. See gotcha below.
3. Common issue: `column 'foo' not found in dataset` → the user renamed/dropped a column; either `refresh_dataset(id)` or update the chart's params to use an existing column from `get_dataset_columns`.
4. If `render_check_dashboard` reports `all_ok: true` but the user still sees blank charts: it's likely a JS/SQL runtime issue — open the dashboard in a real browser (the `D:\SuperSet_agent\mcp\_check_dashboards.py` Playwright script is the reference).

### 3. "Run a quick SQL exploration"

`execute_sql(database_id, "SELECT ... LIMIT 50", schema="public")` — synchronous, no Celery dependency.

## Gotchas

### Legacy viz_types are silently accepted but don't render

In Superset 6.0+ the legacy NVD3 plugins (`dist_bar`, `bar`, `line`, `area`, `dual_line`) were removed. `POST /api/v1/chart/` happily saves them and they show up in `list_charts`, but the dashboard renders them as a red **"An error occurred while rendering the visualization: Error: Item with key "X" is not registered"** card.

- The MCP's `create_chart` tool now rejects these with a useful error.
- Always prefer `create_simple_chart` for the common types — it picks the modern ECharts ids automatically.
- Modern equivalents (also returned by `list_supported_viz_types()`):

| Legacy | Modern viz_type             | Notes                                    |
|--------|------------------------------|-------------------------------------------|
| `dist_bar`  | `echarts_timeseries_bar` | move `groupby[0]` → `x_axis`, `groupby=[]` |
| `bar`       | `echarts_timeseries_bar` | same                                      |
| `line`      | `echarts_timeseries_line`| same                                      |
| `area`      | `echarts_area`           | same                                      |
| `dual_line` | `mixed_timeseries`       | metric → metrics + metrics_b              |

### `attach_charts_to_dashboard` is non-obvious but required

Setting `position_json` on a dashboard with chart references is **not enough** — Superset also requires an entry in the chart↔dashboard association table, otherwise the charts render as empty placeholders. The MCP exposes `attach_charts_to_dashboard` precisely so this step isn't forgotten.

### Password rotation

The admin password rotates. The current value is stored in project memory (`superset_admin_credentials.md`); `deploy/BOOTSTRAP.md` only documents the original bootstrap suggestion and is out of date after first login.

### `render_check_dashboard` is static-only

It catches viz_type and missing-column bugs (the most common bulk-creation failures) but does **not** execute SQL — it won't catch data-layer issues like a broken `metric.sqlExpression`. For full coverage, follow it up with a browser visit, using `D:\SuperSet_agent\mcp\_check_dashboards.py` as the Playwright reference script (logs in headless, screenshots all dashboards, dumps console errors).

## Project anchor

- Code: `D:\SuperSet_agent\`
- MCP server: `D:\SuperSet_agent\mcp\server.py`
- One-shot build/load scripts (reference, not invoked by the MCP): `mcp\_build.py`, `mcp\_load.py`, `mcp\_fix_dist_bar.py`
- Offline smoke test: `mcp\_smoke_test.py` (no network)
- Online integration test: `mcp\_integration_test.py` (hits the live instance)
- Browser smoke test: `mcp\_check_dashboards.py` (Playwright)
- Documentation: `docs/` (Superset overview, REST API reference, AI integration patterns, EasyPanel deploy)
- Live instance: `https://melanibotto-rdasuperset.bdoje9.easypanel.host`
