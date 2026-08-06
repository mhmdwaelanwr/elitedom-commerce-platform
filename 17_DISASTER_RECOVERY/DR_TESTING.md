# Disaster Recovery Testing & Simulation (DR_TESTING.md)

Document Classification: Internal / Site Reliability Engineering & Compliance  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL  

---

## 1. Overview
A disaster recovery plan is only as good as its last successful test. This document defines the mandatory cadence, procedures, and evaluation criteria for conducting disaster recovery simulations and game days for the Elitedom Store platform.

## 2. Testing Cadence & Schedule
* Quarterly Table-Top Exercises: Review and walk through disaster scenarios, credential access, and communication plans with the engineering team.
* Semi-Annual Restore Drills: Execute a full database restore from encrypted backups onto an isolated staging environment to verify backup integrity and measure RPO/RTO.
* Annual Full-Scale Game Day: Simulate a catastrophic primary VPS failure in an isolated staging network to test end-to-end failover procedures and DNS propagation.

## 3. DR Test Plan Structure
1. Pre-Test Briefing: Define objectives, scope, and success criteria (e.g., verifying database restoration under 2 hours).
2. Execution Phase: Simulate the disruption (e.g., terminating the primary database container or dropping test tables) without affecting live production traffic.
3. Measurement: Track time-to-recovery against defined RTO and data completeness against RPO targets.
4. Post-Mortem & Remediation: Document bottlenecks, update recovery scripts, and assign Jira tasks for any identified gaps.

## 4. Success Criteria
* A DR drill is considered successful if all critical services (FastAPI, Odoo 17, and PostgreSQL) are fully restored and verified operational within the defined RTO limits with zero unhandled data corruption.

---
End of Document
