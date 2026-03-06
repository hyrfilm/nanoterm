import { describe, expect, it } from 'vitest';
import { MelangeNashPlanner } from './melangeNashPlanner';

describe('MelangeNashPlanner', () => {
  it('falls back when runtime throws', () => {
    const runtime = {
      parse() {
        throw new Error('boom');
      },
    };

    const planner = new MelangeNashPlanner(runtime as any);
    const result = planner.parse('echo hello');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.steps).toHaveLength(1);
  });

  it('uses runtime result when valid', () => {
    const planner = new MelangeNashPlanner({
      parse: () => ({ ok: true, plan: { steps: [] } }),
    });

    const result = planner.parse('anything');
    expect(result).toEqual({ ok: true, plan: { steps: [] } });
  });
});

