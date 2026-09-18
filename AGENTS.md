# Repository Guidelines

## Project Structure & Module Organization

This repository is a WXT browser extension using SolidJS and TypeScript. It currently contains starter UI, not Discord translation functionality.

- `entrypoints/background.ts`: extension background logic.
- `entrypoints/content.ts`: content script, currently matching Google pages.
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
- `npm run browser:install`: download Chrome for Testing once.
- `npm run browser:open`: build and load the extension through agent-browser.

## Coding Style & Naming Conventions

Follow existing two-space indentation, single-quoted TypeScript strings, semicolons, and trailing commas. Use PascalCase for components (`App.tsx`) and camelCase for variables/functions. Preserve WXT entrypoint naming. Use Solid primitives such as `createSignal`, and `@/` for root-relative imports. No formatter or lint command is configured.

## Testing & Browser Automation

No automated test framework, test naming convention, or coverage threshold is established. Run type checking and the relevant browser build, then verify affected popup, background, or content-script behavior.

Read `.agents/skills/agent-browser/SKILL.md`, then run `npm run browser -- skills get core`. Use `npm run browser -- snapshot -i`, interact with current references, and snapshot again after changes. Follow README instructions to open the real extension popup. Store screenshots under ignored `.artifacts/`; close the project session with `npm run browser -- close` before rebuilding or finishing.

## Commit & Pull Request Guidelines

This checkout has no Git metadata, so existing commit conventions cannot be verified. Prefer focused imperative subjects, optionally using `feat:`, `fix:`, or `docs:`. PRs should explain behavior changes, link relevant issues/specifications, list validation commands/results, and include screenshots for UI changes.

## Agent & Configuration Instructions

Reply in Chinese by default. Expose errors; do not add silent fallbacks or simulated success. Keep browser credentials, cookies, and authentication state out of source control.
