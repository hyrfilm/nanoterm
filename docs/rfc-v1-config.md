# NanoTerm V1 RFC: Config-First Library + Filesystem Overlay Pipeline

## Status

Draft (implementation-ready)

## Motivation

NanoTerm currently behaves like an app with defaults hardcoded in source.
For V1 as a reusable library, behavior should be configured from the outside:

- Select command set (for tree-shaking and product fit)
- Choose filesystem backend (memory/localStorage/custom)
- Configure startup/profile flow without hardcoding a banner
- Add a filesystem overlay at build time (`fromDir`, later `fromUrl`)

## Goals

- Ship NanoTerm as an embeddable library with sensible defaults
- Make startup behavior scriptable (`alias`, `motd`, etc.)
- Keep runtime lean; do overlay expansion at build time
- Enable deterministic overlays from local directories

## Non-goals (V1)

- POSIX shell compatibility
- Full plugin marketplace
- Runtime fetching/unpacking of remote overlays in browser

## Current shell positioning

The shell is currently a **bash-like interactive command REPL**, not a POSIX shell implementation.
It has line editing/history/completion and command dispatch, but no shell language features such as pipelines or job control.

## Proposed package shape

```text
@nanoterm/core
  - createNanoTerm()
  - Shell engine
  - command registry primitives
  - editor lifecycle interfaces
  - filesystem interfaces

@nanoterm/build
  - defineConfig()
  - overlay build helpers (fromDir; fromUrl later)
  - generated overlay assets
```

## Proposed config API

```ts
export interface NanoTermConfig {
  profile?: ProfileConfig;
  fs?: FsConfig;
  commands?: CommandSelection;
}

export interface ProfileConfig {
  banner?: string | false;
  startup?: string[];
  env?: Record<string, string>;
}

export interface FsConfig {
  backend?: 'memory' | 'localStorage' | 'custom';
  localStorageKey?: string;
  overlay?: OverlayConfig;
}

export type OverlayConfig =
  | { fromDir: string; outFile?: string; exclude?: string[] }
  | { fromUrl: string; integrity?: string; outFile?: string };

export type CommandSelection =
  | 'default'
  | string[];
```

## Runtime API (target)

```ts
createNanoTerm({
  container: '#terminal',
  config,
});
```

Where `container` can also be an `HTMLElement`.

## Command modularization contract

Replace side-effect registration files with explicit command modules:

- Each command exports a factory (or definition object)
- Consumer picks commands in config
- Bundler tree-shakes unused commands

Example:

```ts
commands: ['help', 'ls', 'cd', 'cat', 'nano']
```

## Filesystem backend contract

Common interface (implemented by memory, localStorage, and custom backends):

```ts
interface FileSystem {
  resolvePath(path: string): string;
  readFile(path: string): string | null;
  writeFile(path: string, content: string): { ok: true } | { ok: false; error: string };
  readDir(path: string): unknown[] | null;
  createDirectory(path: string, recursive?: boolean): { ok: true } | { ok: false; error: string };
  remove(path: string, recursive?: boolean): { ok: true } | { ok: false; error: string };
  move(src: string, dest: string): { ok: true } | { ok: false; error: string };
  copy(src: string, dest: string, recursive?: boolean): { ok: true } | { ok: false; error: string };
}
```

## Startup/profile behavior

Hardcoded startup text should become data-driven profile behavior.

Example startup script:

```sh
alias motd="cat /etc/motd"
motd
```

This keeps behavior composable and avoids hardcoding command-specific boot logic.

## Overlay format (build artifact)

The overlay JSON shape mirrors `dir2json.py`:

```json
{
  "json": { "path": { "to": { "file.json": { "k": "v" } } } },
  "text": { "path": { "to": { "file.txt": "..." } } },
  "binary": { "path": { "to": { "file.bin": "<base64>" } } }
}
```

Semantics:

- `json`: parsed JSON payload (only valid `.json` files)
- `text`: UTF-8 text files
- `binary`: base64 payload for non-text files

## Build pipeline (V1)

V1 scope: `fromDir` local directory expansion.

1. Walk directory recursively (glob)
2. For each file, classify into json/text/binary
3. Build nested tree keyed by relative path segments
4. Write generated overlay JSON to configured path

`fromUrl` can land in V1.1 with integrity validation + archive unpacking.

## Suggested milestone order

1. Add config model + defaults
2. Decouple command registration from side effects
3. Add `fromDir` build script and generated overlay output
4. Add profile startup execution
5. Add localStorage backend behind filesystem interface

## Risks and mitigations

- **Risk:** config/API churn while stabilizing
  - **Mitigation:** keep config small in V1; mark experimental keys
- **Risk:** text/binary misclassification edge cases
  - **Mitigation:** use strict UTF-8 decode with fallback to binary
- **Risk:** command modularization touches many files
  - **Mitigation:** phase migration while preserving backward-compatible defaults

