"""Authentication-specific API errors."""

from fastapi import status

from app.shared.exceptions import ElitedomException


class InvalidOtpError(ElitedomException):
    def __init__(self, detail: str = "The verification code is invalid or expired."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="ELITE_1005",
            detail=detail,
        )


class OtpRateLimitError(ElitedomException):
    def __init__(self, retry_after: int):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="ELITE_1006",
            detail="Please wait before requesting another verification code.",
            headers={"Retry-After": str(max(1, retry_after))},
        )


class OtpDeliveryUnavailableError(ElitedomException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="ELITE_1007",
            detail="Phone verification is not configured for this environment.",
        )


class MfaRequiredError(ElitedomException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="ELITE_1008",
            detail="Multi-factor authentication is required for staff access.",
        )


class InvalidMfaError(ElitedomException):
    def __init__(self, detail: str = "The multi-factor authentication code is invalid."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="ELITE_1009",
            detail=detail,
        )
