# Performance & Load Testing Specification (PERFORMANCE_TESTS.md)

**Document Classification:** Internal / Quality Assurance & Performance Engineering  
**Version:** 2.1  
**Status:** Approved / Execution Ready  
**Target System:** Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL, Algolia Search  

---

## 1. Executive Summary & Overview
This document defines the performance benchmarks, load testing scenarios, and concurrency thresholds for the **Elitedom Store** e-commerce platform. It ensures that the FastAPI backend, PostgreSQL database, Algolia search engine, and Odoo 17 ERP integration can seamlessly handle high-traffic spikes (such as high-end RTX 50-series hardware launches) without degradation in user experience or system stability.

---

## 2. Key Performance Indicators (KPIs) & Thresholds
System performance is evaluated against strict latency and resource utilization benchmarks prior to production deployment on Oracle Cloud VPS:

| Metric Category | Target Threshold | Description & Context |
| :--- | :--- | :--- |
| **Search Latency** | $< 300	ext{ ms}$ | Algolia search and keyword filtering response time under concurrent load. |
| **API Read Latency** | $< 200	ext{ ms}$ (p95) | FastAPI product catalog and detail page (PDP) fetch requests. |
| **API Write Latency** | $< 500	ext{ ms}$ (p95) | Secure checkout submission and cart updates. |
| **Database Concurrency** | $\le 1,000$ active connections | PostgreSQL connection pooling efficiency under peak load simulation. |
| **VPS CPU Utilization** | $< 85\%$ | Oracle Cloud VPS resource usage during stress testing. |
| **VPS Memory Usage** | $< 80\%$ | Preventing memory exhaustion and container restarts. |

---

## 3. Load Testing Scenarios (k6 / JMeter)
Automated load test scripts simulate real-world user behavior across two primary stress vectors:

### Scenario A: Flash Sale Traffic Spike (Product Discovery)
* **Objective:** Test system stability during high-volume browsing and search queries.
* **Concurrency Profile:** Ramp up from 0 to 5,000 virtual users (VUs) over 5 minutes, sustain for 15 minutes, and ramp down over 2 minutes.
* **Target Endpoints:** `/api/v1/products/search`, `/api/v1/catalog`, and Algolia integration endpoints.
* **Success Criteria:** 99.9% successful HTTP responses ($200	ext{ OK}$), zero timeout errors, and search response times remaining below $300	ext{ ms}$.

### Scenario B: Concurrent Checkout & ERP Webhook Synchronization
* **Objective:** Test database transaction locking and Odoo 17 ERP webhook delivery under heavy purchase volume.
* **Concurrency Profile:** Sustained load of 500 concurrent checkouts processing orders with calculated 14% VAT and EGP 150 shipping fees.
* **Target Endpoints:** `/api/v1/checkout`, `/api/v1/orders`, and Odoo webhook receiver.
* **Success Criteria:** Zero double-decrement errors on inventory stock counts, successful unique serial number ($S/N$) assignment, and valid HMAC-SHA256 signature verification on webhooks.

---

## 4. Monitoring & Error Tracking Infrastructure
* **Infrastructure Monitoring:** Real-time resource tracking via DataDog agents deployed on Oracle Cloud VPS containers.
* **Exception Logging:** Application errors, HTTP 5xx faults, and database bottlenecks are automatically captured in Sentry.
* **Sign-off Gate:** Any performance test resulting in a p95 write latency $> 500	ext{ ms}$ or server memory leaks will block staging sign-off and require optimization.

---
End of Document
