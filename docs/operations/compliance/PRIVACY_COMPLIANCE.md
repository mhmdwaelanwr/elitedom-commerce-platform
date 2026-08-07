# Privacy & Data Protection Compliance (PRIVACY_COMPLIANCE.md)

Document Classification: Internal / Legal & Privacy Compliance  
Version: 1.0  
Status: Approved / Commercial Readiness  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP  

---

## 1. Overview
This document details the operational and technical mechanisms implemented within the Elitedom Store platform to ensure full compliance with global privacy regulations (such as GDPR and regional consumer data protection laws).

## 2. Consent Management Architecture
* Explicit Opt-In: Users must explicitly check mandatory consent boxes during account registration and checkout regarding terms of service and data processing.
* Granular Consent: Separate consents for transactional processing vs. marketing communications, stored immutably in PostgreSQL with timestamps and user IP records.

## 3. Data Subject Access Requests (DSAR) Workflow
* Right to Access: Automated FastAPI endpoints allowing authenticated users to request and export their profile data, order history, and preferences in a structured JSON format.
* Right to Erasure ("Forgotten"): An automated workflow that triggers PII anonymization across PostgreSQL and Odoo 17 ERP tables while retaining legally mandated financial transaction logs.

## 4. Cross-Border Data Privacy
* All customer personal data is encrypted at rest and in transit, residing securely within our primary Oracle Cloud infrastructure regions under strict access control policies.

---
End of Document
