// Minimal structured logger. Keeps demo output readable without extra dependencies.
const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const configured = levels[process.env.LOG_LEVEL] ?? levels.info;

function emit(level, message, meta) {
  if (levels[level] > configured) return;
  const line = `[${new Date().toISOString()}] [trip-service] ${level.toUpperCase()} ${message}`;
  if (meta !== undefined) {
    console[level === 'debug' ? 'log' : level](line, meta);
  } else {
    console[level === 'debug' ? 'log' : level](line);
  }
}

export const logger = {
  error: (m, meta) => emit('error', m, meta),
  warn: (m, meta) => emit('warn', m, meta),
  info: (m, meta) => emit('info', m, meta),
  debug: (m, meta) => emit('debug', m, meta),
};
