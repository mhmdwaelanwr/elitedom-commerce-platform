---
title: "Integration Catalogue"
status: current
owner: architecture
document_type: documentation-index
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Provider implementation or enablement status changes."
---
# Integration Catalogue

| Integration | Status | Role |
| --- | --- | --- |
| Odoo 17 | Current / implemented | ERP catalogue, inventory, order, shipment synchronization |
| Paymob | Current / primary | Payment initiation, callbacks, refunds/reconciliation |
| Stripe | Superseded / legacy | Historical payment compatibility path |
| Algolia | Current / optional | Derived search indexing |
| Twilio | Current / optional | SMS delivery adapter |
| SendGrid | Current / optional | Email delivery adapter |
| ZeptoMail | Current / optional | Email delivery adapter |
| Hedera | Planned / fail-closed | Scaffold only; enablement is intentionally rejected |
| Zoho | Planned | Configuration surface; no current trusted runtime adapter established |
| Typeform | Planned | Future intake adapter for warranty/RMA |

A provider is not considered live because code exists. Production status requires environment credentials, external account configuration, provider acceptance and release-scoped evidence.
