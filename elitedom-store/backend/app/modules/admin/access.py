"""Granular staff permissions and compatibility mappings for the admin control plane."""

from __future__ import annotations

from enum import StrEnum


class AdminPermission(StrEnum):
    DASHBOARD_VIEW = "dashboard.view"
    ORDERS_VIEW = "orders.view"
    ORDERS_MANAGE = "orders.manage"
    CATALOG_VIEW = "catalog.view"
    CATALOG_MANAGE = "catalog.manage"
    CATALOG_ARCHIVE = "catalog.archive"
    INVENTORY_VIEW = "inventory.view"
    INVENTORY_ADJUST = "inventory.adjust"
    CUSTOMERS_VIEW = "customers.view"
    SUPPORT_VIEW = "support.view"
    SUPPORT_MANAGE = "support.manage"
    RFQ_VIEW = "rfq.view"
    RFQ_QUOTE = "rfq.quote"
    SHIPMENTS_VIEW = "shipments.view"
    SHIPMENTS_DISPATCH = "shipments.dispatch"
    SUPPLIERS_VIEW = "suppliers.view"
    SUPPLIERS_MANAGE = "suppliers.manage"
    PAYMENTS_VIEW = "payments.view"
    PAYMENTS_REFUND = "payments.refund"
    REPORTS_VIEW = "reports.view"
    STAFF_VIEW = "staff.view"
    STAFF_MANAGE = "staff.manage"
    AUDIT_VIEW = "audit.view"
    INTEGRATIONS_VIEW = "integrations.view"
    INTEGRATIONS_MANAGE = "integrations.manage"
    CONFIG_VIEW = "config.view"
    CONFIG_MANAGE = "config.manage"


ALL_ADMIN_PERMISSIONS = frozenset(permission.value for permission in AdminPermission)

# Existing persisted roles remain valid. Stage 7 adds two deliberately broad staff
# profiles without requiring an auth-table rewrite, while permission checks below
# become the authoritative boundary for administrative actions.
STAFF_ROLES = frozenset(
    {
        "system_admin",
        "operations_manager",
        "finance_officer",
        "inventory_manager",
        "warehouse_operator",
        "customer_support",
        "content_catalog",
    }
)

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "system_admin": ALL_ADMIN_PERMISSIONS,
    "operations_manager": frozenset(
        {
            AdminPermission.DASHBOARD_VIEW,
            AdminPermission.ORDERS_VIEW,
            AdminPermission.ORDERS_MANAGE,
            AdminPermission.CATALOG_VIEW,
            AdminPermission.INVENTORY_VIEW,
            AdminPermission.CUSTOMERS_VIEW,
            AdminPermission.SUPPORT_VIEW,
            AdminPermission.SUPPORT_MANAGE,
            AdminPermission.SHIPMENTS_VIEW,
            AdminPermission.SHIPMENTS_DISPATCH,
            AdminPermission.SUPPLIERS_VIEW,
            AdminPermission.REPORTS_VIEW,
            AdminPermission.PAYMENTS_VIEW,
            AdminPermission.INTEGRATIONS_VIEW,
        }
    ),
    "finance_officer": frozenset(
        {
            AdminPermission.DASHBOARD_VIEW,
            AdminPermission.ORDERS_VIEW,
            AdminPermission.CUSTOMERS_VIEW,
            AdminPermission.RFQ_VIEW,
            AdminPermission.RFQ_QUOTE,
            AdminPermission.PAYMENTS_VIEW,
            AdminPermission.PAYMENTS_REFUND,
            AdminPermission.REPORTS_VIEW,
            AdminPermission.AUDIT_VIEW,
        }
    ),
    "inventory_manager": frozenset(
        {
            AdminPermission.DASHBOARD_VIEW,
            AdminPermission.CATALOG_VIEW,
            AdminPermission.CATALOG_MANAGE,
            AdminPermission.INVENTORY_VIEW,
            AdminPermission.INVENTORY_ADJUST,
            AdminPermission.SHIPMENTS_VIEW,
            AdminPermission.SUPPLIERS_VIEW,
            AdminPermission.SUPPLIERS_MANAGE,
            AdminPermission.REPORTS_VIEW,
        }
    ),
    "warehouse_operator": frozenset(
        {
            AdminPermission.DASHBOARD_VIEW,
            AdminPermission.ORDERS_VIEW,
            AdminPermission.ORDERS_MANAGE,
            AdminPermission.CATALOG_VIEW,
            AdminPermission.INVENTORY_VIEW,
            AdminPermission.SHIPMENTS_VIEW,
            AdminPermission.SHIPMENTS_DISPATCH,
        }
    ),
    "customer_support": frozenset(
        {
            AdminPermission.DASHBOARD_VIEW,
            AdminPermission.ORDERS_VIEW,
            AdminPermission.CUSTOMERS_VIEW,
            AdminPermission.SUPPORT_VIEW,
            AdminPermission.SUPPORT_MANAGE,
            AdminPermission.SHIPMENTS_VIEW,
        }
    ),
    "content_catalog": frozenset(
        {
            AdminPermission.DASHBOARD_VIEW,
            AdminPermission.CATALOG_VIEW,
            AdminPermission.CATALOG_MANAGE,
        }
    ),
}


def permissions_for_role(role: str | None) -> frozenset[str]:
    """Return the default permission set for a persisted staff role."""
    if not role:
        return frozenset()
    return ROLE_PERMISSIONS.get(role, frozenset())


def is_staff_role(role: str | None) -> bool:
    return bool(role and role in STAFF_ROLES)
