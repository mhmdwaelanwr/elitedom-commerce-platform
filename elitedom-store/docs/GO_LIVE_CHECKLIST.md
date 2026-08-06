# Elitedom Store — Go-Live Readiness Checklist

This checklist separates what is implemented in the repository from the operational work required before accepting real customer money.

## Implemented in the platform

- Odoo 17 addon with signed, idempotent outbox delivery and retry/dead-letter handling.
- Odoo product, inventory, and order-status webhooks into FastAPI.
- PostgreSQL-backed catalogue, orders, customers, warranty, suppliers, and reporting.
- Staff catalogue CRUD, product image upload, gallery management, publish/archive controls, and reasoned stock adjustment.
- Persistent Docker media volume and a live API-driven storefront without silent production demo fallback.
- Stripe webhook reconciliation boundary, background workers, CI, real PostgreSQL migration replay, Odoo addon installation tests, and production Compose separation.

## Blocking work before public launch

### Commercial and legal

- Register the selling entity, tax profile, invoicing process, and any Egyptian e-invoicing obligations with qualified accounting/legal advisers.
- Publish reviewed Terms of Sale, Privacy Policy, Cookie Policy, shipping policy, warranty terms, and refund/return policy.
- Define chargeback, fraud review, damaged-delivery, cancellation, and RMA operating procedures.

### Payments and finance

- Complete Stripe or chosen payment-provider KYC and switch from test credentials only after a controlled live-payment rehearsal.
- Configure production webhook endpoints, reconciliation reports, settlement accounts, refund permissions, and finance-owner alerts.
- Verify VAT and invoice calculations against the actual product/tax model.

### Fulfilment and suppliers

- Load the real SKU catalogue, supplier contracts, landed costs, lead times, verified stock, warranty terms, and approved product media.
- Sign courier contracts and implement or document booking, label, tracking, failed-delivery, and cash-on-delivery reconciliation flows.
- Run warehouse receiving, picking, packing, serial capture, stock-count, and returns drills in Odoo.

### Production infrastructure

- Provision a production domain, TLS, DNS, reverse-proxy routes, firewall rules, and protected admin access.
- Replace the single-host media volume with S3/R2-compatible object storage and CDN before horizontal scaling.
- Configure encrypted off-site PostgreSQL/Odoo/media backups and complete a restore drill.
- Add paging alerts for API errors, queue backlog, Odoo dead letters, payment webhook failures, disk capacity, backup age, and certificate expiry.
- Store secrets in a managed secret store and rotate all template/development credentials.

### Quality, security, and performance

- Complete staging UAT for browse → cart → checkout → payment → Odoo order → shipment → delivery → return/refund.
- Run load tests with the expected launch catalogue and traffic profile.
- Perform dependency, container, OWASP, permission, rate-limit, and penetration reviews.
- Verify accessibility, responsive behavior, Arabic/RTL requirements, and representative devices/browsers.

### Growth and discoverability

- Add production SEO metadata, sitemap, robots rules, canonical URLs, product structured data, social cards, and analytics consent.
- Configure transactional email/SMS sender verification, templates, bounce handling, and support mailbox ownership.
- Define launch dashboards for conversion, payment failures, stock-outs, fulfilment time, returns, and customer support.

## Release decision

The repository is suitable for a controlled staging pilot after the catalogue/Odoo package is deployed. It is not production-ready until every launch blocker above has an accountable owner, evidence, and rollback procedure.
