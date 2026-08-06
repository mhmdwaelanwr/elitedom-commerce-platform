"""
Unit tests for authentication request schemas and validators.
"""

import pytest
from pydantic import ValidationError

from app.modules.auth.schemas import RegisterRequest


def test_valid_register_request():
    req = RegisterRequest(
        name="Mesh Wael",
        email="mesh@elitedom.store",
        mobile="+201012345678",
        password="Password123!",
    )
    assert req.name == "Mesh Wael"
    assert req.email == "mesh@elitedom.store"
    assert req.mobile == "+201012345678"


def test_invalid_egyptian_mobile():
    with pytest.raises(ValidationError) as exc_info:
        RegisterRequest(
            name="Mesh Wael",
            email="mesh@elitedom.store",
            mobile="+14155552671",  # US phone number should fail
            password="Password123!",
        )
    assert "Invalid Egyptian mobile number" in str(exc_info.value)


def test_weak_password_no_special_char():
    with pytest.raises(ValidationError) as exc_info:
        RegisterRequest(
            name="Mesh Wael",
            email="mesh@elitedom.store",
            mobile="01012345678",
            password="Password123",  # No special char
        )
    assert "Password must contain at least one special character" in str(exc_info.value)


def test_weak_password_no_digit():
    with pytest.raises(ValidationError) as exc_info:
        RegisterRequest(
            name="Mesh Wael",
            email="mesh@elitedom.store",
            mobile="01012345678",
            password="PasswordABC!",  # No digit
        )
    assert "Password must contain at least one digit" in str(exc_info.value)
