# nanoterm
## unix terminal emulator
### in your browser
![ezgif-32cea9241ed81b54](https://github.com/user-attachments/assets/0e5f3ab4-9d00-4fb2-a698-5e947a6273a9)

* built on [xterm.js](https://github.com/xtermjs/xterm.js/)
* use as a library from TS/JS
* pluggable shell (provides [its own](#nash) by default.)
* bring your own filesystem, or use one of the provided:
* * in-memory - **default**
* * localStorage - for client-side persistence
* * apply a docker-style file system overlay at build-time (available for all filesystems)
* custom commands, configurable styling, tree-shakable.

## install

```bash
npm install nanoterm
```

```ts
import { createNanoTerm } from 'nanoterm';
createNanoTerm(document.getElementById('terminal')!);
```

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
