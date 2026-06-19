"""Inspect a Superset 6.x instance in a real browser: bootstrap health + login + dashboard screenshot.

Usage:
    py playwright_inspect.py <BASE_URL> <USER> <PASS> [DASHBOARD_ID]

Catches the LANGUAGES/flag bootstrap crash (blank UI while the REST API works),
handles the Ant Design React login form (selectors exist only after JS renders),
and screenshots the dashboard so you can judge the actual design.

Requires: pip install playwright ; playwright install chromium
"""
import sys, json, os

def main():
    if len(sys.argv) < 4:
        print(__doc__); sys.exit(1)
    BASE = sys.argv[1].rstrip("/")
    USER, PASS = sys.argv[2], sys.argv[3]
    DASH = sys.argv[4] if len(sys.argv) > 4 else None
    OUT = os.path.join(os.getcwd(), "_superset_inspect")
    os.makedirs(OUT, exist_ok=True)

    from playwright.sync_api import sync_playwright

    errs = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        pg = b.new_context(viewport={"width": 1600, "height": 1200}).new_page()
        pg.on("console", lambda m: errs.append(("console", m.text[:240])) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(("pageerror", str(e)[:240])))

        # --- bootstrap health on the login page ---
        pg.goto(f"{BASE}/login/", wait_until="networkidle")
        pg.wait_for_timeout(3500)
        boot = pg.evaluate("() => document.getElementById('app')?.getAttribute('data-bootstrap')")
        if boot:
            c = json.loads(boot).get("common", {})
            print("bootstrap | locale:", c.get("locale"),
                  "| languages:", list((c.get("languages") or {}).keys()))
        flag_crash = any("reading 'flag'" in t or "reading \"flag\"" in t for _, t in errs)
        print("flag-crash present:", flag_crash, "| #username rendered:", pg.locator("#username").count())
        if flag_crash and pg.locator("#username").count() == 0:
            print("\n>>> LANGUAGES bootstrap crash. Define LANGUAGES in superset_config.py and REBUILD.")
            pg.screenshot(path=os.path.join(OUT, "00_blank_login.png"), full_page=True)
            b.close(); return

        # --- login (wait for the AntD form first) ---
        pg.wait_for_selector("#username", timeout=15000)
        pg.fill("#username", USER); pg.fill("#password", PASS)
        pg.click("button[type=submit]")
        pg.wait_for_load_state("networkidle")
        if "/login" in pg.url and "welcome" not in pg.url:
            print("LOGIN FAILED -> url:", pg.url)
            b.close(); return
        print("login OK -> ", pg.url)

        if not DASH:
            b.close(); return

        # --- dashboard ---
        pg.goto(f"{BASE}/superset/dashboard/{DASH}/", wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(8000)  # ECharts paint
        shot = os.path.join(OUT, f"dashboard_{DASH}.png")
        pg.screenshot(path=shot, full_page=True)
        conts = pg.locator("[data-test='chart-container']")
        print(f"charts: {conts.count()} | screenshot: {shot}")
        for i in range(conts.count()):
            print(f"  [{i}]", repr(conts.nth(i).inner_text()[:100]))
        b.close()

if __name__ == "__main__":
    main()
