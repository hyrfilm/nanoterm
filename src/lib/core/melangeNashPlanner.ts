import type { NashParseResult, NashPlanner } from './nashPlan';
import { LegacyNashPlanner } from './shellLanguage';

export interface MelangeNashRuntime {
  parse(input: string): NashParseResult;
}

export class MelangeNashPlanner implements NashPlanner {
  private runtime: MelangeNashRuntime;
  private fallback: NashPlanner;

  constructor(runtime: MelangeNashRuntime, fallback: NashPlanner = new LegacyNashPlanner()) {
    this.runtime = runtime;
    this.fallback = fallback;
  }

  parse(input: string): NashParseResult {
    try {
      const result = this.runtime.parse(input);
      if (!result || typeof result !== 'object' || typeof (result as NashParseResult).ok !== 'boolean') {
        return this.fallback.parse(input);
      }
      return result;
    } catch {
      return this.fallback.parse(input);
    }
  }
}

type NashGlobal = typeof globalThis & {
  __NASH_PLANNER_RUNTIME__?: MelangeNashRuntime;
};

export function createDefaultNashPlanner(): NashPlanner {
  const runtime = (globalThis as NashGlobal).__NASH_PLANNER_RUNTIME__;
  if (runtime && typeof runtime.parse === 'function') {
    return new MelangeNashPlanner(runtime);
  }
  return new LegacyNashPlanner();
}

