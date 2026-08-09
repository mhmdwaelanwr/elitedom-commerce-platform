"""Authentication helpers for integration tests that need tracked access sessions."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import async_object_session

from app.models import Partner
from app.modules.auth.models import AuthSession
from app.shared.security import create_access_token


def authorization(
    partner: Partner,
    *,
    token_role: str | None = None,
) -> dict[str, str]:
    """Issue a test access token backed by a real, active AuthSession row."""
    db_session = async_object_session(partner)
    if db_session is None:
        raise AssertionError("Partner must be attached to an AsyncSession before issuing a token.")

    now = datetime.now(UTC)
    session_id = str(uuid4())
    db_session.add(
        AuthSession(
            id=session_id,
            partner_id=partner.id,
            refresh_token_hash="0" * 64,
            auth_method="test",
            last_used_at=now,
            expires_at=now + timedelta(hours=1),
        )
    )
    token = create_access_token(
        {
            "sub": str(partner.id),
            "email": partner.email,
            "role": token_role or partner.role,
            "sid": session_id,
        }
    )
    return {"Authorization": f"Bearer {token}"}
