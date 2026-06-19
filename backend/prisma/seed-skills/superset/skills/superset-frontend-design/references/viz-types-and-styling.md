# Viz types & chart styling (Superset 6.x)

Facts verified against `apache/superset` master (6.x) source + official docs, June 2026.

## Modern viz_type catalog

The `viz_type` stored in `form_data` is the plugin's **registration key** (from `superset-frontend/src/visualizations/presets/MainPreset.ts`), not its display name.

### ECharts time-series / cartesian
| viz_type | Use |
|---|---|
| `echarts_timeseries_bar` | Bar (time **or** categorical x) — replaces legacy `bar`, `dist_bar` |
| `echarts_timeseries_line` | Line — replaces legacy `line` |
| `echarts_timeseries_smooth` | Smooth/curved line |
| `echarts_timeseries_step` | Step line |
| `echarts_timeseries_scatter` | Scatter on time/cartesian axis |
| `echarts_area` | Area — replaces legacy `area` |
| `mixed_timeseries` | Two y-axes / two query sets — replaces legacy `dual_line` |

### KPI / tables
| viz_type | Use |
|---|---|
| `big_number_total` | Single big number, no trendline (MCP friendly name `big_number` → this) |
| `big_number` | Big number **with** trendline (MCP friendly `big_number_trend` → this) |
| `big_number_period_over_period` | Period-over-period KPI |
| `table` | Standard table |
| `ag_grid_table` | AG Grid Table V2 (6.0+, gated by `AG_GRID_TABLE_ENABLED`, up to ~500k rows, server-side paging) |
| `pivot_table_v2` | Pivot table |

### Part-to-whole / distribution / hierarchy
| viz_type | Use |
|---|---|
| `pie` | Pie / donut |
| `funnel` | Funnel |
| `gauge_chart` | Gauge |
| `radar` | Radar / spider |
| `treemap_v2` | Treemap (replaces legacy `treemap`) |
| `sunburst_v2` | Sunburst (replaces legacy `sunburst`) |
| `sankey_v2` | Sankey (replaces legacy `sankey`) |
| `histogram_v2` | Histogram (MCP friendly `histogram`) |
| `box_plot` | Box plot |
| `heatmap_v2` | Heatmap (replaces legacy `heatmap`) |
| `waterfall` | Waterfall |
| `bubble_v2` / `echarts_bubble` | Bubble |

### Graph / geo
`graph_chart` (network), `tree_chart`, `chord`, `world_map`, `country_map`, `deck_*` (deck.gl layers: `deck_scatter`, `deck_geojson`, …).

### Native-filter plugin keys
`filter_select`, `filter_range`, `filter_time`, `filter_timecolumn`, `filter_timegrain`.

## ⚠️ Legacy → modern migration (removed in 5.0→6.0, SIP-65)
The API **saves** legacy keys but they render as *"Item with key X is not registered"*.

| Removed legacy | Modern |
|---|---|
| `dist_bar`, `bar` | `echarts_timeseries_bar` |
| `line` | `echarts_timeseries_line` |
| `area` | `echarts_area` |
| `dual_line` | `mixed_timeseries` |
| `heatmap` | `heatmap_v2` |
| `treemap` | `treemap_v2` |
| `sankey` | `sankey_v2` |
| `sunburst` | `sunburst_v2` |
| `histogram` | `histogram_v2` |

> Always use the modern key. The `superset-agent` MCP `create_simple_chart` and `migrate_legacy_viz_types` handle this; `create_chart` rejects bare legacy keys.

## Chart styling form_data params

| Key | Values / notes |
|---|---|
| `color_scheme` | categorical scheme id (§ palettes), e.g. `supersetColors`, `d3Category10`, `googleCategory10c` |
| `linear_color_scheme` | sequential/diverging id for heatmaps/maps, e.g. `superset_seq_1`, `blue_white_yellow`, `schemeViridis` |
| `show_legend` | `true`/`false` |
| `legendType` | `"scroll"` \| `"plain"` |
| `legendOrientation` | `"top"`/`"bottom"`/`"left"`/`"right"` |
| `show_value` | `true` — value labels on bars/lines |
| `stack` / `stacked_style` | bar boolean `stack`; area: `null`/`"Stack"`/`"Stream"`/`"Expand"` |
| `opacity` | area fill `0`–`1` (default `0.7`) |
| `y_axis_format`, `number_format` | D3 number format or named (§ formats) |
| `x_axis_time_format`, `time_format` | D3 time format or `smart_date` |
| `y_axis_bounds` | `[min, max]` |
| `xAxisLabelRotation` / `yAxisLabelRotation` | `0`/`45`/`90` |
| `rich_tooltip`, `tooltipSortByMetric` | `true`/`false` |
| `markerEnabled`, `markerSize` | line markers |
| `sort_by_metric`, `order_desc` | `true` to rank by metric desc |
| `row_limit` | integer |
| `time_grain_sqla` | `PT1S`,`PT1M`,`PT5M`,`PT15M`,`PT30M`,`PT1H`,`P1D`,`P1W`,`P1M`,`P3M`,`P1Y` |

To restyle an API-created chart: `get_chart` → edit the `params` JSON → `update_chart(id, {"params": <json string>})`. Keep `viz_type` modern.

## D3 number formats (most useful)

Grammar: `[[fill]align][sign][symbol][0][width][,][.precision][~][type]`

| Specifier | Example | Meaning |
|---|---|---|
| `,d` | `42,000` | integer + thousands sep (Superset `INTEGER`) |
| `.1f` / `,.1f` | `0.3` / `1,234.5` | fixed 1 decimal |
| `,.2f` | `1,234.50` | fixed 2 decimals |
| `.0%` | `12%` | percent, 0 dec (value ×100) |
| `,.1%` | `45.6%` | percent, 1 dec |
| `$,.2f` | `$1,234.50` | currency 2 dec |
| `$,d` | `$1,235` | currency rounded |
| `.2s` / `~s` | `42M` / `1.5k` | SI prefix (`~` trims zeros) |
| `.2e` | `4.2e+4` | exponent |

**Named (non-d3):** `SMART_NUMBER` (adaptive 1.2k/3.4M), `SMART_NUMBER_SIGNED`, `OVER_MAX_HIDDEN`, `DURATION` (ms → `1h 2m`, a separate formatter — pick it from the format dropdown, not a d3 string).

## D3 time formats

| Pattern / name | Example |
|---|---|
| `%Y-%m-%d` (`DATABASE_DATE`) | `2026-06-08` |
| `%Y-%m-%d %H:%M:%S` | `2026-06-08 14:30:00` |
| `%d/%m/%Y` (`INTERNATIONAL_DATE`) | `08/06/2026` |
| `%H:%M:%S` | `14:30:00` |
| `smart_date` | adaptive |
| `local!%Y-%m-%d` | force local timezone |

Directives: `%b`/`%B` (month), `%a`/`%A` (weekday), `%H`/`%I`/`%p`, `%j`, `%U`/`%W`.

## Color palettes

**Categorical ids:** `supersetColors`, `d3Category10`, `d3Category20`/`20b`/`20c`, `googleCategory10c`, `googleCategory20c`, `bnbColors`, `lyftColors`, `echarts4Colors`, `echarts5Colors`, `presetColors`, `modernSunset`, `colorsOfRainbow`, `blueToGreen`, `redToYellow`, `wavesOfBlue`.
`supersetColors` = `#1FA8C9 #454E7C #5AC189 #FF7F44 #666666 #E04355 #FCC700 #A868B7 #3CCCCB #A38F79` (+10 pastels).

**Sequential/diverging ids:** `blue_white_yellow`, `fire`, `dark_blue`, `greens`, `purples`, `oranges`, `red_yellow_blue`, `superset_seq_1/2`, `superset_div_1/2`, plus d3 `schemeViridis`, `schemeInferno`, `schemeMagma`, `schemeBlues`, `schemeRdYlBu`, `schemeSpectral`, `schemeYlOrRd`.

**Custom palettes** (config.py): `EXTRA_CATEGORICAL_COLOR_SCHEMES` / `EXTRA_SEQUENTIAL_COLOR_SCHEMES` — see `theming-and-branding.md`.
