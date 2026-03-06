import { describe, expect, it } from 'vitest';
import { LegacyNashPlanner } from './shellLanguage';

describe('LegacyNashPlanner', () => {
  const planner = new LegacyNashPlanner();

  it('parses a simple command into one command step', () => {
    const result = planner.parse('echo hello');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.steps).toHaveLength(1);
    expect(result.plan.steps[0].condition).toBe('always');
    expect(result.plan.steps[0].action.kind).toBe('command');
    if (result.plan.steps[0].action.kind !== 'command') return;

    expect(result.plan.steps[0].action.command.argvTemplates).toEqual(['echo', 'hello']);
    expect(result.plan.steps[0].action.command.redirects).toEqual([]);
  });

  it('parses assignment as an assignment step', () => {
    const result = planner.parse('FOO=bar');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.steps).toHaveLength(1);
    expect(result.plan.steps[0].action.kind).toBe('assignment');
    if (result.plan.steps[0].action.kind !== 'assignment') return;

    expect(result.plan.steps[0].action.assignment).toEqual({
      name: 'FOO',
      valueTemplate: 'bar',
    });
  });

  it('parses assignment + && + redirect command', () => {
    const result = planner.parse('FOO=bar && echo $FOO > out.txt');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.steps).toHaveLength(2);
    expect(result.plan.steps[0].condition).toBe('always');
    expect(result.plan.steps[0].action.kind).toBe('assignment');

    expect(result.plan.steps[1].condition).toBe('and_then');
    expect(result.plan.steps[1].action.kind).toBe('command');
    if (result.plan.steps[1].action.kind !== 'command') return;

    expect(result.plan.steps[1].action.command.argvTemplates).toEqual(['echo', '$FOO']);
    expect(result.plan.steps[1].action.command.redirects).toEqual([
      { fd: 'stdout', mode: 'truncate', targetTemplate: 'out.txt' },
    ]);
  });

  it('returns parse errors for malformed chaining and redirects', () => {
    const trailingAnd = planner.parse('echo hi &&');
    expect(trailingAnd.ok).toBe(false);

    const missingRedirectTarget = planner.parse('echo hi >');
    expect(missingRedirectTarget.ok).toBe(false);
  });
});

