import type { RedirectSpec } from '../core/nashPlan';

export interface Recording {
  commands: string[][];
  redirects?: RedirectSpec[][];
  ts: number[];
}

export const MAX_COMMANDS = 20;

let state: Recording | null = null;
let startMs = 0;

export function startRecording(): void {
  state = { commands: [], redirects: [], ts: [] };
  startMs = Date.now();
}

export function stopRecording(): Recording | null {
  const r = state;
  state = null;
  return r;
}

export function isRecording(): boolean {
  return state !== null;
}

export function recordCommand(argv: string[], redirects: RedirectSpec[]): void {
  if (!state || state.commands.length >= MAX_COMMANDS) return;
  if (argv[0] === 'record' || argv[0] === 'replay') return;
  state.commands.push([...argv]);
  state.redirects!.push([...redirects]);
  state.ts.push(Date.now() - startMs);
}

export function encodeRecording(r: Recording): string {
  return btoa(JSON.stringify(r));
}

export function decodeRecording(encoded: string): Recording {
  return JSON.parse(atob(encoded)) as Recording;
}
