"""superset.py — Django service to mint Superset guest tokens (server-side).

Drop this in your Django app (e.g. myapp/superset.py) and import the singleton
`superset`. It logs in to Superset as admin (cached), resolves the embedded
dashboard UUID (cached), and mints short-lived per-tenant guest tokens carrying
an RLS clause. The admin password NEVER leaves the server.

Requires: `requests`. Uses Django's cache framework + settings.

settings.py:
    SUPERSET_URL = env("SUPERSET_URL")                         # https://superset-dev.colaborativa.com.br
    SUPERSET_ADMIN_USERNAME = env("SUPERSET_ADMIN_USERNAME")   # "admin"
    SUPERSET_ADMIN_PASSWORD = env("SUPERSET_ADMIN_PASSWORD")   # secret
    SUPERSET_TIMEOUT = 30
"""
from __future__ import annotations

import logging
from typing import Any

import requests
from django.conf import settings
from django.core.cache import cache

log = logging.getLogger(__name__)

# admin token lives ~30 min server-side (GUEST_TOKEN/JWT exp); cache below that
_ADMIN_TOKEN_TTL = 25 * 60
_ADMIN_TOKEN_KEY = "superset:admin_token"
_EMBED_UUID_KEY = "superset:embedded_uuid:{dash}"


class SupersetEmbedError(Exception):
    """Raised when Superset is unreachable or rejects a request."""


def _rls_literal(value: Any) -> str:
    """SQL literal for an RLS clause: numbers bare, bool TRUE/FALSE, else quoted."""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


class SupersetService:
    def __init__(self) -> None:
        self.base = settings.SUPERSET_URL.rstrip("/")
        self.user = settings.SUPERSET_ADMIN_USERNAME
        self.password = settings.SUPERSET_ADMIN_PASSWORD
        self.timeout = getattr(settings, "SUPERSET_TIMEOUT", 30)

    # ---- admin auth (cached, auto-refresh) ----
    def _login(self) -> str:
        try:
            r = requests.post(
                f"{self.base}/api/v1/security/login",
                json={"username": self.user, "password": self.password,
                      "provider": "db", "refresh": True},
                timeout=self.timeout,
            )
            r.raise_for_status()
            token = r.json()["access_token"]
        except (requests.RequestException, KeyError, ValueError) as e:
            raise SupersetEmbedError(f"Superset login failed: {e}") from e
        cache.set(_ADMIN_TOKEN_KEY, token, _ADMIN_TOKEN_TTL)
        return token

    def _admin_token(self, force: bool = False) -> str:
        if not force:
            cached = cache.get(_ADMIN_TOKEN_KEY)
            if cached:
                return cached
        return self._login()

    def _admin_request(self, method: str, path: str, **kw) -> requests.Response:
        """Authenticated admin call; retries once on 401 (token expired)."""
        for attempt in (1, 2):
            tok = self._admin_token(force=(attempt == 2))
            r = requests.request(
                method, f"{self.base}{path}",
                headers={"Authorization": f"Bearer {tok}"},
                timeout=self.timeout, **kw,
            )
            if r.status_code == 401 and attempt == 1:
                continue
            return r
        return r  # pragma: no cover

    # ---- embedded uuid (cached) ----
    def embedded_uuid(self, dashboard_id: int) -> str:
        key = _EMBED_UUID_KEY.format(dash=dashboard_id)
        cached = cache.get(key)
        if cached:
            return cached
        r = self._admin_request("GET", f"/api/v1/dashboard/{dashboard_id}/embedded")
        if r.status_code == 404:
            # not embedded yet — enable it (idempotent). Restrict allowed_domains
            # in production to your app's origin(s).
            r = self._admin_request(
                "POST", f"/api/v1/dashboard/{dashboard_id}/embedded",
                json={"allowed_domains": getattr(settings, "SUPERSET_ALLOWED_DOMAINS", [])},
            )
        if not r.ok:
            raise SupersetEmbedError(f"embedded uuid lookup failed: {r.status_code} {r.text[:200]}")
        uuid = r.json()["result"]["uuid"]
        cache.set(key, uuid, 60 * 60)
        return uuid

    # ---- guest token (per request, NOT cached) ----
    def guest_token_for_tenant(
        self,
        dashboard_id: int,
        tenant_value: Any,
        dataset_id: int | None = None,
        tenant_column: str | None = None,
        username: str = "guest",
    ) -> str:
        """Mint a guest token scoped to one tenant.

        tenant_value MUST come from the server (request.user), never the client.
        Builds rls clause `<tenant_column> = <tenant_value>` scoped to dataset_id
        (omit dataset_id to apply to all datasets in the dashboard).
        """
        column = tenant_column or settings.SUPERSET_TENANT_COLUMN
        rls: dict[str, Any] = {"clause": f"{column} = {_rls_literal(tenant_value)}"}
        if dataset_id is not None:
            rls["dataset"] = int(dataset_id)
        body = {
            "user": {"username": str(username), "first_name": "Guest", "last_name": str(tenant_value)},
            "resources": [{"type": "dashboard", "id": self.embedded_uuid(dashboard_id)}],
            "rls": [rls],
        }
        r = self._admin_request("POST", "/api/v1/security/guest_token/", json=body)
        if not r.ok:
            raise SupersetEmbedError(f"guest token mint failed: {r.status_code} {r.text[:200]}")
        return r.json()["token"]


superset = SupersetService()
