# Svelte + TS + Vite

## Overlay build pipeline (`fromDir`)

This repository now includes a build-time filesystem overlay generator:

- Script: `scripts/build-overlay.mjs`
- NPM command: `npm run overlay:build`
- Default input directory: `./overlay`
- Default output file: `./src/generated/fs-overlay.json`

You can also run it directly with custom flags:

```bash
node scripts/build-overlay.mjs --fromDir ./my-overlay --out ./src/generated/fs-overlay.json --exclude "**/*.tmp"
```

The generated JSON format mirrors `dir2json.py` and emits:

- `json`: valid parsed `.json` files
- `text`: UTF-8 text files
- `binary`: base64-encoded binary files

See `docs/rfc-v1-config.md` for the V1 config-first library plan.

## Typed runtime config (`src/nanoterm.config.ts`)

Runtime boot now reads `src/nanoterm.config.ts` and applies defaults via `resolveNanoTermConfig(...)`.

Current configurable keys:

- `profile.showBanner`
- `profile.env`
- `fs.backend` (`memory` or `localStorage`)
- `fs.localStorageKey`
- `fs.useGeneratedOverlay`
- `fs.overlay` (explicit overlay object)

By default, generated overlay content from `src/generated/fs-overlay.json` is applied at shell startup.

## Nash-style execution contract (TS side)

Shell execution now uses a planner/executor split:

- `src/lib/core/nashPlan.ts` - plan and redirect types (`NashPlan`, `RedirectSpec`)
- `src/lib/core/shellLanguage.ts` - planner (`LegacyNashPlanner`) that parses input into a plan
- `src/lib/core/planExecutor.ts` - executor flow for chaining semantics (`&&`)
- `src/lib/core/melangeNashPlanner.ts` - Melange runtime adapter with fallback

Current planner behavior includes:

- assignment planning (`NAME=value`)
- `>` and `>>` stdout redirect planning
- `&&` command chaining (run next only on success)

Variable expansion is intentionally deferred to runtime execution so changes from previous steps are visible.
Redirect effects are applied in runtime command execution (not in planner) via `Shell.executeCommand(...)`.

To plug a Melange parser/evaluator at runtime, register a global adapter before shell boot:

```ts
globalThis.__NASH_PLANNER_RUNTIME__ = {
  parse: (input) => ({ ok: true, plan: { steps: [] } })
}
```

If no runtime is provided, NanoTerm defaults to the built-in planner fallback.

## Nash (OCaml prototype)

The repository also contains `nash/`, a small OCaml shell core prototype.

- Build: `npm run nash:build`
- Test: `npm run nash:test`

Requires local OCaml + dune tooling.

This template should help get you started developing with Svelte and TypeScript in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode).

## Need an official Svelte framework?

Check out [SvelteKit](https://github.com/sveltejs/kit#readme), which is also powered by Vite. Deploy anywhere with its serverless-first approach and adapt to various platforms, with out of the box support for TypeScript, SCSS, and Less, and easily-added support for mdsvex, GraphQL, PostCSS, Tailwind CSS, and more.

## Technical considerations

**Why use this over SvelteKit?**

- It brings its own routing solution which might not be preferable for some users.
- It is first and foremost a framework that just happens to use Vite under the hood, not a Vite app.

This template contains as little as possible to get started with Vite + TypeScript + Svelte, while taking into account the developer experience with regards to HMR and intellisense. It demonstrates capabilities on par with the other `create-vite` templates and is a good starting point for beginners dipping their toes into a Vite + Svelte project.

Should you later need the extended capabilities and extensibility provided by SvelteKit, the template has been structured similarly to SvelteKit so that it is easy to migrate.

**Why `global.d.ts` instead of `compilerOptions.types` inside `jsconfig.json` or `tsconfig.json`?**

Setting `compilerOptions.types` shuts out all other types not explicitly listed in the configuration. Using triple-slash references keeps the default TypeScript setting of accepting type information from the entire workspace, while also adding `svelte` and `vite/client` type information.

**Why include `.vscode/extensions.json`?**

Other templates indirectly recommend extensions via the README, but this file allows VS Code to prompt the user to install the recommended extension upon opening the project.

**Why enable `allowJs` in the TS template?**

While `allowJs: false` would indeed prevent the use of `.js` files in the project, it does not prevent the use of JavaScript syntax in `.svelte` files. In addition, it would force `checkJs: false`, bringing the worst of both worlds: not being able to guarantee the entire codebase is TypeScript, and also having worse typechecking for the existing JavaScript. In addition, there are valid use cases in which a mixed codebase may be relevant.

**Why is HMR not preserving my local component state?**

HMR state preservation comes with a number of gotchas! It has been disabled by default in both `svelte-hmr` and `@sveltejs/vite-plugin-svelte` due to its often surprising behavior. You can read the details [here](https://github.com/rixo/svelte-hmr#svelte-hmr).

If you have state that's important to retain within a component, consider creating an external store which would not be replaced by HMR.

```ts
// store.ts
// An extremely simple external store
import { writable } from 'svelte/store'
export default writable(0)
```
