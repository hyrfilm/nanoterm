# nanoterm
### tiny unix in the browser

[![ezgif-32cea9241ed81b54](https://github.com/user-attachments/assets/0e5f3ab4-9d00-4fb2-a698-5e947a6273a9)](https://hyrfilm.github.io/nanoterm/)

* built on [xterm.js](https://github.com/xtermjs/xterm.js/)
* use as a library from TS/JS
* pluggable shell (uses [nash](#nash) by default)
* built-in virtual filesystem plus overlays
* custom commands, configurable styling, tree-shakable

```bash
npm install nanoterm
```

```ts
import { createNanoTerm } from 'nanoterm';

createNanoTerm(document.getElementById('terminal')!);
```

By default this uses the built-in in-memory filesystem. This can be changed to instead use localStorage for client-side persistence.

Styling:

```ts
import { createNanoTerm } from 'nanoterm';

createNanoTerm(document.getElementById('terminal')!, {
  terminal: {
    fontSize: 16,
    cursorBlink: false,
    theme: {
      background: '#101418',
      foreground: '#e6edf3',
      green: '#7ee787',
    },
  },
});
```

Commands:

```ts
import { createNanoTerm, registry } from 'nanoterm';

registry.register({
  name: 'rev',
  description: 'reverse a string',
  usage: 'rev <text>',
  handler: (ctx) => (ctx.writeStdout(`${ctx.args.join(' ').split('').reverse().join('')}\r\n`), { exitCode: 0 }),
});

createNanoTerm(document.getElementById('terminal')!);
```

```bash
rev nanoterm
mretonan
```

Filesystem:

Nanoterm boots a virtual Unix-like filesystem. If you want to add a few files, think overlay. If you want a completely different machine, point the overlay builder at another directory and use that as the bundle.

Appending a few files:

```json
{
  "/": {
    "home": {
      "guest": {
        "notes.txt": "hello"
      }
    }
  }
}
```

Building an overlay from a directory:

```bash
node scripts/build-overlay.mjs --fromDir ./overlay --out ./src/generated/fs-overlay.json
```

Docker's overlay model is a reasonable mental model here, especially if you just want to append or replace paths.

Overlay format:

```json
{
  "/": {
    "etc": {
      "message.txt": "hello",
      "config.json": { "theme": "dark" },
      "logo.bin": "YWJj"
    }
  },
  "_": {
    "types": {
      "/": {
        "etc": {
          "config.json": "json",
          "logo.bin": "base64"
        }
      }
    },
    "ops": [
      { "-": "examples/" },
      { "+": "examples/basic" }
    ]
  }
}
```

* by default `~/.nashrc` is run at startup.
* `"/"` is the filesystem root
* strings are text files by default
* plain objects are directories by default
* `_.types` is only for exceptions such as `json` and `base64`
* `_.ops` filters which parts of the overlay should be visible

Overlays can also be applied at runtime:

```ts
import { applyFSOverlay, parseOverlayJson } from 'nanoterm';

const overlay = parseOverlayJson(rawOverlayJson);
applyFSOverlay(myFilesystem, overlay);
```

The built-in `snapshot` command prints a link that uses this same `?overlay=...` mechanism.

If you want the walked files instead:

```ts
import { forEachOverlayFile, parseOverlayJson } from 'nanoterm';

const overlay = parseOverlayJson(rawOverlayJson);

forEachOverlayFile(overlay, (path, content) => {
  console.log(path, content);
});
```

Built-in commands:

```bash
ascii
cat
cd
chmod
clear
cp
curl
date
echo
emoji
env
export
grep
head
help
history
infomsg
jq
ls
mkdir
motd
mv
nano
pwd
readvar
rm
snapshot
sleep
tail
touch
tree
uname
wget
whoami
wc
```

## nash

The default shell is `nash`. It supports variable expansion, `NAME=value` assignment, `&&`, and stdout redirects (`>` / `>>`). It does not currently support pipes, `||`, subshells, globbing, or stdin/stderr redirects.

The JS code for the shell interpreter is generated from the OCaml spec in [nash](https://github.com/hyrfilm/nanoterm/tree/main/nash).
