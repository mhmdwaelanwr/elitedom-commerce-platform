# Security Controls & Hardening Standard (SECURITY_CONTROLS.md)

Document Classification: Internal / Cybersecurity & Engineering  
Version: 1.0  
Status: Approved / Commercial Readiness  
Target System: Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, Oracle Cloud VPS  

---

## 1. Overview
This document defines the baseline security controls implemented across the Elitedom Store infrastructure to protect against unauthorized access, data breaches, and service disruption during commercial operations.

## 2. Infrastructure Hardening (Oracle Cloud VPS)
* SSH Access: Password authentication is strictly disabled; SSH access requires Ed25519 public keys.
* Firewall & Network Segmentation: UFW (Uncomplicated Firewall) blocks all incoming traffic except ports 80 (HTTP), 443 (HTTPS), and restricted SSH management ports.
* Docker Isolation: All microservices (FastAPI, Odoo 17, PostgreSQL, Redis) run in isolated Docker networks with restricted inter-container communication.

## 3. Application Security Controls
* Input Validation: FastAPI strictly enforces Pydantic v2 validation models for all incoming HTTP payloads to prevent injection attacks.
* Authentication & Authorization: Stateless JWT tokens with short expiration windows and secure refresh token rotation. Role-Based Access Control (RBAC) enforced on Odoo ERP endpoints.
* Dependency Vulnerability Scanning: Automated `pip-audit` and GitHub Dependabot scans run on every CI/CD pipeline run.

---
End of Document
