# Stage 7 — Admin Dashboard, RBAC, and Audit

## Scope

Stage 7 turns the existing staff console into a server-authoritative control plane. The storefront authentication model and existing persisted staff role strings are preserved for compatibility, while privileged authorization moves from coarse JWT role checks to current database-backed permissions.

The stage deliberately does not introduce new secrets or a second authentication system. Admin MFA remains a production-hardening item for Stage 9; Stage 7 establishes the permission and audit boundaries that MFA will protect.

## Authorization model

The authenticated JWT and tracked device session establish the caller's identity. They no longer determine whether a privileged administrative action is allowed.

For every permission-protected request the backend:

1. validates the access token and tracked session through the existing authentication boundary;
2. loads the current `res_partner` record by authenticated user ID;
3. rejects inactive/non-staff accounts;
4. applies the current default permission set for the persisted staff role;
5. applies explicit per-user `allow` / `deny` overrides from `elitedom_staff_permission_override`;
6. authorizes the requested capability only when the effective permission is present.

This means a stale token cannot retain administrative authority after the persisted role changes. Access-policy updates also revoke the target employee's active device sessions so the UI/login metadata is refreshed on the next login.

## Roles

Stage 7 retains the existing roles and adds only the profiles required by the current operations surface:

- `system_admin` — recovery/super-admin role with all control-plane permissions;
- `operations_manager` — orders, customers, support, fulfilment and operational visibility;
- `finance_officer` — payment/revenue/RFQ/reporting responsibilities;
- `inventory_manager` — catalogue, inventory, suppliers and relevant reporting;
- `warehouse_operator` — order handling, stock visibility and shipment execution;
- `customer_support` — customer/order/RMA/shipment visibility and support actions;
- `content_catalog` — catalogue content management without stock/finance authority.

Customer and B2B customer roles remain non-staff identities.

The final active `system_admin` cannot be demoted through the control plane. System-admin permissions also cannot be overridden, preserving a deterministic recovery role and preventing accidental administrative lockout.

## Permission catalogue

Permissions are explicit capabilities rather than UI sections. Current Stage 7 capabilities include:

- dashboard view;
- order view/manage;
- catalogue view/manage/archive;
- inventory view/adjust;
- customer view;
- support view/manage;
- RFQ view/quote;
- shipment view/dispatch;
- supplier view/manage;
- payment view/refund;
- reporting view;
- staff view/manage;
- audit view;
- integration view/manage;
- configuration view/manage.

The permission catalogue intentionally contains payment/refund, integration and configuration capabilities before every corresponding admin screen is promoted into this stage. This lets later control-plane screens use the same stable backend access vocabulary rather than adding another authorization mechanism.

## Alternate API paths

Stage 7 does not protect only `/api/v1/admin/*`. Privileged compatibility and operational endpoints in orders, inventory, products, shipping, suppliers, reporting, warranty/RMA and B2B RFQs are moved to the same current-state permission checks where they can perform or expose staff-level actions.

Customer ownership behavior is preserved. For example, customers can still see and cancel their own eligible orders, while cross-customer operations require the appropriate current staff permission.

## Audit trail

`elitedom_admin_audit_log` is server-written in the same request transaction as the privileged business change. Records include:

- persisted actor ID and role;
- action;
- entity type and identifier;
- bounded before/after summaries where useful;
- timestamp;
- authenticated session ID when present;
- request method/path;
- direct request peer IP.

Audit serialization redacts credential/payment-sensitive key names including passwords, tokens, secrets, signatures, authorization values, HMAC material, CVV/CVC, PAN/card-number fields and related values. Large/deep summaries are bounded rather than storing arbitrary request bodies.

Stage 7 audits staff-access changes and important control-plane mutations including order state/cancellation, stock adjustments, catalogue mutations, shipment transitions, supplier/procurement changes, RMA reviews and staff-issued B2B actions.

## Staff access console

The frontend admin shell resolves `/api/v1/admin/access/me` and renders navigation from the effective server permissions rather than a JavaScript role table.

The Staff Access screen provides:

- current staff accounts;
- role selection;
- effective permission visibility;
- explicit default/allow/deny override selection;
- confirmation before saving;
- automatic session revocation after an access-policy change.

Legacy page-level role hints remain presentation-only for backward-compatible rendering; they are not an authorization boundary. Every protected API request is server-enforced.

## Audit console

The Audit Log screen supports paginated review with action/entity filters and shows actor, request context, entity, timestamp and redacted before/after summaries. It does not expose passwords, authentication tokens, card credentials or provider secrets.

## Database migration

Alembic revision `0011_admin_rbac_audit` follows `0010_fulfillment_lifecycle` and creates:

- `elitedom_staff_permission_override`;
- `elitedom_admin_audit_log`;
- supporting uniqueness constraints and query indexes.

The migration has a complete reverse path so the existing CI migration checks can continue validating fresh upgrade, latest downgrade/replay and full downgrade/replay.

## Deferred production hardening

Stage 7 does not fabricate provider integrations or credentials. The following remain launch-hardening work, primarily for Stage 9/10:

- mandatory MFA for privileged admin accounts;
- Redis/distributed authentication and OTP rate limiting;
- production observability/alert routing and retention policy;
- production Google/Apple/Twilio credentials;
- Paymob merchant sandbox/live acceptance and production secrets;
- deployment/backups/disaster-recovery validation;
- final UAT and go-live acceptance.
