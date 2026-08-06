# Versioning & Release Management Strategy (VERSIONING.md)

**Document Classification:** Internal  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Backend, PostgreSQL 15, Odoo 17 Core)  

---

## 1. Executive Summary & Philosophy
This document establishes the official versioning, release management, and semantic versioning (SemVer) guidelines for the **Elitedom Store** ecosystem. Given the multi-tier architecture uniting the FastAPI e-commerce microservices, the client web/mobile applications, and the **Odoo 17 ERP** backend, maintaining strict version control ensures backward compatibility, seamless integrations, and dependable deployment lifecycles.

---

## 2. Semantic Versioning Specification (SemVer 2.0.0)

All software components, custom Odoo modules, and microservices in the Elitedom platform follow the standard **Major.Minor.Patch** (`X.Y.Z`) format:

* **MAJOR (`X.0.0`):** Incremented for incompatible API changes, breaking database schema modifications, or major architectural shifts that require client or ERP migration action.
* **MINOR (`0.Y.0`):** Incremented when new functional features, endpoints, or business modules (e.g., PC Builder enhancements, new payment gateways) are added in a backward-compatible manner.
* **PATCH (`0.0.Z`):** Incremented for backward-compatible bug fixes, security patches, and performance optimizations.

---

## 3. Component-Specific Versioning Rules

### 3.1. FastAPI Backend & Microservices
* Versioned via Git tags and container image tags in the CI/CD container registry (e.g., `v1.4.2`).
* Public REST endpoints maintain explicit version prefixes in the URI path (e.g., `/v1/products`, `/v1/checkout`) to ensure zero downtime for legacy client apps during rolling upgrades.

### 3.2. Odoo 17 ERP Custom Modules (`elitedom_core`, `elitedom_pos`, `elitedom_inventory`)
* Managed via the module's `__manifest__.py` file under the `version` key.
* Format: `17.1.0.0` (where `17` aligns with the Odoo major version, followed by the module iteration).
* Database upgrades are triggered systematically via Odoo module update routines (`-u module_name`) governed by `MIGRATION_STRATEGY.md`.

### 3.3. Mobile Application (Future Flutter Client SDK)
* Versioned according to application store standards: `Version + Build Number` (e.g., `1.2.0+42`).
* Major and minor releases must coordinate with backend API feature flags to ensure older client builds gracefully handle updated payloads.

---

## 4. Release Lifecycle & Branching Strategy

The repository follows a GitFlow-inspired branching model to govern code promotion from development to production:

1. **`main` Branch:** Represents the current production-ready state. Every merge to `main` triggers automated CI/CD pipelines to production staging or live environments.
2. **`develop` Branch:** Integration branch for ongoing feature development, tested against staging databases.
3. **Feature Branches (`feature/*`):** Created from `develop` for individual task implementation.
4. **Release Branches (`release/*`):** Branched from `develop` for final QA, bug fixing, and version tagging before merging into `main`.
5. **Hotfix Branches (`hotfix/*`):** Branched directly from `main` to address critical production incidents, merged back into both `main` and `develop`.

---

## 5. Deprecation Policy & Sunset Timelines

When phasing out legacy endpoints, database columns, or API parameters:
* **Advance Notice:** Deprecated features must be marked with deprecation warning headers (`Warning: 299 - "Endpoint deprecated, use /v2/... instead"`) for a minimum of 90 days.
* **Major Version Removal:** Actual removal or breaking alteration of deprecated functionality shall only occur upon the release of a new **MAJOR** version (`X.0.0`).

---
End of Document
