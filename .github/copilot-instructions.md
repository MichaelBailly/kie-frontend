# Copilot instructions (kie-frontend)

## Stack + big picture
- SvelteKit app (Svelte 5 + TypeScript) built with Vite; server build uses `@sveltejs/adapter-node` (see `svelte.config.js`).
- App entry points live under `src/routes/` (SvelteKit file-based routing).
- Global layout is `src/routes/+layout.svelte`; it imports global styles from `src/routes/layout.css` and sets the favicon from `$lib/assets/`.

## Package manager + common workflows
- Use Bun for all scripts (see `package.json`). Prefer `bun run <script>`.
  - Dev: `bun run dev`
  - Build/preview: `bun run build`, `bun run preview`
  - Typecheck: `bun run check` (runs `svelte-kit sync` + `svelte-check`)
  - Format/lint: `bun run format`, `bun run lint`
  - Tests: `bun run test` (CI-style `--run`), `bun run test:unit`

## Svelte 5 conventions (important)
- This repo uses Svelte 5 props/children patterns: `let { children } = $props();` and renders via `{@render children()}` (see `src/routes/+layout.svelte`).
- When editing layouts/components, keep Svelte 5 style (avoid introducing Svelte 4-style `<slot />` patterns).

## Styling (Tailwind CSS v4)
- Tailwind is wired via `@tailwindcss/vite` (see `vite.config.ts`) and CSS-first config in `src/routes/layout.css`:
  - `@import 'tailwindcss';`
  - `@plugin '@tailwindcss/forms';`, `@plugin '@tailwindcss/typography';`
- Prettier’s Tailwind plugin is configured to read the stylesheet at `./src/routes/layout.css` (see `.prettierrc`). Avoid moving these directives without updating `.prettierrc`.

## Testing (Vitest split: browser + node)
- Vitest is configured with 2 projects in `vite.config.ts`:
  - **client**: browser tests for `src/**/*.svelte.{test,spec}.{js,ts}` using Playwright + `vitest-browser-svelte` (example: `src/routes/page.svelte.spec.ts`).
  - **server**: node tests for `src/**/*.{test,spec}.{js,ts}` excluding Svelte specs.
- If browser tests fail to launch locally, Playwright may need browsers/system deps (e.g. `npx playwright install` and on Linux `sudo npx playwright install-deps`).

## Linting/formatting conventions
- Formatting is enforced by Prettier (tabs, single quotes, width 100) and `prettier-plugin-svelte` + `prettier-plugin-tailwindcss` (see `.prettierrc`).
- ESLint uses the flat-config style (`eslint.config.js`) with `eslint-plugin-svelte` + `typescript-eslint`; don’t add legacy `.eslintrc*` files.

## Types + path aliases
- TypeScript is strict and extends SvelteKit’s generated config (`tsconfig.json` extends `./.svelte-kit/tsconfig.json`).
- Use SvelteKit’s `$lib` alias for shared code/assets under `src/lib/` (see `src/lib/index.ts`).
