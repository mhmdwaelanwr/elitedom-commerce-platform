"""Elitedom Store FastAPI application entry point."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.health import readiness_snapshot
from app.integrations.odoo.catalog_webhooks import router as odoo_catalog_webhook_router
from app.integrations.odoo.webhooks import router as odoo_webhook_router
from app.integrations.paymob.webhooks import router as paymob_webhook_router
from app.integrations.stripe.webhooks import router as stripe_webhook_router
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.security_headers import MetricsAuthMiddleware, SecurityHeadersMiddleware
from app.modules.admin.control_router import router as admin_control_router
from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.b2b.router import router as b2b_router
from app.modules.customers.router import router as customers_router
from app.modules.inventory.router import router as inventory_router
from app.modules.loyalty.router import router as loyalty_router
from app.modules.orders.router import router as orders_router
from app.modules.payments.router import router as payments_router
from app.modules.products.catalog_admin_router import router as catalog_admin_router
from app.modules.products.catalog_router import router as catalog_router
from app.modules.products.router import router as products_router
from app.modules.reporting.router import router as reporting_router
from app.modules.shipping.router import router as shipping_router
from app.modules.suppliers.router import router as suppliers_router
from app.modules.warranty.router import router as warranty_router
from app.observability import RequestContextMiddleware, configure_observability
from app.shared.outbox_tasks import register_default_outbox_routes

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    register_default_outbox_routes()
    Path(settings.media_root).mkdir(parents=True, exist_ok=True)
    yield


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Elitedom Store enterprise e-commerce API for Egyptian technology retail, "
            "powered by FastAPI, Odoo 17, and PostgreSQL 15."
        ),
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    if settings.environment != "development":
        application.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=[host.strip() for host in settings.allowed_hosts.split(",") if host.strip()],
        )
    application.add_middleware(RateLimitMiddleware)
    application.add_middleware(MetricsAuthMiddleware)
    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(RequestContextMiddleware)

    api_prefix = "/api/v1"
    application.include_router(auth_router, prefix=f"{api_prefix}/auth", tags=["Authentication"])
    application.include_router(products_router, prefix=f"{api_prefix}/products", tags=["Products"])
    application.include_router(catalog_router, prefix=f"{api_prefix}/catalog", tags=["Catalogue"])
    application.include_router(orders_router, prefix=f"{api_prefix}/orders", tags=["Orders"])
    application.include_router(customers_router, prefix=f"{api_prefix}/customers", tags=["Customers"])
    application.include_router(inventory_router, prefix=f"{api_prefix}/inventory", tags=["Inventory"])
    application.include_router(payments_router, prefix=f"{api_prefix}/payments", tags=["Payments"])
    application.include_router(shipping_router, prefix=f"{api_prefix}/shipping", tags=["Shipping"])
    application.include_router(warranty_router, prefix=f"{api_prefix}/warranty", tags=["Warranty & RMA"])
    application.include_router(suppliers_router, prefix=f"{api_prefix}/suppliers", tags=["Suppliers"])
    application.include_router(loyalty_router, prefix=f"{api_prefix}/loyalty", tags=["Loyalty"])
    application.include_router(b2b_router, prefix=f"{api_prefix}/b2b", tags=["B2B Portal"])
    application.include_router(reporting_router, prefix=f"{api_prefix}/reports", tags=["Reporting"])
    application.include_router(admin_router, prefix=f"{api_prefix}/admin", tags=["Staff Administration"])
    application.include_router(
        admin_control_router,
        prefix=f"{api_prefix}/admin",
        tags=["Staff Control Plane"],
    )
    application.include_router(
        catalog_admin_router,
        prefix=f"{api_prefix}/admin/catalog",
        tags=["Catalogue Administration"],
    )
    application.include_router(
        stripe_webhook_router,
        prefix=f"{api_prefix}/webhooks/payment",
        tags=["Webhooks — Stripe"],
    )
    application.include_router(
        paymob_webhook_router,
        prefix=f"{api_prefix}/webhooks/paymob",
        tags=["Webhooks — Paymob"],
    )
    application.include_router(
        odoo_webhook_router,
        prefix=f"{api_prefix}/webhooks/odoo",
        tags=["Webhooks — Odoo"],
    )
    application.include_router(
        odoo_catalog_webhook_router,
        prefix=f"{api_prefix}/webhooks/odoo",
        tags=["Webhooks — Odoo catalogue"],
    )

    Path(settings.media_root).mkdir(parents=True, exist_ok=True)
    application.mount(
        settings.media_public_path,
        StaticFiles(directory=settings.media_root, check_dir=False),
        name="product-media",
    )

    @application.get("/health", tags=["Health"])
    @application.get("/health/live", tags=["Health"])
    async def liveness_check():
        return {
            "status": "healthy",
            "service": settings.app_name,
            "version": settings.app_version,
        }

    @application.get("/health/ready", tags=["Health"])
    async def readiness_check():
        snapshot = await readiness_snapshot()
        if not snapshot["ready"]:
            return JSONResponse(status_code=503, content=snapshot)
        return snapshot

    configure_observability(application, settings)
    return application


app = create_app()
