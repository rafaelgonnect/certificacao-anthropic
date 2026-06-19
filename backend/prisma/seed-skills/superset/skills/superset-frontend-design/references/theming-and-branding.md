# Theming & branding (Superset 6.x)

Verified against `superset/config.py` (master) + official theming docs, June 2026.

## How it works

`THEME_DEFAULT` / `THEME_DARK` take an **Ant Design v5** theme object: `{ "token": {...}, "algorithm": "default"|"dark"|"compact" }`. Superset 6.0 replaced Bootstrap/Font Awesome with Emotion + Antd v5, so theming is now Antd-token-driven.

## The real shipped default (config.py)

```python
THEME_DEFAULT = {
    "token": {
        "brandAppName": APP_NAME,
        "brandLogoUrl": APP_ICON,
        "brandLogoHeight": "24px",
        "brandLogoMargin": "18px 0",
        "brandLogoHref": "/",
        "colorPrimary": "#2893B3",
        "colorLink": "#2893B3",
        "colorError": "#e04355",
        "colorWarning": "#fcc700",
        "colorSuccess": "#5ac189",
        "colorInfo": "#66bcfe",
        "fontFamily": "Inter, Helvetica, Arial, sans-serif",
        "fontFamilyCode": "'IBM Plex Mono', 'Courier New', monospace",
        "fontWeightNormal": "400", "fontWeightStrong": "500", "fontWeightBold": "700",
        # ...font sizes, transitionTiming, colorEditorSelection
    },
    "algorithm": "default",
}
THEME_DARK = {
    **THEME_DEFAULT,
    "token": { **THEME_DEFAULT["token"], "colorEditorSelection": "#5c4d1a" },
    "algorithm": "dark",
}
```

## Tokens you can set

**Color:** `colorPrimary`, `colorLink`, `colorSuccess`, `colorError`, `colorWarning`, `colorInfo`, `colorBgBase`, `colorBgContainer`, `colorBgLayout`, `colorTextBase`, `colorText`.
**Type/shape:** `fontFamily`, `fontFamilyCode`, `fontSize`, `borderRadius`, `controlHeight`.
**Superset brand:** `brandAppName`, `brandLogoUrl`, `brandLogoAlt`, `brandLogoHeight`, `brandLogoMargin`, `brandLogoHref`, `brandSpinnerUrl`/`brandSpinnerSvg`, font-weight tokens.

Every Antd v5 token works, plus the Superset brand tokens above.

## algorithm values
`"default"` (light), `"dark"` (auto-generates bg/text from seed tokens — override only what you need), `"compact"` (denser).

## Key behaviors
- **`THEME_DEFAULT = {}` (empty) is SAFE** — Superset validates theme JSON and falls back to built-in defaults on empty/invalid. It does **not** blank the UI. (Contrast with the `LANGUAGES={}` crash, which is a different subsystem.)
- **Force single theme:** set `THEME_DARK = None`. With both set, users can toggle + OS-preference detection.
- `ENABLE_UI_THEME_ADMINISTRATION = True` → admins manage themes in the UI; dashboards can carry per-dashboard themes.
- **Fonts:** `THEME_FONTS_MAX_URLS = 15`; allowed domains `fonts.googleapis.com`, `fonts.gstatic.com`, `use.typekit.net`, `use.typekit.com` (HTTPS only). Custom font URLs go in the `fontUrls` token.

## Custom color palettes (config.py)

```python
EXTRA_CATEGORICAL_COLOR_SCHEMES = [{
    "id": "myColors", "label": "My Colors", "isDefault": True,
    "colors": ["#006699", "#009DD9", "#5AAA46", "#FF7F44"],
}]
EXTRA_SEQUENTIAL_COLOR_SCHEMES = [{
    "id": "warmToHot", "label": "Warm to Hot", "isDiverging": True, "isDefault": True,
    "colors": ["#552288", "#5AAA46", "#FCC700", "#E04355"],
}]
```
Reference the `id` in a chart's `color_scheme` / `linear_color_scheme`. Both config keys default to `[]`.

## Branding
- `APP_NAME` → app title (superseded by `brandAppName` token when both set).
- `APP_ICON` → logo (superseded by `brandLogoUrl` token).
- `FAVICONS = [{"href": "/static/.../favicon.png"}]`.

## Deprecations / migration notes
- `THEME_OVERRIDES` is **deprecated** → use `THEME_DEFAULT`/`THEME_DARK`.
- Environment-tag colors accept only Antd semantic names now: `"success"`, `"processing"`, `"error"`, `"warning"`, `"default"` (e.g. `"error.base"` → `"error"`).
- 6.0 removed Bootstrap & Font Awesome.
