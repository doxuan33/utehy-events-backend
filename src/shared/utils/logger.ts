const LEVELS = {
  INFO: 'INFO',
  ERROR: 'ERROR',
  WARN: 'WARN',
  SUCCESS: 'SUCCESS',
} as const;

function timestamp(): string {
  return new Date().toISOString();
}

function format(level: string, message: string, meta?: any): string {
  const time = timestamp();
  let output = `[${time}] [${level}] ${message}`;
  if (meta !== undefined) {
    output += ' ' + JSON.stringify(meta);
  }
  return output;
}

export const logger = {
  info(message: string, meta?: any) {
    console.log(format(LEVELS.INFO, message, meta));
  },

  error(message: string, meta?: any) {
    console.error(format(LEVELS.ERROR, message, meta));
  },

  warn(message: string, meta?: any) {
    console.warn(format(LEVELS.WARN, message, meta));
  },

  success(message: string, meta?: any) {
    console.log(format(LEVELS.SUCCESS, message, meta));
  },
};
