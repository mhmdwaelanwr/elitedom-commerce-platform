# Metrics Standards (METRICS.md)

Document Classification: Internal / Site Reliability Engineering (SRE)  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP  

---

## 1. Overview
This document specifies the metrics collection strategy using Prometheus. Metrics provide numerical time-series data to understand the system's behavior, trigger alerts, and power Grafana dashboards.

## 2. Core Metric Types
* Counters: A cumulative metric that only goes up (e.g., total HTTP requests, total database errors).
* Gauges: A single numerical value that can arbitrarily go up and down (e.g., active database connections, current memory usage).
* Histograms: Samples observations and counts them in configurable buckets (e.g., HTTP request latency, query execution time).

## 3. The USE Method (Infrastructure)
For infrastructure resources (Oracle Cloud VPS, Docker containers), track:
* Utilization: % of resource time spent doing work (e.g., CPU utilization).
* Saturation: The amount of extra work queued up (e.g., load average).
* Errors: The count of error events (e.g., network interface drops).

## 4. The RED Method (Services)
For the FastAPI backend and Odoo APIs, track:
* Rate: The number of requests per second.
* Errors: The number of failed requests per second (HTTP 5xx).
* Duration: The amount of time those requests take (Latency/Response time).

## 5. Implementation Standards
* FastAPI: Use `prometheus-fastapi-instrumentator` to automatically expose default RED metrics at the `/metrics` endpoint.
* Odoo 17: Utilize Odoo Prometheus exporter modules.
* Custom Business Metrics: Explicitly define counters for key events (e.g., `orders_placed_total`, `sync_failures_odoo_total`).

---
End of Document
