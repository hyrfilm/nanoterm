# nash

`nash` is a basic shell interpreter built in OCaml and transpiled to js using [https://melange.re](melange)

## Implements:
- [x] environment lookup/set via `environment.ml`
- [x] variable expansion with `$NAME`
- [x] simple assignment (`NAME=value`)
- [x] command evaluation via a single hook (`run_command : string list -> unit`)
- [x] chaining commands `&&`
- [x] stdout redirects `>` / `>>`

## Not yet implemented
- [ ] pipes `||`
- [ ] subshells
- [ ] globbing
- [ ] stdin `<`
- [ ] stderr redirects. `2>`

## Structure

- `src/environment.ml` - environment
- `src/hooks.ml` - hooks
- `src/interpreter.ml` - lexer/parser, called via `run_line`
- `src/main.ml` - demo REPL executable

## Build and test

From repo root:

```bash
npm run nash:build
npm run nash:test
```

Or directly:

```bash
cd nash
dune build
dune runtest
```

## Notes

- Requires OCaml + dune toolchain installed locally.
- The parser does not aim for POSIX shell compatibility.

