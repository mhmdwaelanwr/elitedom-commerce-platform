# User Acceptance Testing (UAT) Specification (UAT.md)

**Document Classification:** Internal / Quality Assurance & Stakeholder Sign-Off  
**Version:** 2.1  
**Status:** Approved / Staging Execution Ready  
**Target System:** Elitedom Storefront (`https://staging.elitedom.store`), FastAPI Backend, Odoo 17 ERP, PostgreSQL  

---

## 1. Executive Summary & Overview
This document defines the User Acceptance Testing (UAT) strategy, stakeholder workflows, and formal sign-off criteria for the **Elitedom Store** e-commerce platform. UAT is executed on the staging environment (`https://staging.elitedom.store`) to validate that business processes, administrative workflows, inventory management via Odoo 17 ERP, and end-user experiences satisfy all functional and operational requirements prior to production deployment.

---

## 2. UAT Stakeholder Roles & Responsibilities
Formal validation requires cross-functional sign-off from designated internal stakeholders:

| Role / Stakeholder | Department | Core UAT Responsibilities |
| :--- | :--- | :--- |
| **Store Administrator** | Management / Sales | Validate pricing rules, 14% VAT calculations, discount campaigns, and overall storefront branding. |
| **Warehouse Operator** | Logistics & Inventory | Verify Odoo 17 ERP order synchronization, stock picking lists, barcode scanning, and stock level depletions. |
| **Support Agent** | Customer Service | Test RMA ticket creation, warranty claim processing, and Odoo Helpdesk communication flows. |
| **QA Lead / Engineer** | Quality Assurance | Oversee test execution, monitor Sentry error tracking, and verify webhook signature authenticity. |

---

## 3. UAT Execution Matrix & Workflows

| UAT ID | Module / Business Domain | Test Scenario & Business Workflow | Expected Business Outcome | Stakeholder Sign-Off Status |
| :--- | :--- | :--- | :--- | :--- |
| **UAT-BUS-01** | Storefront Navigation | Browse hardware catalog, apply filters (e.g., RTX 50-series GPUs), and perform typo-tolerant search. | Products render instantly ($< 300\text{ ms}$) with accurate Egyptian Pound (`EGP`) pricing and specs. | Approved |
| **UAT-BUS-02** | Customer Checkout | Complete end-to-end checkout flow with Cairo shipping address (El Matareya) and Cash on Delivery (COD) / Credit Card. | Order confirmation email/SMS dispatched; order logged correctly in FastAPI backend database. | Approved |
| **UAT-BUS-03** | Odoo ERP Synchronization | Verify background processing of confirmed order inside Odoo 17 ERP backend. | Sales order payload successfully created in Odoo 17 with valid `X-Elitedom-Signature` and stock decremented. | Approved |
| **UAT-BUS-04** | RMA & Warranty Claims | Submit a warranty support ticket with hardware Serial Number ($S/N$) and mock image attachment. | Odoo Helpdesk ticket generated successfully; user receives tracking ID and 24-48h SLA timeline confirmation. | Approved |
| **UAT-BUS-05** | Administrative Dashboard | Log in as store administrator, review bulk RFQs, and manage product inventory adjustments. | Admin controls function smoothly with strict RBAC enforcement blocking unauthorized customer access. | Approved |

---

## 4. Defect Escalation & Production Release Sign-Off
* **Defect Logging:** Any usability flaws or business logic discrepancies discovered during UAT must be logged immediately as internal Jira/Sentry tickets.
* **Sign-Off Gate:** Production deployment to Oracle Cloud VPS requires 100% test case pass rate and explicit digital sign-off from all designated stakeholder roles (Store Admin, Warehouse Lead, and QA Lead).

---
End of Document
