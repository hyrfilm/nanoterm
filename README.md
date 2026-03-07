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

## sharing snapshots
* the local state of the emulator can be stored as snapshots, shared and played back.
Who hasn't asked a Magic 8ball about something regarding their future? Well, finally you can [turn that answer into ascii-art](https://hyrfilm.github.io/nanoterm?replay=eyJjb21tYW5kcyI6W1siaGVscCJdLFsibHMiXSxbInRyZWUiXSxbIndob2FtaSJdLFsiY3VybCIsImh0dHBzOi8vdGNwZGF0YS5jb20vOGJhbGwiXSxbImNhdCIsImZvcnR1bmUuanNvbiJdLFsianEiLCItciIsImFuc3dlciIsImZvcnR1bmUuanNvbiJdLFsicmVhZHZhciIsIkFOU1dFUiIsImFuc3dlci50eHQiXSxbImVjaG8iLCJDYW5ub3QgcHJlZGljdCBub3ciXSxbImN1cmwiLCJodHRwczovL3RjcGRhdGEuY29tL2FzY2lpL0Nhbm5vdCBwcmVkaWN0IG5vdyJdLFsiY2F0IiwiZm9ydHVuZS5hc2NpaSJdLFsiY2xlYXIiXSxbImpxIiwiLXIiLCJhc2NpaSIsImZvcnR1bmUuYXNjaWkiXV0sInJlZGlyZWN0cyI6W1tdLFtdLFtdLFtdLFt7ImZkIjoic3Rkb3V0IiwibW9kZSI6InRydW5jYXRlIiwidGFyZ2V0VGVtcGxhdGUiOiJmb3J0dW5lLmpzb24ifV0sW10sW3siZmQiOiJzdGRvdXQiLCJtb2RlIjoidHJ1bmNhdGUiLCJ0YXJnZXRUZW1wbGF0ZSI6ImFuc3dlci50eHQifV0sW10sW10sW3siZmQiOiJzdGRvdXQiLCJtb2RlIjoidHJ1bmNhdGUiLCJ0YXJnZXRUZW1wbGF0ZSI6ImZvcnR1bmUuYXNjaWkifV0sW10sW10sW11dLCJ0cyI6WzI4MDcsODEyNiwxMDMwNCwxNDYwMiwyNjMyMSwyOTk4MSwzOTQ0Nyw0MzY5Niw0ODI0OSw1NjE2OSw2NzM4Miw3ODM5Myw4MDY2M119) 
* Use the `help` with the `record` & `replay` command for more info on how this is done.

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
