"""Regression coverage for order/cart mutations that are followed by immediate reads."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.orders import router as orders_router


@pytest.mark.asyncio
async def test_commit_order_transition_commits_the_request_session() -> None:
    db = SimpleNamespace(commit=AsyncMock())

    await orders_router._commit_order_transition(db)

    db.commit.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_add_to_cart_commits_before_returning(monkeypatch: pytest.MonkeyPatch) -> None:
    events: list[str] = []
    response = {"id": 42, "item_count": 1}

    class FakeOrderService:
        def __init__(self, db: object) -> None:
            self.db = db

        async def add_to_cart(
            self,
            request: object,
            *,
            partner_id: int | None,
            session_id: str | None,
        ) -> dict[str, int]:
            assert partner_id == 7
            assert session_id is None
            events.append("mutated")
            return response

    async def fake_commit(db: object) -> None:
        events.append("committed")

    monkeypatch.setattr(orders_router, "OrderService", FakeOrderService)
    monkeypatch.setattr(orders_router, "_commit_order_transition", fake_commit)

    result = await orders_router.add_to_cart(
        request=SimpleNamespace(product_id=12, quantity=1),
        session_id=None,
        db=object(),
        current_user={"user_id": 7},
    )

    assert result is response
    assert events == ["mutated", "committed"]
