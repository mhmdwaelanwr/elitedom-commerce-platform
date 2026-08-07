# UI/UX Design System & Component Specification (DESIGN_SYSTEM.md)

**Document Classification:** Internal / Frontend Engineering & Design  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom Store Storefront, Tailwind CSS, FastAPI UI, Odoo 17 Portal  

---

## 1. Executive Summary & Overview
This document defines the official Design System and UI/UX standards for the **Elitedom Store** e-commerce platform and user interfaces. It establishes a unified visual language, component library guidelines, color tokens, typography scales, and accessibility compliance rules across the FastAPI storefront and Odoo 17 portal integrations.

---

## 2. Color Palette & Brand Tokens
The color system is optimized for high-contrast e-commerce readability, conversion focus, and dark/light mode compatibility.

| Token Name | Hex Code | Usage / Context |
| :--- | :--- | :--- |
| **Primary / Brand** | `#0F172A` | Slate 900: Primary dark headers, navigation bars, and primary CTAs. |
| **Accent / Action** | `#2563EB` | Blue 600: Interactive buttons, active links, checkout triggers, and highlights. |
| **Success / Stock** | `#16A34A` | Green 600: In-stock badges, payment success notifications, and positive states. |
| **Warning / Alert** | `#D97706` | Amber 600: Low stock notices, pending verification, and caution banners. |
| **Danger / Error** | `#DC2626` | Red 600: Out-of-stock states, payment failures, and RMA rejection banners. |
| **Neutral Light** | `#F8FAFC` | Slate 50: Background fills, card surfaces, and subtle container borders. |
| **Neutral Dark** | `#334155` | Slate 700: Secondary text, icons, and muted body copy. |

---

## 3. Typography Scale & Hierarchy
The typography framework utilizes clean sans-serif typefaces (Inter / System UI) optimized for digital commerce legibility.

| Style Level | Font Size / Weight | Line Height | Usage Example |
| :--- | :--- | :--- | :--- |
| **H1 (Page Title)** | `36px` (Bold / 700) | `44px` | Checkout page headers, main category titles. |
| **H2 (Section Header)** | `28px` (SemiBold / 600) | `36px` | Product grid section titles, dashboard headings. |
| **H3 (Card Title)** | `20px` (SemiBold / 600) | `28px` | Hardware product card titles, modal headers. |
| **Body Large** | `16px` (Regular / 400) | `24px` | Featured descriptions, primary form inputs. |
| **Body Regular** | `14px` (Regular / 400) | `20px` | Standard product specs, table rows, footers. |
| **Caption / Badge** | `12px` (Medium / 500) | `16px` | Stock count badges, serial number tags, microcopy. |

---

## 4. Spacing & Layout Grid
* **Grid System:** 12-column responsive fluid grid with standard 16px/24px gutters on mobile and 32px gutters on desktop viewports.
* **8pt Spacing Scale:** All margin, padding, and layout offsets strictly adhere to the 8pt multiplier scale (`8px`, `16px`, `24px`, `32px`, `48px`, `64px`).
* **Container Maximum Widths:** 
  * Mobile: `100%` (with 16px side padding)
  * Tablet: `768px`
  * Desktop Storefront: `1280px`

---

## 5. UI Component Guidelines
* **Buttons:** 
  * *Primary CTA:* Solid Accent color (`#2563EB`), rounded corners (`8px`), hover state shadow elevation (`shadow-md`).
  * *Secondary CTA:* Transparent background with 1px border matching Primary Brand color.
* **Product Cards:** Clean white or slate-50 surface, subtle border (`1px solid #E2E8F0`), fixed image aspect ratio (`1:1`), with clear price hierarchy and quick-add action buttons.
* **Form Inputs & Modals:** Floating or top-aligned labels with immediate client-side validation feedback. Modals feature blurred background overlays (`backdrop-blur-sm`) with clear escape-key dismissals.

---

## 6. Accessibility & Standards
* **WCAG 2.1 AA Compliance:** All text and interactive elements maintain a minimum contrast ratio of 4.5:1 against their background surfaces.
* **Focus States:** Keyboard navigation elements must display a distinct 2px focus ring (`ring-2 ring-blue-600`) to support accessibility users.

---
End of Document
