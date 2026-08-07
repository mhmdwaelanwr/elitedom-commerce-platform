# Maintenance & Patch Management Plan (MAINTENANCE.md)

**Document Classification:** Internal / DevOps & System Maintenance  
**Version:** 2.1  
**Status:** Approved / Execution Ready  
**Target System:** Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL, Oracle Cloud VPS  

---

## 1. Executive Summary & Objectives
This document establishes the official Maintenance and Patch Management Plan for the **Elitedom Store** e-commerce platform. It outlines routine maintenance schedules, dependency upgrade workflows, security patching protocols, and system hygiene procedures designed to maintain optimal performance, stability, and security across the Oracle Cloud VPS hosting environment.

---

## 2. Maintenance Windows & Scheduling Policy
* **Routine Maintenance Window:** Every Friday from **03:00 AM to 05:00 AM EET** (Low-traffic period).
* **Emergency Maintenance:** Authorized immediately by the Lead DevOps or CTO in response to critical zero-day vulnerabilities or active security exploits.
* **Downtime Notification:** Users and internal teams are notified via the status page (`status.elitedom.store`) at least 24 hours prior to scheduled invasive maintenance.

---

## 3. Patch Management & Update Workflows

### 3.1 Operating System & Infrastructure Patches (Ubuntu on Oracle Cloud VPS)
* **Frequency:** Monthly (Second Tuesday of each month).
* **Procedure:**
  1. Update system package lists and apply security upgrades:
     ```bash
     sudo apt update && sudo apt upgrade -y
     sudo reboot
     ```
  2. Verify Docker and firewall (UFW) active status post-reboot:
     ```bash
     sudo systemctl status docker ufw
     ```

### 3.2 Backend Dependencies & Container Images (FastAPI & Odoo)
* **Frequency:** Bi-weekly dependency review / Monthly image rebuilds.
* **Procedure:**
  1. Run vulnerability scans on Python dependencies using `pip-audit` or `safety`.
  2. Rebuild Docker images with updated base tags and push to the container registry:
     ```bash
     docker compose build --no-cache
     docker compose up -d --pull always
     ```

---

## 4. Routine System Hygiene & Database Maintenance
* **PostgreSQL Maintenance:** Weekly automated `VACUUM ANALYZE` to reclaim storage and update query planner statistics.
* **Log Rotation:** Configured via `logrotate` to prevent disk exhaustion from Docker container logs (`/var/lib/docker/containers/*`).
* **Cache Cleanup:** Monthly pruning of unused Docker build cache and dangling volumes:
  ```bash
  docker system prune -f --volumes
  ```

---

## 5. Rollback & Contingency Protocol
* If a patch or update causes service failure or unresolvable API errors during maintenance:
  1. Immediately revert to the previous Git release tag or Docker image tag:
     ```bash
     docker compose down
     git checkout <previous-stable-tag>
     docker compose up -d
     ```
  2. Notify the engineering team via Slack and document root cause for post-mortem review.

---
End of Document
