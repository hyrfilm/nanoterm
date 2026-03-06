import type {
  NashAssignment,
  NashParseResult,
  NashPlan,
  NashPlanner,
  NashSimpleCommand,
  RedirectSpec,
} from './nashPlan';

type Token = string;

const TOKEN_AND_THEN = '&&';
const TOKEN_REDIRECT_TRUNCATE = '>';
const TOKEN_REDIRECT_APPEND = '>>';

function isOperatorToken(token: Token): boolean {
  return token === TOKEN_AND_THEN || token === TOKEN_REDIRECT_TRUNCATE || token === TOKEN_REDIRECT_APPEND;
}

function tokenize(input: string): { ok: true; tokens: Token[] } | { ok: false; error: string } {
  const tokens: Token[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  const flushCurrent = () => {
    if (current.length > 0) {
      tokens.push(current);
      current = '';
    }
  };

  for (let index = 0; index < input.length; index += 1) {
    const ch = input[index];
    const next = index + 1 < input.length ? input[index + 1] : '';

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && !inSingleQuote) {
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '&' && next === '&') {
        flushCurrent();
        tokens.push(TOKEN_AND_THEN);
        index += 1;
        continue;
      }

      if (ch === '>') {
        flushCurrent();
        if (next === '>') {
          tokens.push(TOKEN_REDIRECT_APPEND);
          index += 1;
        } else {
          tokens.push(TOKEN_REDIRECT_TRUNCATE);
        }
        continue;
      }

      if (ch === ' ' || ch === '\t' || ch === '\n') {
        flushCurrent();
        continue;
      }
    }

    current += ch;
  }

  if (escaped) {
    return { ok: false, error: 'dangling escape at end of input' };
  }

  if (inSingleQuote || inDoubleQuote) {
    return { ok: false, error: 'unterminated quote' };
  }

  flushCurrent();
  return { ok: true, tokens };
}

function parseAssignment(tokens: Token[]): { ok: true; assignment: NashAssignment } | { ok: false; error: string } {
  if (tokens.length !== 1) {
    return { ok: false, error: 'not an assignment' };
  }

  const token = tokens[0];
  const eqIndex = token.indexOf('=');
  if (eqIndex <= 0 || eqIndex === token.length - 1) {
    return { ok: false, error: 'not an assignment' };
  }

  const name = token.slice(0, eqIndex);
  const valueTemplate = token.slice(eqIndex + 1);

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return { ok: false, error: `invalid assignment name: ${name}` };
  }

  return {
    ok: true,
    assignment: {
      name,
      valueTemplate,
    },
  };
}

function parseCommand(tokens: Token[]): { ok: true; command: NashSimpleCommand } | { ok: false; error: string } {
  const redirects: RedirectSpec[] = [];
  const argvTemplates: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === TOKEN_REDIRECT_TRUNCATE || token === TOKEN_REDIRECT_APPEND) {
      const target = tokens[index + 1];
      if (!target) {
        return { ok: false, error: 'redirect missing target path' };
      }
      if (isOperatorToken(target)) {
        return { ok: false, error: `invalid redirect target: ${target}` };
      }

      redirects.push({
        fd: 'stdout',
        mode: token === TOKEN_REDIRECT_APPEND ? 'append' : 'truncate',
        targetTemplate: target,
      });
      index += 1;
      continue;
    }

    argvTemplates.push(token);
  }

  if (argvTemplates.length === 0) {
    return { ok: false, error: 'expected command before redirect/operator' };
  }

  const command: NashSimpleCommand = {
    argvTemplates,
    redirects,
  };

  return { ok: true, command };
}

export class LegacyNashPlanner implements NashPlanner {
  parse(input: string): NashParseResult {
    const trimmed = input.trim();
    if (!trimmed) {
      return { ok: true, plan: { steps: [] } };
    }

    const tokenized = tokenize(trimmed);
    if (!tokenized.ok) {
      return { ok: false, error: tokenized.error };
    }

    const tokens = tokenized.tokens;
    const steps: NashPlan['steps'] = [];
    let currentTokens: Token[] = [];

    const flushStatement = (condition: 'always' | 'and_then'): NashParseResult | null => {
      const maybeAssignment = parseAssignment(currentTokens);
      if (maybeAssignment.ok) {
        steps.push({
          condition,
          action: { kind: 'assignment', assignment: maybeAssignment.assignment },
        });
        currentTokens = [];
        return null;
      }

      const parsedCommand = parseCommand(currentTokens);
      if (!parsedCommand.ok) {
        return { ok: false, error: parsedCommand.error };
      }

      steps.push({
        condition,
        action: { kind: 'command', command: parsedCommand.command },
      });
      currentTokens = [];
      return null;
    };

    let nextCondition: 'always' | 'and_then' = 'always';

    for (const token of tokens) {
      if (token === TOKEN_AND_THEN) {
        if (currentTokens.length === 0) {
          return { ok: false, error: 'unexpected && with no command before it' };
        }

        const flushResult = flushStatement(nextCondition);
        if (flushResult) {
          return flushResult;
        }

        nextCondition = 'and_then';
      } else {
        currentTokens.push(token);
      }
    }

    if (currentTokens.length === 0) {
      if (steps.length > 0) {
        return { ok: false, error: 'unexpected end of input after &&' };
      }
      return { ok: true, plan: { steps: [] } };
    }

    const flushResult = flushStatement(nextCondition);
    if (flushResult) {
      return flushResult;
    }

    return { ok: true, plan: { steps } };
  }
}
