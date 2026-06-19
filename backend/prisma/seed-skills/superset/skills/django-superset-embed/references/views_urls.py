"""views.py + urls.py — wire the embed page and the guest-token endpoint.

The tenant boundary is `request.user.escola_id` (server-derived). A user can
NEVER request another tenant's data, because the value is never read from the
request body/query. Both views require login.
"""
# ---------------- views.py ----------------
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseServerError
from django.shortcuts import render

from .superset import superset, SupersetEmbedError

# Map your app's dashboards to Superset dashboard ids (avoid trusting client ids
# blindly; resolve a friendly key to an id you control).
DASHBOARDS = {
    "painel-escola": 12,
}
DEFAULT_DASHBOARD = "painel-escola"


def _tenant_value(user):
    # Adapt to your model: a field on User, or user.profile.escola_id, etc.
    value = getattr(user, "escola_id", None)
    if value is None:
        raise SupersetEmbedError("usuário sem escola_id (tenant) definido")
    return value


@login_required
def dashboard_page(request):
    key = request.GET.get("painel", DEFAULT_DASHBOARD)
    dashboard_id = DASHBOARDS.get(key, DASHBOARDS[DEFAULT_DASHBOARD])
    try:
        uuid = superset.embedded_uuid(dashboard_id)
    except SupersetEmbedError as e:
        return HttpResponseServerError(f"Superset indisponível: {e}")
    return render(request, "dashboard.html", {
        "embedded_uuid": uuid,
        "superset_domain": settings.SUPERSET_URL,
        "dashboard_id": dashboard_id,
    })


@login_required
def guest_token(request):
    key = request.GET.get("dashboard")
    # Resolve to an id we control; fall back to the friendly map.
    try:
        dashboard_id = int(key)
    except (TypeError, ValueError):
        dashboard_id = DASHBOARDS.get(key, DASHBOARDS[DEFAULT_DASHBOARD])
    try:
        token = superset.guest_token_for_tenant(
            dashboard_id=dashboard_id,
            tenant_value=_tenant_value(request.user),   # the security boundary
            dataset_id=getattr(settings, "SUPERSET_TENANT_DATASET_ID", None),
        )
    except SupersetEmbedError as e:
        return JsonResponse({"error": str(e)}, status=502)
    return JsonResponse({"token": token})


# ---------------- urls.py ----------------
from django.urls import path
from . import views

urlpatterns = [
    path("dashboard/", views.dashboard_page, name="dashboard"),
    path("superset/guest-token/", views.guest_token, name="superset_guest_token"),
]
