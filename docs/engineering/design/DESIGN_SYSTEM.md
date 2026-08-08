---
title: "Design System"
status: current
owner: engineering
document_type: design-system
verified_against: "3206626bc721deda261c6c6682f5d63c79308f52"
review_trigger: "Design System behavior, evidence, or source-of-truth changes."
---

# Design System

## Purpose

Defines UI consistency requirements for the storefront and administration experience without preserving abandoned component implementations.

## Current state

The frontend is in an approved clean-room reset. The previous UI implementation, reusable components, locale UI layer, providers, and visual assets were intentionally removed. The executable frontend is now a React 19 / TypeScript / Vite single-page application with React Router and Tailwind CSS 4 as the clean foundation while the new storefront is rebuilt from first principles.

English/Arabic, LTR/RTL, light/dark/system preferences, responsive behavior, accessibility, and stable backend/API contracts remain requirements for the rebuilt interface; they are not claimed as implemented by the temporary blank baseline.

## Invariants and controls

- Do not reintroduce abandoned legacy UI components or visual compatibility layers.
- Build the new system from semantic design tokens and reusable primitives.
- Restore EN/AR and direction-aware spacing/icons/layout as part of the new foundation.
- Restore light, dark and system preference behavior as part of the new foundation.
- Interactive states must include hover/focus/disabled/loading/error where relevant.
- Responsive behavior must cover mobile through desktop; admin density must preserve keyboard access.
- Preserve frontend API and shared TypeScript contracts unless an explicit backend-contract change is approved.
- Run the clean-room design-system check before build.

## Source of truth

- `elitedom-store/frontend/src/pages/`
- `elitedom-store/frontend/src/router.tsx`
- `elitedom-store/frontend/src/styles/globals.css`
- `elitedom-store/frontend/scripts/check-design-system.mjs`
- `elitedom-store/frontend/src/lib/`
- `elitedom-store/frontend/src/types/`

A new component source-of-truth directory will be added only when the clean-room component system is intentionally created.

## Verification

`npm run check:design-system`, lint, TypeScript and production build must pass. Accessibility, responsive, localization and theme acceptance return as implementation gates when those layers are rebuilt.

## Change policy

Update this document in the same pull request as any change that alters the described behavior. Documentation must distinguish the temporary clean-room baseline from implemented product behavior and from planned work.