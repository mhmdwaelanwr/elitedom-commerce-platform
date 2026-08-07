# Brand Guidelines & Visual Identity (BRAND_GUIDELINES.md)

**Document Classification:** Internal / Frontend Engineering, UI/UX Design & Branding  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom Store Storefront, FastAPI UI, Tailwind CSS, Odoo 17 Portal  

---

## 1. Executive Summary & Brand Core
**Elitedom Store** is a premier e-commerce platform specializing in high-end computer hardware (such as RTX 50-series GPUs, Ryzen processors, and custom rig components). The brand identity reflects precision, high performance, technological sophistication, and absolute reliability.

---

## 2. Color Palette & Tailwind CSS Tokens
Our color system is optimized for a sleek, modern dark/light mode experience preferred by hardware enthusiasts and gamers.

| Color Name | Hex Code | Tailwind Token | Usage & Context |
| :--- | :--- | :--- | :--- |
| **Primary Slate** | `#0F172A` | `slate-900` | Deep background, primary headers, dark mode base |
| **Surface Dark** | `#1E293B` | `slate-800` | Card containers, navigation bar, modals |
| **Accent Electric Blue** | `#38BDF8` | `sky-400` | Primary call-to-actions, active links, focus rings |
| **Success Emerald** | `#16A34A` | `emerald-600` | In-stock indicators, success toast notifications (`#16A34A`) |
| **Error Crimson** | `#DC2626` | `red-600` | Form validation errors, stock depletion alerts (`#DC2626`) |
| **Text Primary** | `#F8FAFC` | `slate-50` | High-contrast body text on dark surfaces |
| **Text Muted** | `#94A3B8` | `slate-400` | Secondary descriptions, timestamps, breadcrumbs |

---

## 3. Typography & Font Families
The typography hierarchy balances clean legibility for commerce with technical precision for hardware specifications and serial numbers ($S/N$).

* **Primary Font (Sans-Serif):** `Inter`, `Roboto`, `system-ui`, sans-serif. Used for all general UI elements, product titles, and body copy.
* **Monospace Font (Code & Serial Numbers):** `JetBrains Mono`, `Fira Code`, monospace. **Mandatory** for displaying Hardware Serial Numbers ($S/N$), order IDs, code snippets, and technical specs.

### Font Scale Guidelines:
* **H1 (Page Titles):** `text-3xl font-bold tracking-tight` (2rem / 32px)
* **H2 (Section Headers):** `text-2xl font-semibold tracking-normal` (1.5rem / 24px)
* **H3 (Card Titles):** `text-lg font-medium` (1.125rem / 18px)
* **Body Text:** `text-sm leading-relaxed text-slate-300` (0.875rem / 14px)
* **Mono/Serial Data:** `font-mono text-xs text-sky-400` (0.75rem / 12px)

---

## 4. UI Component & Button Styling
Buttons and interactive elements must follow consistent state transitions and padding rules using Tailwind CSS classes.

### Primary Button (`[ Add to Cart ]`, `[ Confirm & Pay Securely ]`)
* **Classes:** `bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2 rounded-lg transition-colors duration-200 shadow-sm`
* **Focus State:** `focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-900`

### Secondary / Outline Button (`[ Quick Add ]`, `[ View Details ]`)
* **Classes:** `border border-slate-700 hover:border-slate-500 text-slate-200 font-medium px-3 py-1.5 rounded-lg transition-colors duration-200`

---

## 5. Tone of Voice & Copywriting Rules
* **Authoritative yet Approachable:** Speak with deep technical accuracy regarding hardware specifications without alienating casual buyers.
* **Clarity First:** Avoid fluff. Highlight stock availability, warranty periods (e.g., 1-year warranty), and serial number tracking status clearly.
* **Localization:** Currency must be explicitly designated in Egyptian Pounds (`EGP`) when targeting regional transactions.

---
End of Document
