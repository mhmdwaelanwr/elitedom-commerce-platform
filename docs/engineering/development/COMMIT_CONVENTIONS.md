---
title: "Commit Conventions"
status: reference
owner: engineering
document_type: development-reference
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Commit Conventions scope or referenced implementation sources change."
---

# Commit Conventions

## Purpose

Defines commit-message conventions for readable history without forcing semantic-release tooling.

## Reference

### Format

Prefer imperative summaries such as `Auth: enforce staff MFA session state`, `Docs: align payment integration status`, `Migrations: add launch acceptance evidence`.

### Scope

A commit should represent a coherent unit; avoid mixing formatting, generated artifacts and behavior unrelated to the message.

### History

Do not falsify authored history or rewrite merged migration/release records.

### Secrets

Commit messages must not contain credentials, private URLs, customer data or security-sensitive reproduction details.

## Source of truth

- `CONTRIBUTING.md`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
