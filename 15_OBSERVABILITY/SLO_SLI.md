# Service Level Objectives & Indicators (SLO_SLI.md)

Document Classification: Internal / Site Reliability Engineering (SRE)  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP  

---

## 1. Overview
This document defines the Service Level Indicators (SLIs) and Service Level Objectives (SLOs) for the Elitedom Store platform. These metrics align engineering efforts with customer experience and business reliability goals.

## 2. Key Definitions
* SLI (Service Level Indicator): A carefully defined quantitative measure of service quality (e.g., successful request rate, request latency).
* SLO (Service Level Objective): A target value or range of values for a service level measured by an SLI over a specific time window.
* Error Budget: The allowable amount of unreliability a service can accumulate before users are significantly impacted. Calculated as `100% - SLO`.

## 3. Elitedom Store Core SLOs
* API Availability (FastAPI Backend):
  - SLI: Percentage of valid non-5xx HTTP requests handled by the FastAPI application.
  - SLO: 99.9% availability measured over a 30-day rolling window.
* API Latency (FastAPI Backend):
  - SLI: Percentage of HTTP requests completed in under 500ms (p95).
  - SLO: 95% of requests must meet the latency threshold over a 30-day rolling window.
* Odoo Sync Reliability:
  - SLI: Percentage of successfully processed webhooks and background inventory synchronizations between FastAPI and Odoo 17.
  - SLO: 99.5% success rate over a 30-day rolling window.

## 4. Error Budget Policy
* When the error budget is exhausted (e.g., due to an outage or a bad deployment), feature releases for the affected service are frozen until reliability is restored and post-mortem actions are completed.

---
End of Document
