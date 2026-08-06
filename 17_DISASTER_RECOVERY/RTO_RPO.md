# Recovery Time & Recovery Point Objectives (RTO_RPO.md)

Document Classification: Internal / Site Reliability Engineering (SRE)  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL  

---

## 1. Overview
This document establishes the quantitative recovery metrics—Recovery Time Objective (RTO) and Recovery Point Objective (RPO)—for all critical services within the Elitedom Store platform.

## 2. Core Definitions
* RTO (Recovery Time Objective): The maximum acceptable duration of time that a service can be down after a disaster before severely impacting business operations and customers.
* RPO (Recovery Point Objective): The maximum acceptable data loss measured in time (e.g., how old the restored data can be) following a disruption.

## 3. Elitedom Store Service Objectives
* FastAPI Backend & Storefront:
  - RTO: $\le$ 1 Hour (Time required to provision a new VPS, pull Docker containers, and restore routing).
  - RPO: $\le$ 15 Minutes (Maximum acceptable transactional data loss via continuous database replication / transaction logs).
* Odoo 17 ERP & Inventory Database:
  - RTO: $\le$ 2 Hours (Time required to restore Odoo database instances, verify module states, and re-establish bidirectional webhooks).
  - RPO: $\le$ 1 Hour (Daily incremental / hourly transactional database dumps).
* Static Assets & Media Storage:
  - RTO: $\le$ 4 Hours.
  - RPO: 0 Hours (Zero data loss, maintained via real-time object storage replication).

---
End of Document
