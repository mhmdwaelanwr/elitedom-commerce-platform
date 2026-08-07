# Error Handling & Fault Tolerance Specification (ERROR_HANDLING.md)

**Document Classification:** Internal / Architecture & Operations  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom Store, Odoo 17 ERP, FastAPI Backend, PostgreSQL, External APIs  

---

## 1. Executive Summary & Overview
This document defines the error handling, fault tolerance, and exception management strategies for the **Elitedom Store** e-commerce platform and its integration ecosystem (**Odoo 17 ERP**, FastAPI, Twilio, SendGrid, Typeform, and Hedera HCS). Robust exception handling ensures zero silent failures, preserves data integrity across inventory and ledger transactions, and maintains high availability.

---

## 2. API & Integration Error Handling (FastAPI & Odoo XML-RPC)
Communication between the FastAPI storefront backend and Odoo 17 ERP relies on XML-RPC and JSON payloads.

| Exception / Error Scenario | Root Cause | Handling Strategy / Recovery Workflow |
| :--- | :--- | :--- |
| **Odoo Connection Timeout** | Network partition or Odoo server restart | Implement exponential backoff retry logic (max 3 attempts) in FastAPI middleware; fallback to local read-replica cache for product catalogs. |
| **XML-RPC Fault (Validation Error)** | Invalid data fields or business rule violation (e.g., negative stock allocation) | Catch `xmlrpc.client.Fault`, parse error message, log diagnostic trace, and return a standardized HTTP 400 Bad Request response with user-friendly messaging. |
| **Payload Validation Failure** | Malformed JSON structure from client checkout | Use Pydantic models with strict validation rules in FastAPI to reject requests instantly with HTTP 422 Unprocessable Entity before touching Odoo. |

---

## 3. Third-Party Service Failures
External communication channels (SMS, Email, RMA intake) must not block core e-commerce transactions if they fail.

```text
[External API Call] ---> [Success (200 OK)] ---> [Proceed Normally]
         |
         +---> [Timeout / Rate Limit (429/5xx)] ---> [Circuit Breaker / Queue to Celery / Dead Letter Queue]
```

* **Twilio SMS Failures (Dispatch & Tracking):** If Twilio returns a 4xx/5xx or times out during SMS dispatch, the failure is caught asynchronously. The message payload is pushed to a background retry queue, and internal monitoring logs the alert without failing the customer's Sales Order completion.
* **SendGrid Email Failures (Invoicing):** If PDF invoice delivery via SendGrid fails, Odoo flags the invoice status as `Email Failed` in the backend queue. Warehouse and support dashboards display a manual "Resend Invoice" action button.
* **Typeform Webhook Synchronization:** If the Typeform webhook payload fails to reach Odoo to create a Helpdesk ticket, a signature verification check logs the rejection, and Typeform automatically retries webhook delivery up to 5 times.

---

## 4. Inventory & Serial Number Concurrency Conflicts
To prevent race conditions during high-demand product drops or flash sales:

* **Double-Selling Prevention:** Odoo's native stock reservation mechanism locks inventory records via PostgreSQL row-level locks (`SELECT ... FOR UPDATE`). If two customers attempt to purchase the last available hardware item simultaneously, the second transaction receives a stock allocation conflict error, triggering an automatic cart refresh and prompt to update quantities.
* **Duplicate Serial Number Scanning:** If warehouse staff scan a Serial Number ($S/N$) that is already bound to an active or completed order, Odoo blocks the Delivery Order validation and raises a hard warning banner requiring supervisor override or investigation.

---

## 5. Background Job & Ledger Failures
Maintained by systemd Python scripts and Odoo cron jobs:

* **Hedera HCS Hashing Failures:** If recording payment hashes or B2B audit logs to the Hedera Consensus Service fails due to network or consensus node latency, the local Python script buffers the hash payload in a local fallback SQLite/JSON queue and retries transmission every 15 minutes.
* **Storage Capacity Protection:** Systemd cron jobs and log rotation rules actively monitor Oracle Cloud storage utilization. If log files exceed capacity thresholds, old logs are compressed and purged automatically to prevent server halt.

---
End of Document
