# Copilot instructions (kie-frontend)

## Stack + big picture
- **Music generation frontend**: SvelteKit app that interfaces with KIE AI's music generation API to create AI-generated songs organized by projects.
- Built with **Svelte 5 + TypeScript**, bundled via Vite; server build uses `@sveltejs/adapter-node` (see [svelte.config.js](svelte.config.js)).
- **Data flow**: User submits generation request → API creates DB record → KIE API call → polling loop checks status → SSE notifies clients → UI updates in real-time.
- **State management**: Uses Bun's built-in SQLite (`bun:sqlite`) with WAL mode; data persists at `kie-music.db` (dev) or `/data/kie-music.db` (prod).
- App entry points live under [src/routes/](src/routes/) (SvelteKit file-based routing).

## Architecture patterns

### Server-side conventions (`.server.ts` files)
- All server-only code uses `.server.ts` suffix (see [src/lib/db.server.ts](src/lib/db.server.ts), [src/lib/kie-api.server.ts](src/lib/kie-api.server.ts)).
- Never import `.server.ts` files in client-side `.svelte` components—use load functions in `+page.server.ts` or `+layout.server.ts` instead.
- Env vars accessed via `process.env` in server code only (see [src/lib/constants.server.ts](src/lib/constants.server.ts)).

### Data model (Projects → Generations)
- **Projects**: Containers for music generations (see [src/lib/db.server.ts](src/lib/db.server.ts#L11-L16)).
- **Generations**: Individual music creation attempts with status tracking (`pending`, `processing`, `text_success`, `first_success`, `success`, `error`).
- Each generation stores 2 tracks (variants) with URLs for streaming (`track1_stream_url`), downloading (`track1_audio_url`), and cover art (`track1_image_url`).
- Use `getGenerationsByProject(projectId)` to fetch all generations for a project; `getLatestGenerationByProject(projectId)` for form pre-fill.

### Real-time updates (SSE pattern)
- **Server-sent events** via [src/routes/api/sse/+server.ts](src/routes/api/sse/+server.ts) push generation updates to all connected clients.
- [src/lib/sse.server.ts](src/lib/sse.server.ts) manages client connections; `notifyClients()` broadcasts to all.
- After creating a generation via `POST /api/generations`, the server starts async polling (see [src/routes/api/generations/+server.ts](src/routes/api/generations/+server.ts#L72-L159)) and broadcasts updates.
- Clients should connect to `/api/sse` and listen for `generation_update`, `generation_complete`, `generation_error` events.

### API integration (KIE AI polling)
- [src/lib/kie-api.server.ts](src/lib/kie-api.server.ts) wraps KIE API calls: `generateMusic()` starts task, `getMusicDetails(taskId)` polls status.
- **Polling strategy**: 5-second intervals, max 120 attempts (10 minutes). Status progresses: `PENDING` → `TEXT_SUCCESS` → `FIRST_SUCCESS` → `SUCCESS`.
- `FIRST_SUCCESS` provides early streaming URL for track 1; `SUCCESS` provides final audio URLs for both tracks.
- Error states: `CREATE_TASK_FAILED`, `GENERATE_AUDIO_FAILED`, `CALLBACK_EXCEPTION`, `SENSITIVE_WORD_ERROR` (see [src/lib/kie-api.server.ts](src/lib/kie-api.server.ts#L100-L107)).

## Package manager + common workflows
- Use **Bun** for all scripts (see [package.json](package.json)). Prefer `bun run <script>`.
  - Dev: `bun run dev`
  - Build/preview: `bun run build`, `bun run preview`
  - Typecheck: `bun run check` (runs `svelte-kit sync` + `svelte-check`)
  - Format/lint: `bun run format`, `bun run lint`
  - Tests: `bun run test` (CI-style `--run`), `bun run test:unit`

## Svelte 5 conventions (important)
- This repo uses **Svelte 5 runes**: `$props()`, `$derived()`, `$state()` (see [src/lib/components/GenerationCard.svelte](src/lib/components/GenerationCard.svelte#L5)).
- Props destructuring: `let { generation, selected = false } = $props();`
- Children rendering: `let { children } = $props();` + `{@render children()}` (see [src/routes/+layout.svelte](src/routes/+layout.svelte)).
- **Never use Svelte 4 patterns** (`<slot />`, `export let`, `$:` reactive statements) in this codebase.

## Styling (Tailwind CSS v4)
- Tailwind is wired via `@tailwindcss/vite` (see [vite.config.ts](vite.config.ts)) and CSS-first config in [src/routes/layout.css](src/routes/layout.css):
  - `@import 'tailwindcss';`
  - `@plugin '@tailwindcss/forms';`, `@plugin '@tailwindcss/typography';`
- Prettier's Tailwind plugin is configured to read the stylesheet at `./src/routes/layout.css` (see `.prettierrc`). Avoid moving these directives without updating `.prettierrc`.
- Use utility classes for all styling (no component-scoped `<style>` blocks unless absolutely necessary).

## Testing (Vitest split: browser + node)
- Vitest is configured with 2 projects in [vite.config.ts](vite.config.ts):
  - **client**: browser tests for `src/**/*.svelte.{test,spec}.{js,ts}` using Playwright + `vitest-browser-svelte` (example: [src/routes/page.svelte.spec.ts](src/routes/page.svelte.spec.ts)).
  - **server**: node tests for `src/**/*.{test,spec}.{js,ts}` excluding Svelte specs.
- If browser tests fail to launch locally, Playwright may need browsers/system deps (e.g. `npx playwright install` and on Linux `sudo npx playwright install-deps`).

## Linting/formatting conventions
- Formatting is enforced by Prettier (tabs, single quotes, width 100) and `prettier-plugin-svelte` + `prettier-plugin-tailwindcss` (see `.prettierrc`).
- ESLint uses the flat-config style ([eslint.config.js](eslint.config.js)) with `eslint-plugin-svelte` + `typescript-eslint`; don't add legacy `.eslintrc*` files.

## Types + path aliases
- TypeScript is strict and extends SvelteKit's generated config ([tsconfig.json](tsconfig.json) extends `./.svelte-kit/tsconfig.json`).
- Use SvelteKit's `$lib` alias for shared code/assets under `src/lib/` (see [src/lib/index.ts](src/lib/index.ts)).
- Shared types live in [src/lib/types.ts](src/lib/types.ts); DB operations in [src/lib/db.server.ts](src/lib/db.server.ts) duplicate some types (intentional for server isolation).
