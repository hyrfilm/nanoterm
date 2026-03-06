export type NashStepCondition = 'always' | 'and_then';

export type RedirectFd = 'stdout';
export type RedirectMode = 'truncate' | 'append';

export interface RedirectSpec {
  fd: RedirectFd;
  mode: RedirectMode;
  targetTemplate: string;
}

export interface NashSimpleCommand {
  argvTemplates: string[];
  redirects: RedirectSpec[];
}

export interface NashAssignment {
  name: string;
  valueTemplate: string;
}

export type NashStepAction =
  | { kind: 'assignment'; assignment: NashAssignment }
  | { kind: 'command'; command: NashSimpleCommand };

export interface NashPlanStep {
  condition: NashStepCondition;
  action: NashStepAction;
}

export interface NashPlan {
  steps: NashPlanStep[];
}

export type NashParseResult =
  | { ok: true; plan: NashPlan }
  | { ok: false; error: string };

export interface NashPlanner {
  parse(input: string): NashParseResult;
}
