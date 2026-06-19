# Dashboard layout, native filters & CSS

Verified against `apache/superset` master (6.x) source, June 2026.

## position_json schema

A **flat map** of `node-id → node`. Every node: `id`, `type`, `meta`, `children`, `parents`.

**Component types:** `ROOT`, `GRID`, `ROW`, `COLUMN`, `TABS`, `TAB`, `HEADER`, `MARKDOWN`, `CHART`, `DIVIDER`, `DYNAMIC`.
**Fixed ids:** `ROOT_ID`, `GRID_ID`, `HEADER_ID`.
**Nesting:** `ROOT → GRID → ROW → (CHART | COLUMN | MARKDOWN | DIVIDER)`. Tabs: `GRID → TABS → TAB → ROW → …`.

### Grid math (from source)
- `GRID_COLUMN_COUNT = 12` → `meta.width` is 1–12 columns. Default new chart = 4.
- **Height:** `meta.height` unit ≈ **8px** in current source (`GRID_BASE_UNIT = 8`, rendered `height = 8 * heightMultiple`). So `height: 50` ≈ 400px. The old "~50px/unit" is outdated — **validate visually**. Row-unit bounds: min 5, max 100.
- Width px = `(8+16)*width - 16`.
- `meta.background`: `BACKGROUND_WHITE` | `BACKGROUND_TRANSPARENT`.
- Header sizes: `SMALL_HEADER` | `MEDIUM_HEADER` | `LARGE_HEADER`.
- `position_json` size cap: `DASHBOARD_POSITION_DATA_LIMIT = 65535` bytes.

### Example: one ROW, two charts
```json
{
  "DASHBOARD_VERSION_KEY": "v2",
  "ROOT_ID": { "type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"] },
  "GRID_ID": { "type": "GRID", "id": "GRID_ID", "children": ["ROW-1"], "parents": ["ROOT_ID"] },
  "ROW-1": {
    "type": "ROW", "id": "ROW-1",
    "meta": { "background": "BACKGROUND_TRANSPARENT" },
    "children": ["CHART-aaa", "CHART-bbb"],
    "parents": ["ROOT_ID", "GRID_ID"]
  },
  "CHART-aaa": {
    "type": "CHART", "id": "CHART-aaa",
    "meta": { "chartId": 101, "uuid": "uuid-101", "sliceName": "Sales", "width": 6, "height": 50 },
    "children": [], "parents": ["ROOT_ID", "GRID_ID", "ROW-1"]
  },
  "CHART-bbb": {
    "type": "CHART", "id": "CHART-bbb",
    "meta": { "chartId": 102, "uuid": "uuid-102", "sliceName": "Revenue", "width": 6, "height": 50 },
    "children": [], "parents": ["ROOT_ID", "GRID_ID", "ROW-1"]
  }
}
```

> **Don't hand-build this.** Use `superset-agent`'s `build_dashboard_layout(dashboard_id, charts_spec)` (greedy row-packing), `add_dashboard_tab`, `add_markdown_block`. Hand-edit `position_json` only for fine control, and remember **`attach_charts_to_dashboard` is required** or charts render as empty placeholders.

## Native filters (`json_metadata.native_filter_configuration`)

Array of filter entries:
```json
{
  "id": "NATIVE_FILTER-abc123",
  "name": "Region",
  "filterType": "filter_select",
  "targets": [ { "column": { "name": "region" }, "datasetId": 10 } ],
  "controlValues": {
    "multiSelect": true, "enableEmptyFilter": false, "inverseSelection": false,
    "defaultToFirstItem": false, "searchAllOptions": false, "sortAscending": true
  },
  "defaultDataMask": { "filterState": { "value": ["North"] }, "extraFormData": {} },
  "scope": { "rootPath": ["ROOT_ID"], "excluded": [] },
  "chartsInScope": [101, 102],
  "type": "NATIVE_FILTER",
  "cascadeParentIds": []
}
```
- `filterType`: `filter_select`, `filter_range`, `filter_time`, `filter_timecolumn`, `filter_timegrain`.
- `targets[].column.name` + `datasetId`. ⚠️ On multi-dataset dashboards a `datasetId` lacking the column → "network error" on the filter. Pass the right `dataset_id` to `add_native_filter`.
- `controlValues` (select): `multiSelect`, `enableEmptyFilter` (required filter), `inverseSelection`, `defaultToFirstItem`, `searchAllOptions`, `sortAscending`, `creatable`.
- `defaultDataMask.filterState.value` = preselected.
- `scope.rootPath` where it applies, `excluded` = chart ids excluded.

Use `superset-agent`'s `add_native_filter(dashboard_id, column, filter_type, default_value, label, target_chart_ids, dataset_id)`.

### Cross-filtering
Lives under `json_metadata.chart_configuration` (per-chart `crossFilters.scope`/`chartsInScope`) + `global_chart_configuration`. In 6.0 cross-filtering is **on by default** — the old `DASHBOARD_CROSS_FILTERS` flag was removed.

## Dashboard CSS

Each dashboard has a `css` field (Edit dashboard → Edit CSS, or API `css`, or reusable CSS Templates — `CSS_TEMPLATES=True` default). Injected scoped to the dashboard. Set via `superset-agent`'s `set_dashboard_css(dashboard_id, css)`.

> **6.0 caveat:** Bootstrap/Font Awesome dropped; UI is Emotion + Antd v5, so many inner class names are hashed. Target the **structural wrapper** classes below; avoid deep Emotion classes.

**Stable selectors:** `.dashboard`, `.dashboard-content`, `.grid-content`, `.header-title`, `.editable-title`, `.dashboard-component-chart-holder` (chart card wrapper), `.dashboard-component-header`, `.filter-bar`, `.chart-header`, `.dashboard-markdown`.

**Clean modern example:**
```css
.dashboard { background-color: #f5f7fa; }
.dashboard-component-chart-holder {
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  background: #fff;
  overflow: hidden;
}
.header-title, .editable-title {
  font-family: Inter, sans-serif; font-weight: 600; color: #1a1a2e;
}
.filter-bar { background: #fff; border-right: 1px solid #e8e8e8; }
.dashboard-component-chart-holder .chart-header .header-title {
  font-size: 14px; letter-spacing: 0.2px;
}
```

## Markdown block sizing (avoid clipped text)

A `MARKDOWN` component has a **fixed** card height; if the rendered text is taller, it **clips and scrolls** — the heading or last lines vanish. Always size the block to its content. The default from `add_markdown_block` (height 10) clips anything past ~2 lines — **do not leave it**.

**Calibrated heights (8px grid unit, full-width header, verified on 6.x):** roughly heading ≈ 40px, each wrapped body line ≈ 24px, card padding ≈ 24px.

`height_units ≈ ceil( (40·has_heading + 24·body_lines + 24) / 8 )`

| Content | Min height |
|---|---|
| heading only | 9 |
| heading + 1–2 lines | 15 |
| heading + 3 lines | 18 |
| **heading + 4 lines** | **20** |
| 1–4 lines, no heading | 10 → 16 |

**Rule of thumb:** for a title block that must show **up to 4 lines without scrolling, use height ≥ 20.** When unsure, over-provision by a couple of units (a little whitespace beats clipped text) and **confirm with a screenshot** — text wraps differently by dashboard width, so a line that fits at width 12 may wrap (and clip) narrower. Count *wrapped* lines at the actual block width, not source lines.

```python
# superset-agent MCP: size the header to its content, don't accept the default
add_markdown_block(dashboard_id, md_text, width=12, height=20)  # heading + up to 4 lines
```

## Layout design checklist
- KPI row of `big_number_total` tiles first (short height, e.g. 4–6 width each).
- A `MARKDOWN` title/intro row at the very top (`add_markdown_block(position="top")`).
- Consistent chart heights within a row.
- Wide charts (tables, long bar lists) at `width: 12`.
- Native filters in the sidebar for the main dimensions.
- Light dashboard CSS for card shadows + background; don't over-style.
