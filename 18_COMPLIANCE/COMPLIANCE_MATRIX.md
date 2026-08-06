# Compliance Matrix & Regulatory Mapping (COMPLIANCE_MATRIX.md)

Document Classification: Internal / Legal & Regulatory Compliance  
Version: 1.0  
Status: Approved / Commercial Readiness  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, Stripe  

---

## 1. Overview
As Elitedom Store transitions into a fully commercial e-commerce platform, maintaining legal and regulatory compliance is mandatory. This compliance matrix maps our technical implementations and business workflows against recognized international and regional standards.

## 2. Regulatory Frameworks & Applicability
* GDPR (General Data Protection Regulation): Applicable for handling customer PII, data subject rights, and user consent tracking.
* PCI-DSS (Payment Card Industry Data Security Standard): Applicable for secure payment processing via Stripe integration.
* Consumer Protection & E-commerce Laws: Applicable for transparent pricing, clear refund policies, and transactional record-keeping.

## 3. Compliance Mapping Table
| Requirement / Standard | Control ID | System Component | Implementation Status | Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| Data Minimization (GDPR) | REG-01 | FastAPI / PostgreSQL | Implemented | Pydantic v2 strict schema validation |
| Right to be Forgotten (GDPR) | REG-02 | Odoo 17 / PostgreSQL | Implemented | Automated PII anonymization scripts |
| Secure Card Processing (PCI) | SEC-01 | Stripe SDK / FastAPI | Implemented | Targeted SAQ A eligibility via Stripe Elements, subject to validation of the final payment integration and applicable requirements |
| Transaction Auditability | FIN-01 | Odoo 17 Accounting | Implemented | 7-year encrypted log retention |

---
End of Document
