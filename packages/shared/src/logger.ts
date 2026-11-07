import { pino, type Logger } from 'pino';

export function createLogger(service: string, level = process.env.LOG_LEVEL ?? 'info'): Logger {
  return pino({
    level: process.env.NODE_ENV === 'test' ? 'silent' : level,
    base: { service },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.refreshToken'],
      censor: '[redacted]',
    },
  });
}
export type { Logger };
