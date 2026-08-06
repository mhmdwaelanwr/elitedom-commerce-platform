"""Interactively provision one non-default system administrator for local development.

This command intentionally has no hard-coded credentials and refuses to run in
staging/production. It is meant for the first local console login after running
migrations, never for deployment automation.
"""

from __future__ import annotations

import argparse
import asyncio
from getpass import getpass

from sqlalchemy import func, select

from app.config import get_settings
from app.database import async_session_factory, engine
from app.models import Partner
from app.modules.auth.schemas import RegisterRequest
from app.shared.security import hash_password


def _prompt(value: str | None, label: str) -> str:
    """Prompt only when the corresponding optional CLI field was omitted."""
    return value.strip() if value else input(f"{label}: ").strip()


async def bootstrap_admin(args: argparse.Namespace) -> None:
    settings = get_settings()
    if settings.environment != "development":
        raise RuntimeError("Admin bootstrap is available only in development.")

    name = _prompt(args.name, "Full name")
    email = _prompt(args.email, "Email address").lower()
    mobile = _prompt(args.mobile, "Egyptian mobile number")
    password = getpass("New password (not echoed): ")
    confirmation = getpass("Confirm new password: ")
    if password != confirmation:
        raise RuntimeError("Passwords did not match; no account was changed.")

    # Reuse the public validation policy so local staff passwords do not bypass
    # the strength and Egyptian-mobile checks enforced for all accounts.
    validated = RegisterRequest(
        name=name,
        email=email,
        mobile=mobile,
        password=password,
    )

    async with async_session_factory() as session:
        existing = await session.scalar(
            select(Partner).where(func.lower(Partner.email) == str(validated.email).lower())
        )
        if existing is not None:
            if existing.role == "system_admin" and not args.promote_existing:
                print(
                    f"Development system administrator already exists for {existing.email}; no change made."
                )
                return
            if not args.promote_existing:
                raise RuntimeError(
                    "An account already exists for this email. Re-run with "
                    "--promote-existing only after confirming that this local account "
                    "may be promoted."
                )
            existing.name = validated.name
            existing.phone = validated.mobile
            existing.password_hash = hash_password(validated.password)
            existing.role = "system_admin"
            existing.is_active = True
            existing.email_verified = True
            action = "promoted"
        else:
            existing = Partner(
                name=validated.name,
                email=str(validated.email).lower(),
                phone=validated.mobile,
                password_hash=hash_password(validated.password),
                company_type="person",
                role="system_admin",
                is_active=True,
                email_verified=True,
            )
            session.add(existing)
            action = "created"

        await session.commit()
        print(f"Development system administrator {action} for {existing.email} (id={existing.id}).")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Interactively provision a development-only Elitedom system administrator."
    )
    parser.add_argument("--name", help="Full name; prompted when omitted.")
    parser.add_argument("--email", help="Email address; prompted when omitted.")
    parser.add_argument("--mobile", help="Egyptian mobile number; prompted when omitted.")
    parser.add_argument(
        "--promote-existing",
        action="store_true",
        help="Explicitly promote an existing local account after confirming ownership.",
    )
    return parser.parse_args()


async def main() -> None:
    try:
        await bootstrap_admin(parse_args())
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
