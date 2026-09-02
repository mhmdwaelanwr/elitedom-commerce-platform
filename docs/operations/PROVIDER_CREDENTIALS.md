---
document_type: operations
owner: operations
review_trigger: provider-credential-rotation
status: operational
title: Provider Credentials Setup Guide
verified_against: staging-environment
---

# Provider Credentials Setup Guide

## Overview

This document lists all external provider credentials needed for staging/production.

## Source of truth

Provider names, environment keys, runtime validation, and launch acceptance must stay aligned with:

- `elitedom-store/.env.example`
- `elitedom-store/backend/app/config.py`
- `elitedom-store/docs/GO_LIVE_RUNBOOK.md`

## Priority Order

### 1. Paymob (Payment Gateway) — HIGH
**Status:** Required for checkout to work

**Steps:**
1. Create account at https://www.paymob.com
2. Get sandbox credentials from dashboard
3. Configure in `.env`:
   ```
   PAYMOB_ENABLED=true
   PAYMOB_SECRET_KEY=sk_test_...
   PAYMOB_PUBLIC_KEY=pk_test_...
   PAYMOB_HMAC_SECRET=...
   PAYMOB_CARD_PAYMENT_METHOD_ID=<id>
   PAYMOB_WALLET_PAYMENT_METHOD_ID=<id>
   PAYMOB_NOTIFICATION_URL=https://api.staging.elitedom.store/api/v1/webhooks/paymob/transaction
   PAYMOB_REDIRECTION_URL=https://staging.elitedom.store/checkout/payment-result
   ```

### 2. Google OAuth — HIGH
**Status:** Required for Google Sign-In

**Steps:**
1. Go to https://console.cloud.google.com
2. Create project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Configure redirect URIs:
   - `https://staging.elitedom.store/auth/callback/google`
6. Configure in `.env`:
   ```
   GOOGLE_OAUTH_CLIENT_ID=<client-id>.apps.googleusercontent.com
   ```
7. Configure frontend `VITE_GOOGLE_CLIENT_ID=<same-client-id>`

### 3. Twilio (SMS OTP) — HIGH
**Status:** Required for phone authentication

**Steps:**
1. Create account at https://www.twilio.com
2. Get a phone number
3. Configure in `.env`:
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+1...
   TWILIO_MESSAGING_SERVICE_SID=MG...
   ```

### 4. Odoo 17 — HIGH
**Status:** Required for ERP sync

**Steps:**
1. Have Odoo 17 Community running (already in Docker)
2. Create API user in Odoo
3. Configure in `.env`:
   ```
   ODOO_SYNC_ENABLED=true
   ODOO_WEBHOOKS_ENABLED=true
   ODOO_API_USER=elitedom_api_user
   ODOO_API_KEY=<api-key>
   ODOO_WEBHOOK_SECRET=<hmac-secret>
   ```

### 5. Apple OAuth — MEDIUM
**Status:** Required for Apple Sign-In

**Steps:**
1. Apple Developer account
2. Create App ID and Service ID
3. Configure in `.env`:
   ```
   APPLE_OAUTH_CLIENT_ID=<service-id>
   ```
4. Configure frontend `VITE_APPLE_CLIENT_ID=<same-service-id>`

### 6. Sentry (Error Tracking) — LOW
**Status:** Optional but recommended

**Steps:**
1. Create account at https://sentry.io
2. Create project
3. Configure in `.env`:
   ```
   SENTRY_ENABLED=true
   SENTRY_DSN=https://...@sentry.io/...
   SENTRY_RELEASE=<deployed-sha>
   ```

### 7. SendGrid/ZeptoMail (Email) — LOW
**Status:** Optional for transactional emails

**Steps:**
1. Create account at SendGrid or ZeptoMail
2. Configure in `.env`:
   ```
   SENDGRID_ENABLED=true
   SENDGRID_API_KEY=SG...
   SENDGRID_FROM_EMAIL=noreply@elitedom.store
   ```

## Security Notes

- Never commit credentials to Git
- Use GitHub Environment secrets for CI/CD
- Rotate credentials regularly
- Use sandbox/test credentials for staging
- Keep production credentials separate