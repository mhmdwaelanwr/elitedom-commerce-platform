# Pull Request Guidelines (PULL_REQUEST_GUIDELINES.md)

Document Classification: Internal / Software Engineering & Collaboration  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP  

---

## 1. Overview
This document standardizes the process for submitting Pull Requests (PRs) to the Elitedom Store repositories. A well-structured PR accelerates the review process, minimizes bugs, and maintains a clear history of why changes were made.

## 2. PR Creation Rules
* Target Branch: Always ensure your PR targets the correct branch (e.g., `staging` for features, `main` for hotfixes).
* Draft PRs: If your code is not yet ready for review but you want to run CI pipelines or share progress, open the PR as a "Draft".
* Size Limit: Keep PRs small and focused on a single issue or feature. If a PR exceeds 400 lines of changes, consider breaking it down into smaller, logical PRs.

## 3. Pull Request Title
Follow the Conventional Commits specification for PR titles to allow for automated changelog generation:
* `feat:` A new feature (e.g., `feat(api): add endpoint for Algolia search sync`)
* `fix:` A bug fix (e.g., `fix(odoo): resolve missing tax rates in order payload`)
* `docs:` Documentation only changes
* `refactor:` A code change that neither fixes a bug nor adds a feature
* `perf:` A code change that improves performance

## 4. Required PR Description Template
Every PR must include a detailed description containing the following sections:

### What does this PR do?
(Provide a brief explanation of the changes introduced by this PR. Include ticket numbers if applicable, e.g., "Resolves #TICKET-123")

### Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Database Migration (requires Alembic upgrade)

### How Has This Been Tested?
(Describe the tests you ran to verify your changes. E.g., "Tested locally against Odoo 17 Docker container. Verified HMAC signature logic using Postman.")

### Deployment Notes
(Are there any special instructions for deploying this? e.g., "Requires setting a new environment variable `STRIPE_WEBHOOK_SECRET`" or "Requires running `alembic upgrade head`").

## 5. Merging Conditions
* CI/CD checks must pass (Unit tests, Linting, Security Scans).
* At least one approval from a Lead Engineer is required.
* All comments and change requests must be resolved.
* Use "Squash and Merge" to keep the commit history clean.

---
End of Document
