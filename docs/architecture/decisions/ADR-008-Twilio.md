---
title: "ADR-008 — Twilio SMS Delivery"
status: current
owner: architecture
document_type: adr
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Phone-OTP delivery provider, authentication authority, or SMS adapter ownership materially changes."
decision_status: Accepted
---

# ADR-008 — Twilio SMS Delivery

## Status

Accepted — optional delivery adapter.

## Context

Phone-first authentication needs an SMS delivery mechanism, while OTP generation, hashing, expiry, resend/cooldown behavior, abuse controls, verification, and account/session policy must remain application-owned. A messaging provider must not become the authority for whether an application identity is authenticated.

## Decision

Use Twilio as the supported optional SMS delivery adapter for OTP delivery. Keep OTP lifecycle and authentication decisions inside the backend auth domain, and keep Twilio credentials/server configuration outside the browser.

## Consequences

- Twilio delivery success is not equivalent to OTP verification.
- Provider failure must not mark an OTP or identity as verified.
- Credentials, sender/messaging-service identifiers, and provider tokens remain server-side configuration.
- Application cooldown/rate-limit/expiry controls apply independently of provider responses.
- Live sender/messaging-service acceptance remains environment-specific launch evidence.
- A different SMS provider can replace the delivery adapter without redefining core OTP/auth semantics.

## Implementation evidence

- `elitedom-store/backend/app/integrations/twilio/tasks.py`
- `elitedom-store/backend/app/modules/auth/delivery.py`
- `docs/architecture/integrations/TWILIO.md`

## Review rule

If Twilio is replaced as the supported adapter or phone authentication changes its authority/security model, supersede this ADR with a new decision rather than rewriting the historical choice.
