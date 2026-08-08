# Elitedom React frontend rules

This frontend is a React 19 + TypeScript + Vite single-page application.

- Use React Router for client-side routing; do not add Next.js App Router conventions.
- Browser-visible configuration uses `VITE_*` variables only.
- Keep API/auth/catalog logic in `src/lib` and shared types in `src/types`.
- Preserve English/Arabic, LTR/RTL, light/dark, responsive and accessibility requirements.
- Keep server-authoritative money, stock, payment, permission and order state.
- Production routing must support SPA fallback to `index.html` while static assets remain cacheable.
