export const ESC = '\x1b';
export const CSI = '\x1b[';

export const cursorTo = (row: number, col: number) => `${CSI}${row};${col}H`;
export const cursorUp = (n = 1) => `${CSI}${n}A`;
export const cursorDown = (n = 1) => `${CSI}${n}B`;
export const cursorForward = (n = 1) => `${CSI}${n}C`;
export const cursorBack = (n = 1) => `${CSI}${n}D`;
export const cursorShow = `${CSI}?25h`;
export const cursorHide = `${CSI}?25l`;

export const eraseScreen = `${CSI}2J`;
export const eraseLine = `${CSI}2K`;
export const eraseToEndOfLine = `${CSI}K`;
export const eraseToEndOfScreen = `${CSI}J`;

export const reset = `${CSI}0m`;
export const bold = `${CSI}1m`;
export const dim = `${CSI}2m`;
export const italic = `${CSI}3m`;
export const underline = `${CSI}4m`;
export const inverse = `${CSI}7m`;

export const fg = {
  black: `${CSI}30m`,
  red: `${CSI}31m`,
  green: `${CSI}32m`,
  yellow: `${CSI}33m`,
  blue: `${CSI}34m`,
  magenta: `${CSI}35m`,
  cyan: `${CSI}36m`,
  white: `${CSI}37m`,
  brightBlack: `${CSI}90m`,
  brightRed: `${CSI}91m`,
  brightGreen: `${CSI}92m`,
  brightYellow: `${CSI}93m`,
  brightBlue: `${CSI}94m`,
  brightMagenta: `${CSI}95m`,
  brightCyan: `${CSI}96m`,
  brightWhite: `${CSI}97m`,
};

export const bg = {
  black: `${CSI}40m`,
  red: `${CSI}41m`,
  green: `${CSI}42m`,
  yellow: `${CSI}43m`,
  blue: `${CSI}44m`,
  magenta: `${CSI}45m`,
  cyan: `${CSI}46m`,
  white: `${CSI}47m`,
};

export const altScreenEnable = `${CSI}?1049h`;
export const altScreenDisable = `${CSI}?1049l`;
