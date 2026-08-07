---
title: "Design System"
status: current
owner: engineering
document_type: design-system
verified_against: "5be8b80647ecdd5e5410a84b88edc2c1bd8a95f3"
review_trigger: "Design System behavior, evidence, or source-of-truth changes."
---

# Design System

## Purpose

Defines UI consistency rules for the storefront and administration experience without duplicating component implementation.

## Current state

The frontend uses Next.js 16, React 19 and Tailwind CSS 4 with repository design-system checks. The product supports English/Arabic, LTR/RTL and light/dark/system preferences; these are cross-cutting requirements for new UI.

## Invariants and controls

- Use semantic tokens/components rather than page-specific hard-coded visual systems.
- Preserve light, dark and system preference behavior.
- Preserve EN/AR and direction-aware spacing/icons/layout.
- Interactive states include hover/focus/disabled/loading/error where relevant.
- Responsive behavior is defined from mobile through desktop; admin density must not break keyboard access.
- Run the design-system check before build.

## Source of truth

- `elitedom-store/frontend/src/app/globals.css`
- `elitedom-store/frontend/src/components/`
- `elitedom-store/frontend/scripts/check-design-system.mjs`

## Verification

`npm run check:design-system`, lint, TypeScript and production build must pass; accessibility/responsive acceptance is also part of UAT.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must describe implemented behavior separately from planned or provider-dependent work.
