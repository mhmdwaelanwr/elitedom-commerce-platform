# Logging Standards (LOGGING.md)

Document Classification: Internal / Site Reliability Engineering (SRE)  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP  

---

## 1. Overview
This document defines the logging standards for all Elitedom Store applications. Consistent logging is critical for debugging, auditing, and monitoring system health.

## 2. Log Levels
* ERROR: System is in distress, customers are affected, or a critical transaction failed (e.g., database connection loss, Stripe webhook failure). Requires immediate attention.
* WARNING: Unexpected events that do not halt the application but warrant investigation (e.g., deprecated API usage, high response time).
* INFO: Normal system operations and state changes (e.g., service startup, background job completion).
* DEBUG: Detailed information useful only during development or deep troubleshooting. Disabled in production.

## 3. Structured Logging (JSON)
* All production logs must be output in JSON format to allow seamless parsing and querying by log aggregation tools (e.g., Promtail/Loki).
* Python's standard `logging` module in FastAPI must be configured with a JSON formatter (e.g., `python-json-logger`).

## 4. Required Log Attributes
Every log entry must include the following minimum fields:
* `timestamp`: ISO 8601 UTC format.
* `level`: Log level (INFO, ERROR, etc.).
* `service_name`: Identifier for the microservice (e.g., `elitedom-fastapi`, `elitedom-odoo`).
* `request_id`: For tracking a specific request across services.
* `message`: A human-readable description of the event.

## 5. Security & PII
* Never log passwords, API keys, JWT tokens, credit card numbers, or full user addresses.
* Mask or redact sensitive payload fields before logging webhook data between FastAPI and Odoo.

---
End of Document
