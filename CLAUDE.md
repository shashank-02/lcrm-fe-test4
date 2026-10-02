# CLAUDE.md — lead-crm-frontend

Conventions live in the backend repo at `docs/CLAUDE_SKILL.md` (section 3). Quick facts:

- Stack: React 18 · Vite 5 · TypeScript strict · Tailwind 3 (CSS-variable theme, `.dark` class) · TanStack Query · zustand · react-router v6 · recharts · sonner.
- Commands: `npm run dev` (proxies `/api` → `http://localhost:4000`) · `npm run typecheck` · `npm run build`.
- Data: `api` from `lib/api.ts` (bearer + refresh); reference data from `useBootstrap()`; permission checks with `useCan()`.
- After lead mutations call `useLeadInvalidate()(id)`; after admin config changes `useInvalidateBootstrap()`.
- Custom lead fields are data-driven (`DynamicInput` / `fieldValue`); admin CRUD screens are specs in `pages/admin/configSpecs.tsx`.
- UI primitives: `components/ui/index.tsx`; utility classes `.card .input .th .td .pill` in `styles/globals.css`. Use theme tokens, not hard-coded colours.
- v1.2 conventions: `cn()` is tailwind-merge backed (later classes win — write `checked ? 'bg-primary' : 'bg-surface'`, never both); colours are RGB-channel tokens so `bg-primary/10` works; `PageHeader` shows a `BackButton` on all non-root pages; `Menu` clamps to the viewport (`mobileSheet` for wide panels); the shell is `h-[100dvh] overflow-hidden` and `<main id="main-scroll">` is the only scroller — never add `overflow-x: hidden` to `body`.
- Admin-configurable layouts: catalogue in `lib/uiconfig.ts` (mirror of the backend); editors in `pages/admin/layoutPages.tsx`; consumers read `boot.org.settings.{leadTabs,dashboards[role],quickActions}` which the API always returns normalised.
- Every modal that calls the API follows: primary action → `onClose()` → `toast` → `safeRefresh(() => inv(id))`. Reset form state on `open`; depend on `lead.id`, not `lead`, to avoid resets while editing.
- Tests: `npm test` (vitest + jsdom, `src/__tests__/`). Mock `@/lib/api` per route; engines in the viewer are mocked.
