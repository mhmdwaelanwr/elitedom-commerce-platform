---
title: "Zoho Integration Plan"
status: planned
owner: architecture
document_type: integration
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Zoho Integration Plan behavior, evidence, or source-of-truth changes."
---

# Zoho Integration Plan

## Purpose

Documents the Zoho Plan boundary, implementation status, security controls and operational enablement requirements.

## Current state

Zoho credential fields exist in configuration, but repository search does not establish a current production adapter comparable to Odoo/Paymob/Twilio/SendGrid/ZeptoMail. Treat Zoho as planned/configuration surface, not delivered CRM synchronization.

## Invariants and controls

- Do not provision or expose Zoho secrets until an adapter is implemented and reviewed.
- Future synchronization must define data ownership, idempotency, PII scope and retry behavior.
- A credential field alone is not implementation evidence.

## Enablement and failure mode

Before enablement, add executable adapter/tests, document scopes/webhooks/data mapping, and record provider acceptance.

## Source of truth

- `elitedom-store/backend/app/config.py`

## Verification

Run relevant unit/integration tests and configuration validation. Before enablement, add executable adapter/tests, document scopes/webhooks/data mapping, and record provider acceptance.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
