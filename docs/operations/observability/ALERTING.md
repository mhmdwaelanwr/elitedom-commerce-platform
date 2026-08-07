# Alerting Strategy & Rules (ALERTING.md)

Document Classification: Internal / Site Reliability Engineering (SRE)  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, Oracle Cloud VPS  

---

## 1. Overview
Alerting must be actionable, meaningful, and tied directly to user impact or critical infrastructure degradation. Avoid alert fatigue by ensuring alerts require human intervention.

## 2. Alert Severity Levels
* P1 - Critical: Immediate customer-facing outage or data loss risk (e.g., storefront down, FastAPI backend returning 5xx universally, Odoo database connection failure). Requires waking up the on-call engineer.
* P2 - Warning: Significant degradation or component failure that does not immediately break the entire user experience (e.g., Algolia sync failing repeatedly, high memory usage > 85%, increased error rates on secondary endpoints). Handled during working hours.
* P3 - Info: Non-urgent notifications for tracking trends or capacity planning (e.g., disk space reaching 75%). Routed to logging channels only.

## 3. Core Alerting Rules
* High Error Rate: Trigger P1 if FastAPI 5xx error rate exceeds 5% over a 5-minute window.
* High Latency: Trigger P2 if p95 HTTP response duration exceeds 1000ms for more than 10 minutes.
* Odoo Sync Failure: Trigger P2 if background sync jobs fail consecutively 3 times.
* VPS Resource Saturation: Trigger P1 if CPU load average exceeds VPS core count for 15 minutes continuously.

## 4. Notification Channels
* P1 Alerts: Routed instantly to PagerDuty and high-priority Slack channels (`#alerts-critical`).
* P2/P3 Alerts: Routed to standard operational Slack channels (`#alerts-ops`) and email summaries.

---
End of Document
