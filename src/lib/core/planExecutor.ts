import type { NashAssignment, NashPlan, NashSimpleCommand } from './nashPlan';

export interface CommandExecutor {
  executeCommand(command: NashSimpleCommand): Promise<number>;
  applyAssignment(assignment: NashAssignment): Promise<number> | number;
}

export async function executePlan(plan: NashPlan, executor: CommandExecutor): Promise<number> {
  let lastExitCode = 0;

  for (const step of plan.steps) {
    if (step.condition === 'and_then' && lastExitCode !== 0) {
      continue;
    }

    if (step.action.kind === 'assignment') {
      lastExitCode = await executor.applyAssignment(step.action.assignment);
    } else {
      lastExitCode = await executor.executeCommand(step.action.command);
    }
  }

  return lastExitCode;
}
