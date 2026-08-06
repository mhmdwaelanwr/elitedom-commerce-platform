# ADR-005: Selection of Oracle Cloud Infrastructure (OCI) as Cloud Hosting Provider

**Document Classification:** Internal  
**Status:** Accepted  
**Date:** 2026  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration  

---

## 1. Context and Problem Statement
The Elitedom Store platform—comprising the Odoo 17 ERP backend, PostgreSQL database, custom Python middleware, reactive web storefront, and Flutter mobile API backend—requires a secure, scalable, and cost-effective cloud infrastructure provider. We need to select a cloud hosting environment that supports containerized workloads (Docker/Kubernetes), ensures high availability and low latency for our target users, and provides robust enterprise-grade reliability without excessive infrastructure overhead.

## 2. Decision Drivers
* Need for a cloud-native environment supporting container orchestration and infrastructure as code.
* High performance, predictable pricing, and cost-effectiveness for compute and database workloads.
* Robust security, isolated virtual cloud networks (VCN), and strict access control mechanisms.
* Low latency and reliable connectivity for regional operations.

## 3. Considered Options
* **Option 1:** Amazon Web Services (AWS).
* **Option 2:** Microsoft Azure.
* **Option 3:** Oracle Cloud Infrastructure (OCI).

## 4. Decision Outcome
**Chosen Option:** **Option 3 (Oracle Cloud Infrastructure - OCI)**. OCI shall serve as the primary cloud hosting provider for the Elitedom Store platform, providing high-performance compute instances, managed database support for PostgreSQL, and reliable container deployment capabilities that align with our cloud-native strategy.

## 5. Consequences
### Positive Consequences
* Excellent price-to-performance ratio, particularly regarding compute resources, memory bandwidth, and low data egress fees.
* Strong enterprise security controls, robust database optimization for PostgreSQL, and reliable infrastructure scaling.
* Seamless integration with containerized Docker and Kubernetes deployment pipelines.

### Negative Consequences / Trade-offs
* Smaller community and ecosystem size compared to hyperscalers like AWS, requiring team adaptation to OCI-specific networking and IAM tooling.

---
**End of Document**
