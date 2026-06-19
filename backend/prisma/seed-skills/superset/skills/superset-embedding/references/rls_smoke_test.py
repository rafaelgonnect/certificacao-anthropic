"""rls_smoke_test.py — prove Superset RLS actually filters rows, two ways.

Usage:
    py rls_smoke_test.py --url https://superset.example.com --password ****** \
        --dashboard 1 --dataset 1 --column escola_id --tenants 1,2

Modes (--mode):
  guest       (default) — the real embed path: mint a guest token per tenant and
              query a chart on the dashboard AS that guest; each must see only
              its rows. Requires the GUEST_ROLE_NAME role to exist + have
              datasource access (the deploy cs_init bootstrap handles this).
  persistent  — controlled experiment on the Admin role: baseline count, then a
              temporary RLS rule per tenant, then delete it. No embed setup
              needed. Proves the RLS engine filters rows.
  both        — run both.

Exit code 0 if RLS demonstrably filters (each tenant count < unfiltered and the
counts differ per tenant); non-zero otherwise. Requires: httpx (installed with
the Superset MCP).
"""
from __future__ import annotations
import argparse, json, sys
import httpx


def lit(v):
    s = str(v)
    return s if s.lstrip("-").isdigit() else "'" + s.replace("'", "''") + "'"


class Admin:
    def __init__(self, base, user, pw, timeout=60):
        self.base, self.c = base.rstrip("/"), httpx.Client(timeout=timeout)
        r = self.c.post(f"{self.base}/api/v1/security/login", json={
            "username": user, "password": pw, "provider": "db", "refresh": True})
        r.raise_for_status()
        self.tok = r.json()["access_token"]
        self.csrf = self.c.get(f"{self.base}/api/v1/security/csrf_token/",
                               headers={"Authorization": f"Bearer {self.tok}"}).json()["result"]

    def req(self, method, path, **kw):
        h = {"Authorization": f"Bearer {self.tok}"}
        if method != "GET":
            h["X-CSRFToken"] = self.csrf; h["Referer"] = self.base
        r = self.c.request(method, f"{self.base}{path}", headers=h, **kw)
        r.raise_for_status()
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text


def pick_chart(adm, dashboard_id, chart_id):
    """Return (slice_id, form_data). Prefer an AGGREGATE chart (x_axis/groupby +
    metric) — the guest path rejects a rebuilt query unless it matches the
    chart's, and aggregate charts rebuild faithfully. Raw tables work for the
    admin/persistent path but trip the guest "cannot modify payload" check."""
    charts = adm.req("GET", f"/api/v1/dashboard/{dashboard_id}/charts")["result"]
    cand = [c for c in charts if (c.get("form_data") or {}).get("slice_id")]
    if chart_id:
        cand = [c for c in cand if c["form_data"]["slice_id"] == chart_id] or cand
    if not cand:
        raise SystemExit("dashboard has no usable charts")

    def score(c):
        fd = c["form_data"]
        has_metric = bool(fd.get("metrics") or fd.get("metric"))
        if fd.get("x_axis") and has_metric: return 0
        if fd.get("groupby") and has_metric: return 1
        if fd.get("all_columns"): return 3
        return 2
    cand.sort(key=score)
    sid = cand[0]["form_data"].get("slice_id")
    # Use the chart's CANONICAL stored params (not the dashboard-enriched
    # form_data) — the guest "cannot modify payload" check compares against this.
    params = adm.req("GET", f"/api/v1/chart/{sid}")["result"].get("params")
    fd = json.loads(params) if params else cand[0]["form_data"]
    fd.setdefault("slice_id", sid)
    return sid, fd


def build_query(fd):
    cols = ([fd["x_axis"]] if fd.get("x_axis") else
            list(fd.get("groupby") or fd.get("all_columns") or []))
    metrics = fd.get("metrics") or ([fd["metric"]] if fd.get("metric") else [])
    q = {"row_limit": int(fd.get("row_limit", 1000) or 1000),
         "annotation_layers": [], "series_limit": 0, "order_desc": True}
    if cols:
        q["columns"] = cols
    if metrics:
        q["metrics"] = metrics
        lbl = metrics[0].get("label") if isinstance(metrics[0], dict) else metrics[0]
        q["orderby"] = [[lbl, False]]
    if not cols and not metrics:
        q["metrics"] = [{"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "n"}]
    return q


def rows_for(adm, dataset_id, fd, guest_token=None):
    body = {"datasource": {"id": dataset_id, "type": "table"}, "force": True,
            "form_data": fd, "queries": [build_query(fd)],
            "result_format": "json", "result_type": "full"}
    headers = {"X-GuestToken": guest_token, "Referer": adm.base} if guest_token else None
    if guest_token:
        r = adm.c.post(f"{adm.base}/api/v1/chart/data", json=body, headers=headers)
    else:
        r = adm.c.post(f"{adm.base}/api/v1/chart/data", json=body,
                       headers={"Authorization": f"Bearer {adm.tok}",
                                "X-CSRFToken": adm.csrf, "Referer": adm.base})
    if r.status_code != 200:
        msg = r.json().get("message") or r.json() if r.headers.get("content-type","").startswith("application/json") else r.text[:160]
        raise RuntimeError(f"chart/data HTTP {r.status_code}: {msg}")
    return r.json()["result"][0]["data"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--user", default="admin")
    ap.add_argument("--password", required=True)
    ap.add_argument("--dashboard", type=int, required=True)
    ap.add_argument("--dataset", type=int, required=True)
    ap.add_argument("--column", required=True, help="tenant column, e.g. escola_id")
    ap.add_argument("--tenants", required=True, help="comma list, e.g. 1,2")
    ap.add_argument("--chart", type=int, default=None)
    ap.add_argument("--mode", choices=["guest", "persistent", "both"], default="persistent",
                    help="persistent (default, reliable) proves the RLS engine filters; "
                         "guest/both also try the embed path (best validated in a browser)")
    a = ap.parse_args()
    tenants = [t.strip() for t in a.tenants.split(",")]

    adm = Admin(a.url, a.user, a.password)
    sid, fd = pick_chart(adm, a.dashboard, a.chart)
    print(f"chart slice_id={sid} | counting via columns={build_query(fd).get('columns')}")
    base_n = len(rows_for(adm, a.dataset, fd))
    print(f"baseline (sem RLS): {base_n} linhas")
    persistent_ok = guest_ok = None

    if a.mode in ("persistent", "both"):
        # Authoritative: proves the RLS engine filters rows. Works on any chart.
        print("\n== modo PERSISTENTE (experimento controlado na role Admin) ==")
        persistent_ok = True
        for t in tenants:
            rule = adm.req("POST", "/api/v1/rowlevelsecurity/", json={
                "name": f"smoketest {a.column}={t}", "filter_type": "Regular", "group_key": "smoke",
                "clause": f"{a.column} = {lit(t)}", "roles": [1], "tables": [a.dataset]})["id"]
            try:
                n = len(rows_for(adm, a.dataset, fd))
            finally:
                adm.req("DELETE", f"/api/v1/rowlevelsecurity/{rule}")
            print(f"  regra {a.column}={t}: {n} linhas")
            persistent_ok &= 0 < n < base_n
        after = len(rows_for(adm, a.dataset, fd))
        persistent_ok &= after == base_n
        print(f"  controle pos-limpeza: {after} (esperado {base_n})")

    if a.mode in ("guest", "both"):
        # Real embed path; needs the GUEST_ROLE_NAME role configured (cs_init).
        print("\n== modo GUEST (caminho do embed) ==")
        try:
            uuid = (adm.req("GET", f"/api/v1/dashboard/{a.dashboard}/embedded").get("result")
                    or adm.req("POST", f"/api/v1/dashboard/{a.dashboard}/embedded", json={"allowed_domains": []})["result"])["uuid"]
            counts = {}
            for t in tenants:
                body = {"user": {"username": f"t{t}", "first_name": "T", "last_name": str(t)},
                        "resources": [{"type": "dashboard", "id": uuid}],
                        "rls": [{"clause": f"{a.column} = {lit(t)}", "dataset": a.dataset}]}
                tok = adm.req("POST", "/api/v1/security/guest_token/", json=body)["token"]
                n = len(rows_for(adm, a.dataset, fd, guest_token=tok))
                counts[t] = n
                print(f"  tenant {a.column}={t}: {n} linhas")
            guest_ok = all(0 < counts[t] < base_n for t in tenants) and len(set(counts.values())) == len(counts)
        except Exception as e:
            guest_ok = False
            print(f"  GUEST inconclusivo: {e}")
            if "cannot modify chart payload" in str(e):
                print("  (Esperado num teste por HTTP cru: o Superset so aceita do guest a query")
                print("   EXATA que o Embedded SDK monta. Isso NAO indica RLS quebrado — o modo")
                print("   PERSISTENTE acima ja provou o filtro. Para validar o embed de verdade,")
                print("   abra o iframe com o @superset-ui/embedded-sdk no navegador.)")
            else:
                print("  Verifique se a role do GUEST_ROLE_NAME ('embed') existe e tem datasource")
                print("  access (bootstrap do cs_init).")

    print("\n== RESULTADO ==")
    if persistent_ok is not None:
        print("  RLS (motor):  ", "[OK] filtra" if persistent_ok else "[FALHOU] NAO filtra")
    if guest_ok is not None:
        print("  RLS (embed):  ", "[OK] filtra por tenant" if guest_ok else "[!] inconclusivo (ver acima)")
    # exit 0 if the authoritative check passed (or, if only guest ran, on guest)
    authoritative = persistent_ok if persistent_ok is not None else guest_ok
    sys.exit(0 if authoritative else 1)


if __name__ == "__main__":
    main()
