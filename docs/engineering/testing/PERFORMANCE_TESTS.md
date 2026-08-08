---
title: "Performance Testing"
status: current
owner: engineering
document_type: testing
verified_against: "0b1ae60b5ed0d3bb4976e10337a16dca04e2aa0f"
review_trigger: "Performance Testing behavior, evidence, or source-of-truth changes."
---

# Performance Testing

## Purpose

Defines how performance claims are measured and prevents unmeasured targets from becoming fictional SLAs.

## Current state

The application includes performance-oriented controls such as Vite production bundling, immutable caching for hashed frontend assets, CDN/object-media support, Redis production rate limiting, bounded provider/readiness timeouts and optional external search/media services. Production throughput/latency capacity is not established by unit CI.

## Invariants and controls

- Define workload mix, data volume, concurrency, geography and acceptance percentile before a load test.
- Measure API latency/error rate, database/Redis saturation, worker queue behavior and frontend/web vitals separately.
- Measure SPA initial-load bundle cost, route-transition behavior and media/CDN performance rather than assuming framework optimization.
- Do not benchmark with debug mode, development media assumptions or fake zero-latency providers and call it production capacity.
- Record release/environment/tool/config with results.

## Source of truth

- `docs/operations/observability/`
- `elitedom-store/backend/app/config.py`
- `elitedom-store/frontend/vite.config.ts`
- `elitedom-store/frontend/nginx.conf`
- `elitedom-store/frontend/`

## Verification

Execute controlled staging load/performance tests and attach results to release evidence; do not commit real credentials in test tooling.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
