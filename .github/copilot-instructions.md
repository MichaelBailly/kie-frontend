# Copilot instructions (kie-frontend)

## What this app is

- SvelteKit (Svelte 5 + TS) UI for KIE AI music generation; “Projects → Generations → Songs”, with real-time status updates.
- Persistence is local SQLite via Bun (`bun:sqlite`) with WAL; DB path is `kie-music.db` in dev and `/data/kie-music.db` in prod (see [src/lib/db.server.ts](src/lib/db.server.ts)).

## Core flows (server)

- **Create generation**: [src/routes/api/generations/+server.ts](src/routes/api/generations/+server.ts) creates DB row → calls KIE API ([src/lib/kie-api.server.ts](src/lib/kie-api.server.ts)) → stores `task_id` → starts polling ([src/lib/polling.server.ts](src/lib/polling.server.ts)).
- **Extend song**: [src/routes/api/generations/extend/+server.ts](src/routes/api/generations/extend/+server.ts) creates a generation with `extends_*` fields and polls the same way.
- **Import song**: [src/routes/api/import/+server.ts](src/routes/api/import/+server.ts) fetches completed generation data from KIE API by `task_id` → creates a new project → stores generation with full track data (no polling needed, already complete).
- **Stem separation**: [src/routes/api/stem-separation/+server.ts](src/routes/api/stem-separation/+server.ts) creates a `stem_separations` row → calls KIE vocal-removal API → polls via [src/lib/polling.server.ts](src/lib/polling.server.ts).
- Polling cadence is 5s × 120 (≈10 min). KIE statuses map to app statuses: `PENDING/TEXT_SUCCESS/FIRST_SUCCESS` → `processing/text_success/first_success`, `SUCCESS` → `success`, error statuses → `error`.

## Real-time updates (SSE)

- **Single SSE connection**: Client creates one `EventSource('/api/sse')` connection in [src/routes/projects/[projectId]/+layout.svelte](src/routes/projects/[projectId]/+layout.svelte) for all real-time updates.
- Server broadcasts generation updates and stem separation updates from polling using [src/lib/sse.server.ts](src/lib/sse.server.ts) (`notifyClients`, `notifyStemSeparationClients`) via [src/routes/api/sse/+server.ts](src/routes/api/sse/+server.ts).
- Layout handles both generation updates (merged into `projects` state) and stem separation updates (stored in `stemSeparationUpdates` Map).
- Child pages access live data via Svelte context: `activeProject` for generation updates, `stemSeparations` for stem separation updates.
- Audio playback uses a Svelte 5 store; streaming → final URL swap is handled by [src/lib/stores/audio.svelte.ts](src/lib/stores/audio.svelte.ts).

## Server-only conventions

- Server-only modules use `.server.ts`; do not import them from client `.svelte` files (use `+page.server.ts` / `+layout.server.ts` to fetch data).
- On server startup, incomplete work is recovered in [src/hooks.server.ts](src/hooks.server.ts) via `getPending*` + `recoverIncomplete*` (polling resumes after restarts).
- Env vars are read server-side only; required: `KIE_API_KEY` (see [src/lib/constants.server.ts](src/lib/constants.server.ts)).

## UI + styling conventions

- Svelte 5 runes only: `$props()`, `$state()`, `$derived()`, `$effect()` (example: [src/lib/components/GenerationCard.svelte](src/lib/components/GenerationCard.svelte)). Avoid Svelte 4 patterns (`export let`, `<slot />`, `$:`).
- Tailwind v4 is configured CSS-first in [src/routes/layout.css](src/routes/layout.css) and via Vite plugin in [vite.config.ts](vite.config.ts). Prefer utility classes; keep global CSS changes in `layout.css`.

## Workflows (Bun)

- Dev: `bun run dev` (SQLite files are ignored to avoid server restarts; see [vite.config.ts](vite.config.ts)).
- Typecheck: `bun run check` • Lint/format: `bun run lint` / `bun run format` • Tests: `bun run test` (CI) or `bun run test:unit` (watch).
