# Disaster Recovery Strategy (DR_STRATEGY.md)

Document Classification: Internal / Site Reliability Engineering & Security  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, Oracle Cloud VPS  

---

## 1. Overview
This document defines the overarching Disaster Recovery (DR) strategy for the Elitedom Store platform. The goal is to ensure business continuity, protect customer data, and minimize downtime in the event of catastrophic infrastructure failures, data corruption, or regional outages on our Oracle Cloud VPS environment.

## 2. Disaster Scenarios & Classifications
* Tier 1 - Infrastructure Outage (VPS Failure): Complete loss of the primary Oracle Cloud compute instance hosting FastAPI, Odoo 17, and PostgreSQL.
* Tier 2 - Database Corruption: Unrecoverable logical or physical damage to PostgreSQL or Odoo ERP internal databases due to bad migrations or faulty queries.
* Tier 3 - Ransomware / Security Breach: Malicious compromise of server access requiring full environment isolation and rebuild from clean snapshots.
* Tier 4 - Third-Party Integration Outage: Extended downtime of external dependencies (e.g., Stripe, Algolia) requiring graceful degradation modes.

## 3. High-Level DR Architecture
* Primary Region: Oracle Cloud VPS production instance (`elitedom.store`).
* Backup Storage: Encrypted off-site object storage (Oracle Cloud Object Storage / secure external bucket) located in a secondary isolated availability domain.
* Infrastructure as Code (IaC): Complete server provisioning, Docker Compose configurations, and Nginx setups are fully version-controlled, allowing rapid redeployment on a fresh VPS instance.

---
End of Document
