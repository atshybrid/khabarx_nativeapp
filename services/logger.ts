export type LogData = Record<string, any> | string | number | boolean | null | undefined;

const rawLevel = String(process.env.EXPO_PUBLIC_LOG_LEVEL || '').toLowerCase();
// Levels: error < warn < info < debug (event treated as info)
type Level = 'error' | 'warn' | 'info' | 'debug';
const levelOrder: Level[] = ['error', 'warn', 'info', 'debug'];
function parseLevel(): Level {
  if (rawLevel === 'debug') return 'debug';
  if (rawLevel === 'info') return 'info';
  if (rawLevel === 'warn') return 'warn';
  if (rawLevel === 'error') return 'error';
  return __DEV__ ? 'debug' : 'warn';
}
const activeLevel = parseLevel();
function allow(l: Level) {
  return levelOrder.indexOf(l) <= levelOrder.indexOf(activeLevel);
}

function fmt(name: string, data?: LogData) {
  const time = new Date().toISOString();
  return data === undefined ? `[${time}] ${name}` : `[${time}] ${name}: ${typeof data === 'object' ? JSON.stringify(data) : String(data)}`;
}

export const log = {
  event(name: string, data?: LogData) {
    if (allow('info')) console.log(fmt(`EVENT ${name}`, data));
  },
  debug(name: string, data?: LogData) {
    if (allow('debug')) console.log(fmt(`DEBUG ${name}`, data));
  },
  info(name: string, data?: LogData) {
    if (allow('info')) console.log(fmt(`INFO ${name}`, data));
  },
  warn(name: string, data?: LogData) {
    if (allow('warn')) console.warn(fmt(`WARN ${name}`, data));
  },
  error(name: string, err?: any) {
    if (allow('error')) console.error(fmt(`ERROR ${name}`, err?.message || err));
    if (err?.stack && allow('debug')) console.error(err.stack);
  },
  level: activeLevel,
};
