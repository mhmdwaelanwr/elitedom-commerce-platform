---
title: "Twilio SMS Integration"
status: current
owner: architecture
document_type: integration
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Twilio SMS Integration behavior, evidence, or source-of-truth changes."
---

# Twilio SMS Integration

## Purpose

Documents the Twilio SMS boundary, implementation status, security controls and operational enablement requirements.

## Current state

Twilio is an optional implemented delivery adapter used by authentication/notification task paths. OTP policy and verification remain application-owned; sending a message never proves authentication.

## Invariants and controls

- Auth token and sender/messaging-service values remain server-side.
- OTP values are not logged as provider debugging data.
- Delivery failure does not mark OTP verified.
- Rate/cooldown/expiry rules remain in auth domain, independent of provider.

## Enablement and failure mode

Production requires a valid Twilio account/sender configuration and successful delivery testing to supported Egyptian numbers.

## Source of truth

- `elitedom-store/backend/app/integrations/twilio/tasks.py`
- `elitedom-store/backend/app/modules/auth/delivery.py`
- `elitedom-store/backend/app/config.py`

## Verification

Run relevant unit/integration tests and configuration validation. Production requires a valid Twilio account/sender configuration and successful delivery testing to supported Egyptian numbers.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
