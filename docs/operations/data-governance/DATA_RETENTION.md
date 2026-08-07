# Data Retention Policy (DATA_RETENTION.md)

Document Classification: Internal / Security & Compliance  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL  

---

## 1. Overview
This document defines the retention periods and secure disposal procedures for all data stored within the Elitedom Store infrastructure, ensuring compliance with legal mandates, financial regulations, and privacy standards.

## 2. Retention Periods by Data Category
* Financial & Transaction Records:
  - Retention Period: Minimum 7 years (to comply with tax and statutory financial auditing laws).
  - Storage: Encrypted PostgreSQL archival tables and Odoo 17 accounting modules.
* Operational & Access Logs:
  - Retention Period: 90 days active in Loki/Promtail, followed by 1 year in compressed cold storage for security audits.
* Customer Account & Profile Data:
  - Retention Period: Retained as long as the user account is active. Upon account deletion request, PII must be scrubbed or anonymized within 30 days, retaining only transaction IDs required for financial compliance.
* Staging & Development Data:
  - Retention Period: Temporary staging databases and caches must be purged or overwritten automatically every 30 days.

## 3. Secure Data Disposal
* Data Deletion: When data reaches the end of its lifecycle, it must be permanently deleted using secure overwrite protocols.
* Backups: Backups containing expired data must cycle out naturally according to the 30-day backup retention window.

---
End of Document
