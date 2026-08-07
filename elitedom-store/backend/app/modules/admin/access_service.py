"""Runtime authorization, staff access administration, and audit persistence."""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from fastapi import Request
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Partner
from app.modules.admin.access import ALL_ADMIN_PERMISSIONS, STAFF_ROLES, permissions_for_role
from app.modules.admin.models import AdminAuditLog, StaffPermissionOverride
from app.modules.auth.models import AuthSession
from app.shared.exceptions import InsufficientPermissionsError, ResourceConflictError, ResourceNotFoundError

_REDACTED = "[REDACTED]"
_SENSITIVE_FRAGMENTS = (
    "password",
    "token",
    "secret",
    "signature",
    "authorization",
    "auth_key",
    "hmac",
    "cvv",
    "cvc",
    "card_number",
    "pan",
)


def _safe_value(value: Any, *, depth: int = 0) -> Any:
    """Return a bounded JSON-safe audit summary without credentials/payment secrets."""
    if depth > 4:
        return "[TRUNCATED]"
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if hasattr(value, "model_dump"):
        return _safe_value(value.model_dump(mode="json"), depth=depth + 1)
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for raw_key, raw_value in list(value.items())[:80]:
            key = str(raw_key)
            lowered = key.lower()
            sanitized[key] = (
                _REDACTED
                if any(fragment in lowered for fragment in _SENSITIVE_FRAGMENTS)
                else _safe_value(raw_value, depth=depth + 1)
            )
        return sanitized
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_safe_value(item, depth=depth + 1) for item in list(value)[:80]]
    text = str(value)
    return text if len(text) <= 1000 else f"{text[:997]}..."


class AdminAccessService:
    """Database-backed permission resolution; the token role is never authoritative."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def resolve_permissions(self, partner_id: int) -> tuple[str | None, frozenset[str]]:
        partner = await self.db.scalar(select(Partner).where(Partner.id == partner_id))
        if partner is None or not partner.is_active or partner.role not in STAFF_ROLES:
            return None, frozenset()

        # System admins deliberately cannot be permission-overridden. This keeps
        # one deterministic recovery role and prevents accidental control-plane lockout.
        if partner.role == "system_admin":
            return partner.role, ALL_ADMIN_PERMISSIONS

        permissions = set(permissions_for_role(partner.role))
        overrides = (
            await self.db.scalars(
                select(StaffPermissionOverride).where(
                    StaffPermissionOverride.partner_id == partner.id
                )
            )
        ).all()
        for override in overrides:
            if override.permission not in ALL_ADMIN_PERMISSIONS:
                continue
            if override.effect == "allow":
                permissions.add(override.permission)
            else:
                permissions.discard(override.permission)
        return partner.role, frozenset(permissions)

    async def require(self, partner_id: int, permission: str) -> tuple[str, frozenset[str]]:
        role, permissions = await self.resolve_permissions(partner_id)
        if role is None or permission not in permissions:
            raise InsufficientPermissionsError()
        return role, permissions

    async def permission_catalog(self) -> list[dict[str, str]]:
        return [
            {
                "key": key,
                "area": key.split(".", 1)[0],
                "action": key.split(".", 1)[1],
            }
            for key in sorted(ALL_ADMIN_PERMISSIONS)
        ]

    async def list_staff(self) -> list[dict[str, Any]]:
        partners = list(
            (
                await self.db.scalars(
                    select(Partner)
                    .where(Partner.role.in_(sorted(STAFF_ROLES)))
                    .order_by(Partner.is_active.desc(), Partner.name, Partner.id)
                )
            ).all()
        )
        if not partners:
            return []
        partner_ids = [partner.id for partner in partners]
        override_rows = (
            await self.db.scalars(
                select(StaffPermissionOverride)
                .where(StaffPermissionOverride.partner_id.in_(partner_ids))
                .order_by(StaffPermissionOverride.partner_id, StaffPermissionOverride.permission)
            )
        ).all()
        by_partner: dict[int, list[dict[str, str]]] = {partner_id: [] for partner_id in partner_ids}
        for row in override_rows:
            by_partner[row.partner_id].append(
                {"permission": row.permission, "effect": row.effect}
            )

        items: list[dict[str, Any]] = []
        for partner in partners:
            _, effective = await self.resolve_permissions(partner.id)
            items.append(
                {
                    "id": partner.id,
                    "name": partner.name,
                    "email": partner.email,
                    "role": partner.role,
                    "is_active": partner.is_active,
                    "permissions": sorted(effective),
                    "overrides": by_partner[partner.id],
                }
            )
        return items

    async def replace_staff_access(
        self,
        *,
        target_partner_id: int,
        role: str,
        overrides: list[dict[str, str]],
        actor: dict[str, Any],
        request: Request | None = None,
    ) -> dict[str, Any]:
        if role not in STAFF_ROLES:
            raise ResourceConflictError("The selected staff role is not supported.")

        target = await self.db.scalar(
            select(Partner).where(Partner.id == target_partner_id).with_for_update()
        )
        if target is None:
            raise ResourceNotFoundError("Partner", target_partner_id)

        previous_rows = (
            await self.db.scalars(
                select(StaffPermissionOverride).where(
                    StaffPermissionOverride.partner_id == target_partner_id
                )
            )
        ).all()
        before = {
            "role": target.role,
            "is_active": target.is_active,
            "overrides": [
                {"permission": row.permission, "effect": row.effect}
                for row in previous_rows
            ],
        }

        if target.role == "system_admin" and role != "system_admin":
            other_admins = await self.db.scalar(
                select(func.count(Partner.id)).where(
                    Partner.role == "system_admin",
                    Partner.is_active.is_(True),
                    Partner.id != target.id,
                )
            )
            if int(other_admins or 0) < 1:
                raise ResourceConflictError("At least one active system administrator must remain.")

        normalized: dict[str, str] = {}
        for item in overrides:
            permission = item["permission"]
            effect = item["effect"]
            if permission not in ALL_ADMIN_PERMISSIONS:
                raise ResourceConflictError(f"Unknown admin permission: {permission}")
            if effect not in {"allow", "deny"}:
                raise ResourceConflictError("Permission override effect must be allow or deny.")
            normalized[permission] = effect

        target.role = role
        await self.db.execute(
            delete(StaffPermissionOverride).where(
                StaffPermissionOverride.partner_id == target_partner_id
            )
        )
        actor_id = int(actor["user_id"])
        for permission, effect in sorted(normalized.items()):
            self.db.add(
                StaffPermissionOverride(
                    partner_id=target_partner_id,
                    permission=permission,
                    effect=effect,
                    created_by=actor_id,
                )
            )

        # Any access policy change invalidates all device sessions for the target.
        # A new login gets fresh display metadata while server-side permission checks
        # already use the current persisted role on every privileged request.
        now = datetime.now(UTC)
        await self.db.execute(
            update(AuthSession)
            .where(AuthSession.partner_id == target_partner_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await self.db.flush()
        resolved_role, effective = await self.resolve_permissions(target_partner_id)
        after = {
            "role": resolved_role,
            "is_active": target.is_active,
            "overrides": [
                {"permission": permission, "effect": effect}
                for permission, effect in sorted(normalized.items())
            ],
            "permissions": sorted(effective),
        }
        await self.record_audit(
            actor=actor,
            action="staff.access.update",
            entity_type="staff",
            entity_id=str(target_partner_id),
            before=before,
            after=after,
            request=request,
        )
        return {
            "id": target.id,
            "name": target.name,
            "email": target.email,
            "role": resolved_role,
            "is_active": target.is_active,
            "permissions": sorted(effective),
            "overrides": after["overrides"],
        }

    async def list_audit_logs(
        self,
        *,
        page: int,
        limit: int,
        action: str | None = None,
        entity_type: str | None = None,
        actor_partner_id: int | None = None,
    ) -> tuple[list[AdminAuditLog], int]:
        filters = []
        if action:
            filters.append(AdminAuditLog.action == action)
        if entity_type:
            filters.append(AdminAuditLog.entity_type == entity_type)
        if actor_partner_id:
            filters.append(AdminAuditLog.actor_partner_id == actor_partner_id)
        total = int(
            await self.db.scalar(
                select(func.count(AdminAuditLog.id)).where(*filters)
            )
            or 0
        )
        rows = list(
            (
                await self.db.scalars(
                    select(AdminAuditLog)
                    .where(*filters)
                    .order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
                    .offset((page - 1) * limit)
                    .limit(limit)
                )
            ).all()
        )
        return rows, total

    async def record_audit(
        self,
        *,
        actor: dict[str, Any],
        action: str,
        entity_type: str,
        entity_id: str | int | None = None,
        before: Any = None,
        after: Any = None,
        request: Request | None = None,
    ) -> AdminAuditLog:
        actor_id = int(actor["user_id"]) if actor.get("user_id") is not None else None
        persisted_role: str | None = None
        if actor_id is not None:
            persisted_role = await self.db.scalar(
                select(Partner.role).where(Partner.id == actor_id)
            )
        log = AdminAuditLog(
            actor_partner_id=actor_id,
            actor_role=persisted_role or actor.get("role"),
            action=action[:96],
            entity_type=entity_type[:64],
            entity_id=str(entity_id)[:128] if entity_id is not None else None,
            before_summary=_safe_value(before),
            after_summary=_safe_value(after),
            ip_address=(request.client.host[:64] if request and request.client else None),
            session_id=(str(actor.get("session_id"))[:64] if actor.get("session_id") else None),
            request_method=(request.method[:12] if request else None),
            request_path=(request.url.path[:512] if request else None),
        )
        self.db.add(log)
        await self.db.flush()
        return log
