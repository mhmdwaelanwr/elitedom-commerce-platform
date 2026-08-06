# Branching Strategy (BRANCHING_STRATEGY.md)

Document Classification: Internal / Software Engineering & Version Control  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP  

---

## 1. Overview
This document defines the formal branching strategy for the Elitedom Store repositories. We utilize a simplified variant of GitFlow, optimized for Continuous Integration and Continuous Deployment (CI/CD) environments.

## 2. Long-Lived Branches
* main: 
  - Purpose: Represents the absolute source of truth for the production environment.
  - Deployment: Automatically triggers deployment to the production Oracle Cloud VPS (elitedom.store).
  - Restriction: Direct commits are permanently disabled. Code enters only via approved Pull Requests from staging or hotfix branches.

* staging: 
  - Purpose: The primary integration branch for the next release. Used for QA testing, UAT, and verifying bidirectional sync with Odoo 17.
  - Deployment: Automatically triggers deployment to the staging environment (staging.elitedom.store).

## 3. Short-Lived Branches
* feature/*: Created from main. Used for developing new features. Must be merged into staging for testing before final promotion to main.
* bugfix/*: Created from main. Used to fix non-critical bugs found in development or staging.
* hotfix/*: Created from main. Used strictly for critical, production-breaking issues (e.g., Odoo webhook failures, security patches). Must be merged directly into main and backported to staging.

## 4. Branch Naming Conventions
All temporary branches must follow strict naming conventions, optionally including the ticketing system ID:
* feature/add-stripe-webhooks
* feature/TICKET-102-algolia-search
* bugfix/fix-odoo-inventory-sync
* hotfix/patch-jwt-validation

## 5. Branch Protection Rules (GitHub)
* Require Pull Request reviews before merging (Minimum 1 lead engineer approval).
* Require status checks to pass before merging (e.g., CI tests, pip-audit, linting).
* Enforce linear history (Squash and Merge only).
* Restrict direct pushes to main and staging.

---
End of Document
