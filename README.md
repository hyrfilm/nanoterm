# nanoterm

Tiny Unix terminal emulator running locally in the browser, built on `xterm.js` and designed as a library with a pluggable shell/filesystem, configurable commands and styling, custom commands, and tree-shakable command registration.  
Out of the box it includes `help`, `ls`, `cd`, `pwd`, `cat`, `echo`, `mkdir`, `rm`, `touch`, `clear`, `mv`, `cp`, `whoami`, `date`, `history`, `tree`, `head`, `tail`, `grep`, `wc`, `uname`, `wget`, `chmod`, `export`, `env`, and `nano`.

Default shell is `nash` (also pluggable): it currently supports variable expansion, `NAME=value` assignment, `&&`, and stdout redirects (`>`/`>>`), and currently does not implement pipes, `||`, subshells, globbing, or stdin/stderr redirects.  
The `nash` shell interpreter target is generated from an OCaml spec; see `nash/` (for example `nash/src/interpreter.ml:1`) and the runtime adapter in `src/lib/core/melangeNashPlanner.ts:1`.
