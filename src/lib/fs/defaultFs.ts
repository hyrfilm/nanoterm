import { makeFile, makeDir, type DirNode, type FSNode } from './types';

function m(entries: [string, FSNode][]): Map<string, FSNode> {
  return new Map(entries);
}

export function createDefaultFS(): DirNode {
  const readme = `# Welcome to NanoTerm

NanoTerm is a browser-based terminal emulator running entirely in your browser.
No server, no backend - just a virtual filesystem and shell commands.

## Quick Start

  ls              List files in the current directory
  cd <dir>        Change directory
  cat <file>      View file contents
  nano <file>     Edit a file
  help            Show all available commands

## Tips

- Use Tab for auto-completion
- Use Up/Down arrows to browse command history
- Ctrl+C to cancel the current line
- Ctrl+L to clear the screen

Visit https://github.com/jonasholmer/nanoterm for more info.
`;

  const notes = `Shopping list:
- Milk
- Eggs
- Bread
- Coffee

TODO:
- [x] Set up nanoterm
- [ ] Write some code
- [ ] Take a break
`;

  const helloPy = `#!/usr/bin/env python3

def greet(name):
    print(f"Hello, {name}!")

if __name__ == "__main__":
    greet("World")
`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Page</title>
</head>
<body>
  <h1>Hello from NanoTerm!</h1>
  <p>This file was created in a virtual filesystem.</p>
</body>
</html>
`;

  const motd = `
  ┌─────────────────────────────────────────┐
  │  Welcome to NanoTerm v1.0               │
  │  A browser-based terminal emulator      │
  │                                         │
  │  Type 'help' for available commands     │
  │  Type 'cat ~/documents/readme.md'       │
  │  for more information                   │
  └─────────────────────────────────────────┘
`;

  const manual = `NANOTERM(1)                  User Commands                  NANOTERM(1)

NAME
    nanoterm - a browser-based terminal emulator

DESCRIPTION
    NanoTerm provides a simulated Unix-like terminal environment
    running entirely in the browser. It features a virtual in-memory
    filesystem, common shell commands, and a built-in text editor.

COMMANDS
    Type 'help' at the prompt for a complete list of commands.

EDITOR
    NanoTerm includes a nano-like text editor. Launch it with:
        nano <filename>

    Editor shortcuts:
        Ctrl+O    Save file
        Ctrl+X    Exit editor
        Ctrl+K    Cut current line
        Ctrl+U    Paste cut line(s)
        Ctrl+W    Search
        Ctrl+C    Show cursor position

ENVIRONMENT
    The following environment variables are set by default:
        USER, HOME, SHELL, PATH, PWD, TERM, HOSTNAME

FILES
    /home/guest     User home directory
    /etc            System configuration
    /tmp            Temporary files
    /var/log        Log files

AUTHOR
    NanoTerm - https://github.com/jonasholmer/nanoterm
`;

  const root = makeDir('', m([
    ['home', makeDir('home', m([
      ['guest', makeDir('guest', m([
        ['.bashrc', makeFile('.bashrc', '# nanoterm shell config\nexport PS1="\\u@nanoterm:\\w$ "\n')],
        ['documents', makeDir('documents', m([
          ['readme.md', makeFile('readme.md', readme)],
          ['notes.txt', makeFile('notes.txt', notes)],
        ]))],
        ['projects', makeDir('projects', m([
          ['hello.py', makeFile('hello.py', helloPy)],
          ['index.html', makeFile('index.html', indexHtml)],
        ]))],
      ]))],
    ]))],
    ['etc', makeDir('etc', m([
      ['hostname', makeFile('hostname', 'nanoterm\n', 'root', 'root')],
      ['os-release', makeFile('os-release', 'NAME="NanoTerm OS"\nVERSION="1.0"\nID=nanoterm\n', 'root', 'root')],
      ['passwd', makeFile('passwd', 'root:x:0:0:root:/root:/bin/bash\nguest:x:1000:1000:Guest User:/home/guest:/bin/bash\n', 'root', 'root')],
      ['motd', makeFile('motd', motd, 'root', 'root')],
    ]), 'root', 'root')],
    ['tmp', makeDir('tmp')],
    ['var', makeDir('var', m([
      ['log', makeDir('log', m([
        ['syslog', makeFile('syslog', 'System initialized.\nAll services started.\n', 'root', 'root')],
      ]), 'root', 'root')],
    ]), 'root', 'root')],
    ['usr', makeDir('usr', m([
      ['bin', makeDir('bin', new Map(), 'root', 'root')],
      ['share', makeDir('share', m([
        ['doc', makeDir('doc', m([
          ['nanoterm', makeDir('nanoterm', m([
            ['manual.txt', makeFile('manual.txt', manual, 'root', 'root')],
          ]), 'root', 'root')],
        ]), 'root', 'root')],
      ]), 'root', 'root')],
    ]), 'root', 'root')],
  ]), 'root', 'root');

  return root;
}
