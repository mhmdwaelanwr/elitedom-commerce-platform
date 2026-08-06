"""
Elitedom Store — FastAPI Application Entry Point
Enterprise-grade e-commerce platform API.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.config import get_settings
from app.integrations.odoo.webhooks import router as odoo_webhook_router

# Import webhook routers
from app.integrations.stripe.webhooks import router as stripe_webhook_router
from app.middleware.rate_limit import RateLimitMiddleware
from app.modules.admin.router import router as admin_router

# Import routers
from app.modules.auth.router import router as auth_router
from app.modules.b2b.router import router as b2b_router
from app.modules.customers.router import router as customers_router
from app.modules.inventory.router import router as inventory_router
from app.modules.loyalty.router import router as loyalty_router
from app.modules.orders.router import router as orders_router
from app.modules.payments.router import router as payments_router
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
    """Application startup and shutdown lifecycle."""
    # Startup
    register_default_outbox_routes()
    print(f"🚀 Starting {settings.app_name} v{settings.app_version}")
    print(f"📦 Environment: {settings.environment}")
    print(
        f"🗄️  Database: {settings.postgres_host}:{settings.postgres_port}/"
        f"{settings.app_postgres_db}"
    )
    yield
    # Shutdown
    print(f"👋 Shutting down {settings.app_name}")


def create_app() -> FastAPI:
    """Application factory — creates and configures the FastAPI instance."""
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Elitedom Store — Enterprise-grade e-commerce API for Egyptian "
            "technology retail. Powered by FastAPI, Odoo 17, and PostgreSQL 15."
        ),
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────────────────
    # CORS — restrict origins in production
    application.add_middleware(
        CORSMiddleware,
        # Use an explicit deployment allow-list in every environment.  The
        # Settings validator rejects '*' outside development, so changing the
        # public storefront domain does not silently leave browser auth broken.
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Trusted host validation
    if settings.environment != "development":
        application.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.allowed_hosts.split(","),
        )

    # Rate limiting
    application.add_middleware(RateLimitMiddleware)

    # Correlation IDs wrap every response, including rejected requests.  The
    # observability setup below supplies structured logs, metrics, and optional
    # OpenTelemetry export without recording request payloads or PII.
    application.add_middleware(RequestContextMiddleware)

    # ── API Routers ──────────────────────────────────────────────────
    api_prefix = "/api/v1"

    application.include_router(auth_router, prefix=f"{api_prefix}/auth", tags=["Authentication"])
    application.include_router(products_router, prefix=f"{api_prefix}/products", tags=["Products"])
    application.include_router(orders_router, prefix=f"{api_prefix}/orders", tags=["Orders"])
    application.include_router(
        customers_router, prefix=f"{api_prefix}/customers", tags=["Customers"]
    )
    application.include_router(
        inventory_router, prefix=f"{api_prefix}/inventory", tags=["Inventory"]
    )
    application.include_router(payments_router, prefix=f"{api_prefix}/payments", tags=["Payments"])
    application.include_router(shipping_router, prefix=f"{api_prefix}/shipping", tags=["Shipping"])
    application.include_router(
        warranty_router, prefix=f"{api_prefix}/warranty", tags=["Warranty & RMA"]
    )
    application.include_router(
        suppliers_router, prefix=f"{api_prefix}/suppliers", tags=["Suppliers"]
    )
    application.include_router(loyalty_router, prefix=f"{api_prefix}/loyalty", tags=["Loyalty"])
    application.include_router(b2b_router, prefix=f"{api_prefix}/b2b", tags=["B2B Portal"])
    application.include_router(reporting_router, prefix=f"{api_prefix}/reports", tags=["Reporting"])
    application.include_router(
        admin_router, prefix=f"{api_prefix}/admin", tags=["Staff Administration"]
    )

    # ── Webhook Routers ──────────────────────────────────────────────
    application.include_router(
        stripe_webhook_router,
        prefix=f"{api_prefix}/webhooks/payment",
        tags=["Webhooks — Stripe"],
    )
    application.include_router(
        odoo_webhook_router,
        prefix=f"{api_prefix}/webhooks/odoo",
        tags=["Webhooks — Odoo"],
    )

    # ── Health Check ─────────────────────────────────────────────────
    @application.get("/health", tags=["Health"])
    async def health_check():
        return {
            "status": "healthy",
            "service": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment,
        }

    configure_observability(application, settings)
    return application


app = create_app()
