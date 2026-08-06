# Monitoring & Observability Plan (MONITORING.md)

**Document Classification:** Internal / DevOps & System Observability  
**Version:** 2.1  
**Status:** Approved / Execution Ready  
**Target System:** Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL, Oracle Cloud VPS  

---

## 1. Executive Summary & Objectives
This document defines the official Monitoring and Observability strategy for the **Elitedom Store** e-commerce platform. It establishes the telemetry infrastructure, key performance indicators (KPIs), metric thresholds, and alerting pipelines required to ensure high availability, proactive anomaly detection, and rapid troubleshooting across the FastAPI backend, Odoo 17 ERP, and Oracle Cloud VPS environment.

---

## 2. Observability Stack & Tooling Architecture
| Tool / Component | Function / Role | Deployment Model | Access / Interface |
| :--- | :--- | :--- | :--- |
| **Prometheus** | Metrics scraping, time-series data collection | Docker Container (VPS) | Internal scraper port `9090` |
| **Grafana** | Operational dashboards & metric visualization | Docker Container (VPS) | `https://grafana.elitedom.store` |
| **Sentry** | Application error tracking, exception logging, and APM | SaaS Cloud Integration | Sentry Dashboard & Webhooks |
| **Uptime Robot / Healthcheck** | External HTTP liveness & SSL certificate monitoring | External SaaS Probe | Public Status Page |

---

## 3. Key Performance Indicators (KPIs) & Metric Thresholds

### 3.1 Infrastructure & Resource Metrics (Oracle Cloud VPS)
* **CPU Utilization:** Warning at $> 75\%$, Critical alert at $> 85\%$ sustained over 5 minutes.
* **Memory Usage:** Warning at $> 80\%$, Critical alert at $> 90\%$.
* **Disk Space (PostgreSQL & Odoo Filestore):** Warning at $> 80\%$ usage; critical action required at $> 90\%$.

### 3.2 Application & API Performance Metrics (FastAPI)
* **HTTP Latency (p95):** Target $< 300	ext{ ms}$ for catalog and search endpoints; critical alert if $> 1000	ext{ ms}$.
* **Error Rate (5xx Responses):** Warning at $> 1\%$ of total traffic; critical alert at $> 5\%$.
* **Database Connection Pool:** Monitor active vs. idle connections in PostgreSQL to prevent connection exhaustion.

---

## 4. Alerting Rules & Notification Channels
* **Severity 1 (Critical):** Site outage, database down, or error rate $> 5\%$. 
  * *Notification Channel:* PagerDuty immediate phone call / SMS + urgent Slack DevOps channel alert.
* **Severity 2 (High):** Odoo webhook failure or API latency spike.
  * *Notification Channel:* Slack `#devops-alerts` channel notification.
* **Severity 3/4 (Medium/Low):** Minor disk threshold warning or non-critical error log.
  * *Notification Channel:* Email digest to `devops@elitedom.store`.

---

## 5. Dashboard Maintenance & Review
* Dashboards are maintained under version control in the repository (`monitoring/grafana/`).
* Quarterly reviews are conducted to adjust alert thresholds based on historical traffic growth and seasonal e-commerce peaks.

---
End of Document
