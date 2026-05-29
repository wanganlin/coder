/**
 * 分级日志系统
 *
 * LogLevel: error | warn | info | debug
 * 默认 info，通过环境变量 CODER_LOG_LEVEL 控制
 */

export enum LogLevel {
  error = 0,
  warn = 1,
  info = 2,
  debug = 3,
}

function getLevel(name: string, fallback: LogLevel): LogLevel {
  const value = process.env[name];
  if (!value) return fallback;
  const key = value.toLowerCase();
  if (key in LogLevel) return LogLevel[key as keyof typeof LogLevel];
  return fallback;
}

const currentLevel = getLevel('CODER_LOG_LEVEL', LogLevel.info);

function format(level: string, message: string): string {
  return `[${level}] ${message}`;
}

export const logger = {
  error(message: string): void {
    if (currentLevel >= LogLevel.error) {
      process.stderr.write(format('ERROR', message) + '\n');
    }
  },

  warn(message: string): void {
    if (currentLevel >= LogLevel.warn) {
      process.stderr.write(format('WARN', message) + '\n');
    }
  },

  info(message: string): void {
    if (currentLevel >= LogLevel.info) {
      process.stdout.write(message + '\n');
    }
  },

  debug(message: string): void {
    if (currentLevel >= LogLevel.debug) {
      process.stdout.write(format('DEBUG', message) + '\n');
    }
  },
};
