# Grafana Dashboards & Visualization Standards (DASHBOARDS.md)

Document Classification: Internal / Site Reliability Engineering (SRE)  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, Grafana  

---

## 1. Overview
Dashboards serve as the single source of truth for the real-time operational health of the Elitedom Store platform. All dashboards must be standardized, easy to read at a glance, and structured around the RED and USE methodologies.

## 2. Core Dashboard Hierarchy
* Executive / High-Level Overview: Displays high-level platform health, active users, overall error rates, total revenue/orders per minute, and active P1/P2 alerts.
* FastAPI Backend APM: Focuses on request rates, error rates, p50/p95/p99 latencies per endpoint, database connection pool saturation, and async event loop health.
* Odoo 17 ERP & Sync Dashboard: Monitors webhook dispatch latencies, inbound/outbound sync success/failure ratios, queue lengths, and background job execution times.
* Infrastructure & VPS Dashboard: Tracks CPU utilization, memory pressure, disk I/O, and network traffic across Oracle Cloud instances.

## 3. Design & Layout Best Practices
* Top-to-Bottom Flow: Place critical status indicators and high-level summaries at the top, followed by detailed charts and logs at the bottom.
* Consistent Color Coding: Use green for healthy states, yellow/orange for warnings, and red for critical thresholds or errors.
* Variable Templating: Use Grafana variables for environment filtering (`env: production` vs `env: staging`) and specific microservice selection.

---
End of Document
