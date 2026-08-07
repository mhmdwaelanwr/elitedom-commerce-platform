---
title: "Network and Trust Boundaries"
status: current
owner: operations
document_type: operations
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Network and Trust Boundaries behavior, evidence, or source-of-truth changes."
---

# Network and Trust Boundaries

## Purpose

Defines network exposure intent and trusted-proxy/ingress assumptions.

## Current state

Containers communicate on `elitedom-net`. Frontend host exposure is loopback-bound by default; Nginx Proxy Manager owns public 80/443. Portainer/NPM admin ports must be restricted by `ADMIN_BIND_IP`/host firewall. FastAPI applies TrustedHost outside development and can use configured trusted proxy IPs for client identity/rate limiting.

## Invariants and controls

- Do not expose PostgreSQL/Redis directly to the public internet.
- Restrict admin control planes to trusted networks/interfaces.
- Public provider callbacks require HTTPS ingress to the FastAPI webhook paths.
- Configure proxy trust narrowly; never trust arbitrary forwarding headers.
- External smoke rejects private/loopback/link-local targets and redirects.

## Source of truth

- `elitedom-store/infrastructure/docker-compose.yml`
- `elitedom-store/backend/app/config.py`
- `elitedom-store/scripts/live_smoke.py`

## Verification

Review host firewall/listeners, DNS/TLS and trusted-proxy settings in the target environment.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
