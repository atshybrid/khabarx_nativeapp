export type LogData = Record<string, any> | string | number | boolean | null | undefined;

const enabled = __DEV__;

function fmt(name: string, data?: LogData) {
  const time = new Date().toISOString();
  return data === undefined ? `[${time}] ${name}` : `[${time}] ${name}: ${typeof data === 'object' ? JSON.stringify(data) : String(data)}`;
}

export const log = {
  event(name: string, data?: LogData) {
    if (enabled) console.log(fmt(`EVENT ${name}`, data));
  },
  debug(name: string, data?: LogData) {
    if (enabled) console.log(fmt(`DEBUG ${name}`, data));
  },
  warn(name: string, data?: LogData) {
    console.warn(fmt(`WARN ${name}`, data));
  },
  error(name: string, err?: any) {
    console.error(fmt(`ERROR ${name}`, err?.message || err));
    if (err?.stack) console.error(err.stack);
  },
};
