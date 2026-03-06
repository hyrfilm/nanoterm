# nash

`nash` is a tiny OCaml shell core prototype.

It currently supports:

- environment lookup/set via `environment.ml`
- variable expansion with `$NAME`
- simple assignment (`NAME=value`)
- command evaluation via a single hook (`run_command : string list -> unit`)

## Structure

- `src/environment.ml` - env model and helpers
- `src/hooks.ml` - hook type(s)
- `src/interpreter.ml` - lexer/parser/evaluator + `run_line`
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
- The parser is intentionally minimal and does not aim for POSIX shell compatibility.

