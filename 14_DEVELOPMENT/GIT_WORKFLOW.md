# Git Workflow (GIT_WORKFLOW.md)

Document Classification: Internal / Software Engineering & Version Control  
Version: 1.0  
Status: Approved / Active  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP  

---

## 1. Overview
The Elitedom Store engineering team follows a structured Feature Branch Workflow. This ensures that the main branch remains stable and always reflects production-ready code, while new features and bug fixes are developed in isolated environments.

## 2. Core Branches
* main: The source of truth for production. Code in this branch must be stable, tested, and deployable at any time. Direct commits to main are strictly prohibited.
* staging: The pre-production integration branch. Features are merged here first for UAT (User Acceptance Testing) and end-to-end integration tests with Odoo 17 before being promoted to main.

## 3. Temporary / Working Branches
* Feature Branches (feature/ticket-name): Used for developing new features. Must branch off from main.
* Bugfix Branches (bugfix/ticket-name): Used for resolving non-critical bugs. Must branch off from main.
* Hotfix Branches (hotfix/issue-description): Used for critical production fixes. Branches off from main and merges back into both main and staging immediately.

## 4. Development Cycle
1. Fetch the latest changes: git checkout main && git pull origin main
2. Create a new branch: git checkout -b feature/new-odoo-sync
3. Commit changes locally using conventional commit messages.
4. Push the branch to the remote repository: git push -u origin feature/new-odoo-sync
5. Open a Pull Request (PR) against the staging branch.

## 5. Merging & Syncing
* Always rebase your feature branch against main to resolve conflicts before opening a PR: git rebase main
* Merges into staging and main use the Squash and Merge strategy to keep the commit history clean and linear.

---
End of Document
