---
title: "Documentation Status Model"
status: reference
owner: engineering
document_type: governance
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Documentation Status Model scope or referenced implementation sources change."
---

# Documentation Status Model

## Purpose

Defines the lifecycle states used to prevent planned, historical, and operational material from being mistaken for current implementation.

## Reference

### current

Current implementation or governing policy. Must cite executable source-of-truth paths and change with the implementation.

### operational

A procedure intended for execution against an environment. Success must still be demonstrated by release/environment evidence.

### reference

A curated index, glossary, schema summary or explanatory view derived from stronger sources.

### planned

A target, proposal or requirement not guaranteed to be delivered.

### historical

An immutable record of what was delivered or observed at a point in time.

### superseded

A retained decision/design replaced by a newer decision. Must identify the replacement where known.

## Source of truth

- `elitedom-store/scripts/validate_documentation.py`

## Maintenance rule

This page is a curated reference, not a substitute for executable code, database migrations, provider dashboards, or production evidence. Update it with the implementation that changes the referenced contract.
