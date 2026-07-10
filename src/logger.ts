const ts = () => new Date().toISOString();

export const log = {
  info:  (msg: string, ...a: unknown[]) => console.log(`[${ts()}] INFO  ${msg}`, ...a),
  warn:  (msg: string, ...a: unknown[]) => console.warn(`[${ts()}] WARN  ${msg}`, ...a),
  error: (msg: string, ...a: unknown[]) => console.error(`[${ts()}] ERROR ${msg}`, ...a),
  ok:    (msg: string, ...a: unknown[]) => console.log(`[${ts()}] ✅    ${msg}`, ...a),
};
