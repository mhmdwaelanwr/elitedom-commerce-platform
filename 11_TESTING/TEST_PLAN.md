# Test Plan Document (TPD) - Elitedom Store

**Document Classification:** Internal  
**Version:** 2.1  
**Status:** Under Review  
**Owner:** Mohamed Anwar  
**Target System:** Elitedom E-Commerce & Odoo ERP Integration  

---

## 1. Introduction & Objectives
This document defines the comprehensive testing strategy and execution plan for the **Elitedom Store** platform prior to production release. The primary objective is to validate system functionality, ERP synchronization accuracy, payment security, performance benchmarks, and overall stability to ensure an error-free user and administrative experience.

---

## 2. Testing Scope & Methodology
The testing lifecycle follows a phased approach combining automated testing pipelines and rigorous manual QA scripts across the following layers:
- **Frontend Storefront & User Journeys:** Responsive design, navigation, search speed, and checkout flows.
- **Backend & Odoo ERP Integration:** Bi-directional data sync, inventory webhooks, and order processing.
- **Third-Party Services:** Stripe payment processing, Twilio SMS alerts, Algolia search, and Hedera Web3 audit hashing.

---

## 3. Detailed Test Phases

### Phase 1: Unit Testing
- **Focus:** Individual code modules, Python functions, and database models.
- **Execution:** Automated test suites running within the CI/CD pipeline before container builds.
- **Key Checkpoints:**
  - Password hashing and validation rules (Bcrypt/Argon2).
  - Data integrity constraints and foreign key relationships in PostgreSQL.
  - Cart calculation logic (subtotals, taxes, and shipping fees across Egyptian governorates).

### Phase 2: Integration Testing
- **Focus:** Communication between the e-commerce storefront, Odoo ERP (`odoo:17.0`), and external APIs.
- **Key Checkpoints:**
  - **Odoo ERP Sync:** Verify that placing an order correctly generates a sales order payload inside Odoo and updates stock levels via bi-directional webhooks.
  - **Payment Gateways:** Test Stripe checkout sessions for successful payments, failed transactions, and webhook response handling.
  - **Search Engine:** Verify Algolia index synchronization when products are updated in the admin panel.
  - **Web3 Audit Hash:** Test that completed payment records correctly trigger the Python script to anchor SHA-256 hashes onto the Hedera Consensus Service.

### Phase 3: System & Functional Testing (End-to-End)
- **Focus:** Complete user workflows from entry to fulfillment.
- **Test Scenarios:**
  - **US-101 & US-102:** User registration with Egyptian mobile validation and social login (Google/Apple OAuth).
  - **US-201 & US-202:** Multi-level category browsing and typo-tolerant search queries returning results within 300ms.
  - **US-301 & US-302:** Persistent cart merging for guest-to-logged-in users and secure checkout execution (Credit Card, Mobile Wallet, COD).
  - **US-401 & US-402:** Order confirmation notifications (SMS/Email) and warehouse packing slip generation.
  - **US-501 & US-502:** Automated stock depletion and dropshipping purchase order routing for out-of-stock items.
  - **US-601 & US-602:** Warranty and RMA ticket submission with media uploads and support review workflows.
  - **US-701 & US-702:** B2B bulk Request for Quote (RFQ) submission and custom corporate price proposal conversion.
  - **US-801:** Loyalty points accumulation on purchase completion and redemption at checkout.

### Phase 4: Performance & Load Testing
- **Focus:** System responsiveness and concurrency limits under heavy traffic.
- **Tools:** Apache JMeter / k6.
- **Key Benchmarks:**
  - **Search Latency:** Algolia search responses must remain under 300ms under concurrent search queries.
  - **Database Load:** PostgreSQL performance during peak traffic simulation (measuring connection pooling and query execution time).
  - **Container Stability:** Monitoring Oracle Cloud VPS resource utilization via DataDog during load tests to prevent memory/CPU exhaustion.

### Phase 5: Security & Penetration Testing
- **Focus:** Identifying vulnerabilities, injection flaws, and authorization bypasses.
- **Key Checkpoints:**
  - **TLS Encryption:** Enforcing TLS 1.3 across all routes and validating HSTS headers.
  - **Authentication & Rate Limiting:** Testing brute-force protection on `/auth/login` and `/auth/register` endpoints.
  - **Webhook Security:** Verifying that incoming webhooks reject requests lacking valid `HMAC-SHA256` signatures (`X-Elitedom-Signature`).
  - **Access Control (RBAC):** Confirming that users cannot access administrative or other user endpoints.

### Phase 6: User Acceptance Testing (UAT)
- **Focus:** Real-world validation by internal stakeholders (warehouse operators, support agents, and store administrators).
- **Execution:** Staging environment dry runs (`https://staging.elitedom.store`) to sign off on UI usability, debranded Odoo backend workflows, and email/SMS notification deliveries.

---

## 4. Bug Tracking & Defect Management
- **Issue Tracking:** Errors caught during testing are logged directly into **Sentry** (for application exceptions) or tracked as internal tickets.
- **Severity Classification:**
  - **Critical (P0):** System crashes, payment failures, data corruption, or security breaches (blocks release).
  - **Major (P1):** Incorrect calculation, broken UI component, or failed webhook notification (requires hotfix before release).
  - **Minor (P2):** Cosmetic alignment issues or typo errors (fixed in post-launch patches).

---
**End of Document**
