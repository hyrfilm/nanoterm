import { describe, expect, it } from 'vitest';
import { executePlan, type CommandExecutor } from './planExecutor';
import type { NashPlan } from './nashPlan';

describe('executePlan', () => {
  it('runs and_then commands only when previous step succeeds', async () => {
    const events: string[] = [];

    const executor: CommandExecutor = {
      async applyAssignment(assignment) {
        events.push(`assign:${assignment.name}=${assignment.valueTemplate}`);
        return 0;
      },
      async executeCommand(command) {
        const head = command.argvTemplates[0] || '';
        events.push(`cmd:${head}`);
        if (head === 'fail') return 1;
        return 0;
      },
    };

    const plan: NashPlan = {
      steps: [
        {
          condition: 'always',
          action: { kind: 'assignment', assignment: { name: 'FOO', valueTemplate: 'bar' } },
        },
        {
          condition: 'and_then',
          action: { kind: 'command', command: { argvTemplates: ['ok'], redirects: [] } },
        },
        {
          condition: 'and_then',
          action: { kind: 'command', command: { argvTemplates: ['fail'], redirects: [] } },
        },
        {
          condition: 'and_then',
          action: { kind: 'command', command: { argvTemplates: ['skipped'], redirects: [] } },
        },
        {
          condition: 'always',
          action: { kind: 'command', command: { argvTemplates: ['always-runs'], redirects: [] } },
        },
      ],
    };

    const exitCode = await executePlan(plan, executor);

    expect(exitCode).toBe(0);
    expect(events).toEqual([
      'assign:FOO=bar',
      'cmd:ok',
      'cmd:fail',
      'cmd:always-runs',
    ]);
  });
});

