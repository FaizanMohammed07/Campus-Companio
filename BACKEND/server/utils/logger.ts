type LogLevel = "debug" | "info" | "warn" | "error";

type LogEntry = {
  level: LogLevel;
  message: string;
  time: string;
  meta?: Record<string, unknown>;
};

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = (
  process.env.LOG_LEVEL || "info"
).toLowerCase() as LogLevel;
const minLevel = levelOrder[configuredLevel] ?? levelOrder.info;

export function log(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
) {
  if (levelOrder[level] < minLevel) return;
  const entry: LogEntry = {
    level,
    message,
    time: new Date().toISOString(),
    meta: meta && Object.keys(meta).length > 0 ? meta : undefined,
  };
  console.log(JSON.stringify(entry));
}

export const logInfo = (message: string, meta?: Record<string, unknown>) =>
  log("info", message, meta);
export const logWarn = (message: string, meta?: Record<string, unknown>) =>
  log("warn", message, meta);
export const logError = (message: string, meta?: Record<string, unknown>) =>
  log("error", message, meta);
export const logDebug = (message: string, meta?: Record<string, unknown>) =>
  log("debug", message, meta);
