# Stage 2 — Design system, theme, and localization foundation

## Delivered

- Semantic color tokens for background, surface, elevated content, primary, accent, muted text, danger, success, warning, borders, overlays, and foreground text.
- Real `system | light | dark` preferences shared by the storefront and admin console.
- A pre-hydration bootstrap script that applies the saved preference before React renders to prevent a theme flash.
- `en | ar` locale preferences with root-level `lang` and `dir` updates.
- Cookie and local-storage persistence for locale and theme.
- Typed translation domains: common, storefront, auth, checkout, account, admin, validation, and errors.
- Locale-aware EGP/USD, number, and date formatters.
- Error-code translation mapping so UI copy does not depend on English backend messages.
- Reusable UI primitives: Button, Input, Select, Card, Modal, Drawer, Toast, Tabs, Table, Pagination, Skeleton, EmptyState, and ErrorState.
- Semantic and localized storefront header, search, footer, and admin shell.
- A build-time design-system check that compares locale keys, validates required tokens, and rejects fixed dark colors in foundation files.

## Preference contract

| Preference | Values | Persistence |
| --- | --- | --- |
| Locale | `en`, `ar` | `elitedom_locale` cookie and `elitedom.preferences.locale.v1` local storage |
| Theme | `system`, `light`, `dark` | `elitedom_theme` cookie and `elitedom.preferences.theme.v1` local storage |

The cookie is the server-rendering source. The local-storage copy allows the pre-hydration script to apply preferences immediately in the browser.

## Translation usage

Client components use `usePreferences()`:

```tsx
const { locale, direction, t } = usePreferences();
return <h1>{t("storefront", "shopAll")}</h1>;
```

Backend failures should expose stable error codes. Convert them with `getLocalizedErrorMessage(locale, errorCode)` rather than displaying provider or server text directly.

## Styling rules

1. Use semantic Tailwind utilities such as `bg-background`, `bg-surface`, `text-foreground`, `text-muted`, `border-border`, and `bg-primary`.
2. Do not add page-level hexadecimal colors or fixed Slate/Gray palettes.
3. Use logical direction utilities (`ms`, `me`, `ps`, `pe`, `start`, `end`, `border-s`, `border-e`) for bidirectional layouts.
4. Business logic stays outside UI primitives.
5. Add every user-facing string to the appropriate translation domain.

## Validation

Run from `elitedom-store/frontend`:

```bash
npm ci
npm run verify
npm run build
```

`npm run verify` runs the design-system contract, ESLint, and TypeScript checks. `npm run build` repeats the design-system contract before the Next.js production build so fixed-color or translation regressions cannot bypass production builds.

## Manual test matrix

Validate the storefront header/search/footer, admin shell, form controls, overlays, feedback states, and data-display primitives in all four combinations:

- English + Light
- English + Dark
- Arabic + Light
- Arabic + Dark

Also verify `system` follows the operating-system preference without a visible flash on reload.

## Scope boundary

This stage establishes the shared foundation and converts application shells. Stage 3 applies the design system and translations while rebuilding the full storefront pages with live data. Existing feature-page copy that is replaced during Stage 3 is not duplicated here.
