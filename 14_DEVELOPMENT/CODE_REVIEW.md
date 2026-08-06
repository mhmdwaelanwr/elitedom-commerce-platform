# Code Review Guidelines (CODE_REVIEW.md)

Document Classification: Internal / Software Engineering & QA  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP  

---

## 1. Overview
Code reviews are a mandatory part of the Elitedom Store development lifecycle. They ensure code quality, maintain security standards, prevent architectural drift, and foster knowledge sharing among the engineering team.

## 2. Reviewer Responsibilities
* Security First: Actively look for OWASP Top 10 vulnerabilities, ensure JWT tokens are handled securely, and verify Odoo webhook HMAC signatures are strictly validated.
* Performance & Architecture: Check for asynchronous blocking calls, inefficient database queries (e.g., N+1 problems in SQLAlchemy), and adherence to the FastAPI and Odoo 17 ERP architecture.
* Empathy & Clarity: Provide constructive, actionable, and respectful feedback. Explain *why* a change is requested, not just *what* needs changing.

## 3. Author Responsibilities
* Self-Review: Review your own code before requesting a review from others. Ensure all debugging statements (e.g., `print()`, console logs) are removed.
* Context: Provide a clear Pull Request description outlining what the code does, why the change is necessary, and how it was tested locally or on staging.
* Responsiveness: Address all reviewer comments. If you disagree with a comment, discuss it respectfully in the PR thread.

## 4. The Review Process & Approvals
* Minimum Approvals: Every Pull Request requires at least one (1) approval from a Lead Engineer before it can be merged into `staging` or `main`.
* CI/CD Gates: All automated checks (Unit Tests, pip-audit, linting via Black, and isort) must pass before a review is officially completed and approved.
* Stale PRs: Pull requests open for more than 5 days without activity will be marked as stale and eventually closed.

## 5. Code Review Checklist
- [ ] Logic: Does the code achieve the intended business requirement? Are edge cases handled?
- [ ] Security: Are all API inputs validated via Pydantic? Are database operations parameterized?
- [ ] Performance: Are database calls optimized? Is `async/await` utilized correctly without blocking the event loop?
- [ ] Testing: Are there adequate unit/integration tests for the new feature or bug fix?
- [ ] Readability: Is the code strictly typed? Are variables and functions named descriptively?

---
End of Document
