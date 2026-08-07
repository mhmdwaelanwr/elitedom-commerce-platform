# ADR-007: Selection of Algolia for High-Performance Product Search

**Document Classification:** Internal  
**Status:** Accepted  
**Date:** 2026  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration  

---

## 1. Context and Problem Statement
The Elitedom Store platform features an extensive hardware product catalog with diverse specifications, categories, and attributes. As the user base and inventory grow, standard relational database queries for product search and filtering can introduce noticeable latency, impacting conversion rates and user experience. We need to select and integrate a dedicated search and discovery engine that delivers lightning-fast response times, robust typo tolerance, and dynamic faceted navigation without placing heavy read loads on our primary PostgreSQL database and Odoo 17 ERP backbone.

## 2. Decision Drivers
* Requirement for ultra-low search latency (sub-100ms response times for product catalog queries).
* Advanced search features including typo tolerance, synonyms, predictive auto-complete, and relevance tuning.
* Dynamic faceted navigation to filter hardware components by attributes (e.g., brand, price, technical specifications).
* Scalability and reduced infrastructure maintenance overhead compared to self-hosted search clusters.

## 3. Considered Options
* **Option 1:** Native PostgreSQL Full-Text Search capabilities.
* **Option 2:** Self-hosted search engine cluster (e.g., Elasticsearch or OpenSearch).
* **Option 3:** Managed Search-as-a-Service platform (Algolia).

## 4. Decision Outcome
**Chosen Option:** **Option 3 (Algolia)**. Algolia shall serve as the primary product search and discovery engine for the web storefront and mobile applications, ensuring sub-100ms search latency and advanced filtering capabilities synchronized via middleware events from the Odoo 17 ERP product catalog.

## 5. Consequences
### Positive Consequences
* Exceptional search performance and user experience with instant, typo-tolerant query results and dynamic filtering.
* Offloads intensive search and aggregation traffic from the primary PostgreSQL database and Odoo 17 ERP instance.
* Fully managed cloud service that eliminates the operational complexity of scaling and maintaining self-hosted search clusters.

### Negative Consequences / Trade-offs
* Introduction of a third-party SaaS dependency, requiring an event-driven synchronization pipeline (webhook or cron-based sync) to keep Algolia indices updated whenever product data or stock levels change in Odoo 17.
* Ongoing subscription costs based on search volume and record counts as the platform scales.

---
**End of Document**
