# Repository Guidelines

## Project Structure & Module Organization

This repository is a WXT browser extension using SolidJS and TypeScript. It implements manual and optional automatic Discord message translation through OpenRouter; track outstanding live verification in the active OpenSpec change.

- `entrypoints/background.ts`: extension background logic.
- `entrypoints/content.ts`: Discord message discovery and inline translation UI.
- `entrypoints/popup/`: Solid components, HTML entry, and styles.
- `assets/`: bundled assets; `public/`: files copied into the extension.
- `wxt.config.ts`: WXT configuration; `openspec/`: specifications and change artifacts.
- `.agents/skills/`: project skills, with corresponding Claude Code entries.
- `.wxt/` and `.output/`: generated types and builds; do not edit manually.

## Build, Test, and Development Commands

Use Node.js 24+ and npm; `.nvmrc` selects Node 24.

- `npm ci`: install locked dependencies and generate WXT types.
- `npm run dev`: start Chrome development with HMR.
- `npm run dev:firefox`: start Firefox development.
- `npm run compile`: check TypeScript without emitting files.
- `npm run build` / `npm run build:firefox`: build browser-specific extensions.
- `npm run zip`: package the Chrome extension.
- `npm run test`: run Vitest/jsdom tests, including content-script integration.
- `npm run browser:*`: legacy agent-browser helpers; not the default verification workflow.

## Coding Style & Naming Conventions

Follow existing two-space indentation, single-quoted TypeScript strings, semicolons, and trailing commas. Use PascalCase for components (`App.tsx`) and camelCase for variables/functions. Preserve WXT entrypoint naming. Use Solid primitives such as `createSignal`, and `@/` for root-relative imports. No formatter or lint command is configured.

## Testing & Browser Automation

Use Vitest/jsdom for focused tests and run type checking plus the relevant browser build. Verify affected popup, background, and content-script behavior in the browser; local fixtures do not replace real Discord/OpenRouter verification.

Browser verification defaults to **ego lite**, controlled through `ego-browser`. Read `.agents/skills/ego-browser/SKILL.md` before using it. Do not launch agent-browser/Chrome for Testing or switch browser tools unless the user explicitly requests it.

Use one Ego TaskSpace per goal and resume its numeric ID across rounds. Observe with snapshots, act on current references, then verify the result; inspect the real extension popup as well as the settings tab. After rebuilding, reload the extension and Discord page before testing. Store screenshots and verification notes under ignored `.artifacts/`.

When the user takes control or a browser-owned prompt requires their action, hand off the same TaskSpace and wait. On successful completion call `task.finish({ keep: [] })`; retain only pages needed by the user. Do not close user-owned tabs or clear login state as cleanup.

## Commit & Pull Request Guidelines

Prefer focused imperative subjects, optionally using `feat:`, `fix:`, or `docs:`. PRs should explain behavior changes, link relevant issues/specifications, list validation commands/results, and include screenshots for UI changes.

## Agent & Configuration Instructions

Reply in Chinese by default. Expose errors; do not add silent fallbacks or simulated success. Keep browser credentials, cookies, and authentication state out of source control.
