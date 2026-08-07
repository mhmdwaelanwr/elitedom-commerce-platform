# Data Classification Policy (DATA_CLASSIFICATION.md)

Document Classification: Internal / Security & Compliance  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP  

---

## 1. Overview
Data classification dictates how information is handled, stored, transmitted, and destroyed based on its sensitivity level within the Elitedom Store ecosystem.

## 2. Classification Tiers
* Level 1: Public
  - Definition: Information intended for public consumption.
  - Examples: Marketing materials, public product catalog descriptions, public API documentation.
* Level 2: Internal
  - Definition: Operational data meant exclusively for internal use by Elitedom employees and engineers.
  - Examples: Architectural documents, internal staging URLs, development guidelines, non-sensitive logs.
* Level 3: Confidential
  - Definition: Sensitive business or customer data requiring controlled access.
  - Examples: Internal financial reports, business analytics, unreleased feature roadmaps, vendor contracts.
* Level 4: Restricted (PII & Secrets)
  - Definition: Highly sensitive data protected by strict legal or security mandates. Unauthorized disclosure causes severe harm.
  - Examples: Customer Personally Identifiable Information (PII), database credentials, JWT secrets, Stripe API keys, cryptographic private keys.

---
End of Document
