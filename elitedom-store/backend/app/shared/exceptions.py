"""
Elitedom Store — Custom Exceptions
Standardized error hierarchy per ERROR_CODES.md.
"""

from fastapi import HTTPException, status

# ── Base Exceptions ──────────────────────────────────────────────────────────


class ElitedomException(HTTPException):
    """Base exception for all Elitedom application errors."""

    def __init__(
        self,
        status_code: int,
        error_code: str,
        detail: str,
        headers: dict | None = None,
    ):
        super().__init__(
            status_code=status_code,
            detail={"error_code": error_code, "message": detail},
            headers=headers,
        )


# ── Authentication Errors (ELITE_1xxx) ───────────────────────────────────────


class InvalidCredentialsError(ElitedomException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="ELITE_1001",
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )


class TokenExpiredError(ElitedomException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="ELITE_1002",
            detail="Access token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )


class InsufficientPermissionsError(ElitedomException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="ELITE_1003",
            detail="You do not have permission to perform this action.",
        )


class AccountAlreadyExistsError(ElitedomException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="ELITE_1004",
            detail="An account with this email already exists.",
        )


# ── Resource Errors (ELITE_2xxx) ─────────────────────────────────────────────


class ResourceNotFoundError(ElitedomException):
    def __init__(self, resource: str, identifier: str | int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="ELITE_2001",
            detail=f"{resource} with identifier '{identifier}' not found.",
        )


class ResourceConflictError(ElitedomException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="ELITE_2002",
            detail=detail,
        )


# ── Order Errors (ELITE_3xxx) ────────────────────────────────────────────────


class InvalidOrderStateTransition(ElitedomException):
    def __init__(self, current: str, target: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="ELITE_3001",
            detail=f"Cannot transition order from '{current}' to '{target}'.",
        )


class InsufficientStockError(ElitedomException):
    def __init__(self, sku: str, requested: int, available: int):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="ELITE_3002",
            detail=(
                f"Insufficient stock for SKU '{sku}': "
                f"requested {requested}, available {available}."
            ),
        )


# ── Payment Errors (ELITE_4xxx) per STRIPE.md ────────────────────────────────


class PaymentGatewayUnavailableError(ElitedomException):
    """The selected payment method is not safely configured for use."""

    def __init__(self, detail: str = "Credit-card checkout is currently unavailable."):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="ELITE_4001",
            detail=detail,
        )


class PaymentDeclinedError(ElitedomException):
    def __init__(self, detail: str = "Payment was declined by the gateway."):
        super().__init__(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            error_code="ELITE_4003",
            detail=detail,
        )


class DuplicateIdempotencyKeyError(ElitedomException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="ELITE_4004",
            detail="Duplicate idempotency key — transaction already processed.",
        )


# ── Webhook Errors (ELITE_7xxx) ──────────────────────────────────────────────


class WebhookSignatureMissingError(ElitedomException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="ELITE_7001",
            detail="Webhook signature header is missing or invalid.",
        )


class WebhookSignatureInvalidError(ElitedomException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="ELITE_7002",
            detail="Webhook signature verification failed.",
        )


class WebhookNotConfiguredError(ElitedomException):
    """A signed integration endpoint is disabled until its secret is provisioned."""

    def __init__(self, provider: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="ELITE_7003",
            detail=f"{provider} webhook processing is not configured.",
        )


# ── Integration Errors (ELITE_8xxx) ──────────────────────────────────────────


class OdooSyncError(ElitedomException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            error_code="ELITE_8001",
            detail=f"Odoo ERP synchronization failed: {detail}",
        )


class ExternalServiceError(ElitedomException):
    def __init__(self, service: str, detail: str):
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            error_code="ELITE_8002",
            detail=f"External service '{service}' error: {detail}",
        )
