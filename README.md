# nanoterm
## unix terminal emulator
### in your browser
[![ezgif-32cea9241ed81b54](https://github.com/user-attachments/assets/0e5f3ab4-9d00-4fb2-a698-5e947a6273a9)](https://hyrfilm.github.io/nanoterm/)

* built on [xterm.js](https://github.com/xtermjs/xterm.js/)
* use as a library from TS/JS
* pluggable shell (provides [its own](#nash) by default.)
* bring your own filesystem, or use one of the provided:
* * in-memory - **default**
* * localStorage - for client-side persistence
* * apply a file system overlay at build-time or runtime (available for all filesystems)
* custom commands, configurable styling, tree-shakable.

## install

```bash
npm install nanoterm
```

```ts
import { createNanoTerm } from 'nanoterm';
createNanoTerm(document.getElementById('terminal')!);
```

```ts
import { applyFSOverlay, forEachOverlayFile, parseOverlayJson } from 'nanoterm';

const overlay = parseOverlayJson(rawOverlayJson);
applyFSOverlay(myFilesystem, overlay);

forEachOverlayFile(overlay, (path, content) => {
  console.log(path, content);
});
```

The recursive walk is public, so another repo does not need to reimplement overlay traversal just to materialize files differently.

Overlay JSON follows the filesystem shape directly:

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

Strings are text files by default. Plain objects are directories unless `_.types` marks that path as `json` or `base64`.

## commands
* comes pre-packaged with the following commands:
```bash
cat
cd
chmod
clear
cp
date
echo
env
export
grep
head
help
history
ls
mkdir
motd
mv
nano
pwd
rm
tail
touch
tree
uname
wget
whoami
wc
```

## nash
The default shell is `nash`. Not intended to provide POSIX shell compatibility. It supports variable expansion, `NAME=value` assignment, `&&`, and stdout redirects (`>`/`>>`). It does not yet implement pipes, `||`, subshells, globbing, or stdin/stderr redirects.
The js code for the shell interpreter is generated from an OCaml spec, included [here](https://github.com/hyrfilm/nanoterm/tree/main/nash) 
