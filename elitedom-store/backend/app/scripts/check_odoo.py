"""Fail-fast Odoo connectivity and addon readiness smoke check."""

from __future__ import annotations

import json
import sys

from app.integrations.odoo.client import odoo_client


def main() -> int:
    if not odoo_client.is_configured:
        print(
            json.dumps(
                {
                    "status": "failed",
                    "reason": "odoo_sync_disabled_or_unconfigured",
                }
            )
        )
        return 2

    try:
        version = odoo_client.server_version()
        uid = odoo_client.authenticate()
        connector = odoo_client.connector_module_status()
    except Exception as error:
        print(
            json.dumps(
                {
                    "status": "failed",
                    "reason": error.__class__.__name__,
                    "detail": str(error),
                }
            )
        )
        return 1

    result = {
        "status": "ok" if connector.get("state") == "installed" else "failed",
        "uid": uid,
        "server_version": version.get("server_version"),
        "connector": connector,
    }
    print(json.dumps(result, default=str))
    return 0 if result["status"] == "ok" else 3


if __name__ == "__main__":
    sys.exit(main())
