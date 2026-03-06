import { registry } from './commandRegistry';
import type { VirtualFS } from '../fs/filesystem';

export interface CompletionResult {
  completions: string[];
  replaceFrom: number;
  replaceTo: number;
}

export function getCompletions(input: string, cursorPos: number, fs: VirtualFS): CompletionResult {
  const beforeCursor = input.substring(0, cursorPos);
  const parts = beforeCursor.split(/\s+/);

  if (parts.length <= 1) {
    const partial = parts[0] || '';
    const matches = registry.getNames().filter(name => name.startsWith(partial));
    return { completions: matches, replaceFrom: 0, replaceTo: cursorPos };
  }

  const partial = parts[parts.length - 1];
  const matches = fs.getCompletions(partial);
  const replaceFrom = beforeCursor.length - partial.length;
  return { completions: matches, replaceFrom, replaceTo: cursorPos };
}

export function longestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix === '') return '';
    }
  }
  return prefix;
}
