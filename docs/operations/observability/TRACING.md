# Distributed Tracing Standards (TRACING.md)

Document Classification: Internal / Site Reliability Engineering (SRE)  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL  

---

## 1. Overview
Distributed tracing allows us to track the lifecycle of a single request as it propagates across multiple services (e.g., from the FastAPI storefront API, through background workers, to the Odoo 17 ERP backend and PostgreSQL database).

## 2. Core Concepts
* Trace: Represents the complete end-to-end journey of a request, composed of multiple spans.
* Span: A single timed operation within a trace, containing a name, start time, duration, attributes, and events.
* Context Propagation: The mechanism of passing trace identifiers (`traceparent` header) across HTTP boundaries between FastAPI and Odoo 17.

## 3. Implementation Standards (OpenTelemetry)
* SDK Integration: All microservices must initialize the OpenTelemetry SDK on startup.
* W3C Trace Context: Mandatory use of W3C standard headers (`traceparent`) for propagating trace state across HTTP requests via `httpx`.
* Database Tracing: Automatically instrument SQLAlchemy and async PostgreSQL drivers to capture SQL query durations and execution plans within traces.

## 4. Sampling Strategies
* Production Environment: Use a probabilistic sampler (e.g., 10% to 20% sample rate) for normal traffic to balance storage costs and visibility.
* Error Tracing: Force 100% sampling for any request that results in an HTTP 5xx error, database deadlock, or unhandled exception.

---
End of Document
