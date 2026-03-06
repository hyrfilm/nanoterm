# nanoterm

## unix terminal emulator
### running locally in the browser
* built on [xterm.js](https://github.com/xtermjs/xterm.js/)
* use as a library from TS/JS
* pluggable shell (includes its own `nash` by default)
* bring your own filesystem, or use one of the provided:
* * in-memory - **default**
* * localStorage
* * a docker-style static file system at build-time (available for both options)
* custom commands, configurable styling, tree-shakable.

## commands
* comes pre-packaged with the following commands by default:
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
The default shell is `nash`. It supports variable expansion, `NAME=value` assignment, `&&`, and stdout redirects (`>`/`>>`). It does not yet implement pipes, `||`, subshells, globbing, or stdin/stderr redirects.
The js code for the shell interpreter is generated from an OCaml spec, included [here](https://github.com/hyrfilm/nanoterm/tree/main/nash) 
