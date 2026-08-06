"""Static validation for the bundled Odoo 17 addon."""

from __future__ import annotations

import ast
import csv
import sys
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
ADDON = ROOT / "odoo" / "addons" / "elitedom_connector"

REQUIRED_FILES = {
    "__init__.py",
    "__manifest__.py",
    "models/__init__.py",
    "models/webhook_outbox.py",
    "models/product_outbox.py",
    "models/product_catalog.py",
    "services/payloads.py",
    "security/ir.model.access.csv",
    "data/ir_cron.xml",
    "views/res_config_settings_views.xml",
    "views/product_template_views.xml",
    "views/webhook_outbox_views.xml",
}
EXPECTED_ENDPOINTS = {"/product", "/inventory", "/order-status"}


def fail(message: str) -> None:
    raise SystemExit(f"Odoo addon validation failed: {message}")


def validate_manifest() -> dict:
    manifest_path = ADDON / "__manifest__.py"
    try:
        manifest = ast.literal_eval(manifest_path.read_text(encoding="utf-8"))
    except (OSError, SyntaxError, ValueError) as error:
        fail(f"invalid manifest: {error}")
    if not isinstance(manifest, dict):
        fail("manifest must be a dictionary")
    if not str(manifest.get("version", "")).startswith("17.0."):
        fail("manifest version must target Odoo 17")
    required_dependencies = {
        "base",
        "product",
        "sale_management",
        "sale_stock",
        "stock",
        "delivery",
    }
    if not required_dependencies.issubset(set(manifest.get("depends", []))):
        fail("manifest is missing required product/sales/stock/delivery dependencies")
    for relative_path in manifest.get("data", []):
        if not (ADDON / relative_path).is_file():
            fail(f"manifest data file does not exist: {relative_path}")
    return manifest


def validate_python() -> None:
    for path in ADDON.rglob("*.py"):
        try:
            compile(path.read_text(encoding="utf-8"), str(path), "exec")
        except (OSError, SyntaxError) as error:
            fail(f"Python syntax error in {path.relative_to(ADDON)}: {error}")


def validate_xml() -> None:
    for path in ADDON.rglob("*.xml"):
        try:
            root = ElementTree.parse(path).getroot()
        except (OSError, ElementTree.ParseError) as error:
            fail(f"XML error in {path.relative_to(ADDON)}: {error}")
        if root.tag != "odoo":
            fail(f"{path.relative_to(ADDON)} must have an <odoo> root")


def validate_access_csv() -> None:
    path = ADDON / "security" / "ir.model.access.csv"
    with path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    expected_columns = {
        "id",
        "name",
        "model_id:id",
        "group_id:id",
        "perm_read",
        "perm_write",
        "perm_create",
        "perm_unlink",
    }
    if not rows or set(rows[0]) != expected_columns:
        fail("access CSV header or rows are invalid")
    if any(row["group_id:id"] != "base.group_system" for row in rows):
        fail("webhook outbox access must remain restricted to system administrators")


def validate_contract() -> None:
    model_source = "\n".join(
        path.read_text(encoding="utf-8") for path in (ADDON / "models").glob("*.py")
    )
    missing = [endpoint for endpoint in EXPECTED_ENDPOINTS if endpoint not in model_source]
    if missing:
        fail(f"missing FastAPI contract endpoints: {', '.join(missing)}")
    outbox_source = (ADDON / "models" / "webhook_outbox.py").read_text(encoding="utf-8")
    if "X-Elitedom-Signature" not in outbox_source or "X-Idempotency-Key" not in outbox_source:
        fail("signed/idempotent request headers are missing")
    if "CHANGE_ME" in model_source:
        fail("runtime source must not contain a default shared secret")


def main() -> int:
    if not ADDON.is_dir():
        fail(f"addon directory not found: {ADDON}")
    missing = sorted(path for path in REQUIRED_FILES if not (ADDON / path).is_file())
    if missing:
        fail(f"required files missing: {', '.join(missing)}")
    validate_manifest()
    validate_python()
    validate_xml()
    validate_access_csv()
    validate_contract()
    print(f"Validated Odoo addon: {ADDON}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
