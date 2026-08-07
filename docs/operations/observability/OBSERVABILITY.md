# Observability Strategy (OBSERVABILITY.md)

Document Classification: Internal / Site Reliability Engineering (SRE)  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, Oracle Cloud VPS  

---

## 1. Executive Summary
This document outlines the overarching Observability strategy for the Elitedom Store platform. True observability goes beyond simple monitoring; it empowers our engineering and DevOps teams to answer arbitrary questions about the system's internal state using external outputs (Logs, Metrics, and Traces).

## 2. The Three Pillars of Observability
To ensure high availability, rapid incident response, and performance optimization, Elitedom strictly enforces the integration of three core pillars across all microservices and ERP modules:
* Logging: Immutable records of discrete events that happened over time (Detailed in `LOGGING.md`).
* Metrics: Aggregated numeric representations of data measured over intervals of time (Detailed in `METRICS.md`).
* Tracing: A representation of a series of causally related distributed events that encode the end-to-end request flow (Detailed in `TRACING.md`).

## 3. Core Tooling Stack
* Error Tracking & APM: Sentry (Integrated into FastAPI and Odoo).
* Time-Series Database (Metrics): Prometheus.
* Visualization & Dashboards: Grafana.
* Log Aggregation: Promtail + Loki (Grafana Stack) for lightweight log querying.
* Distributed Tracing: OpenTelemetry SDKs outputting to Jaeger.

## 4. Universal Observability Guidelines
* Zero PII Policy: NEVER log Personally Identifiable Information (PII), raw passwords, JWTs, or sensitive financial payloads (e.g., Stripe tokens, user addresses).
* Correlation IDs: Every HTTP request entering the FastAPI backend must be tagged with an `X-Request-ID`. This ID must be propagated to Odoo 17 during webhook dispatches to stitch logs and traces together.
* Actionability: Telemetry should be designed for actionability. Do not collect metrics or logs that do not serve a dashboard, an alert, or a post-mortem debugging session.

---
End of Document
