// Los .css como módulos vacíos, ANTES de importar componentes que los traen (los imports se evalúan antes que el cuerpo del
// tier: registrar el gancho en el cuerpo llega tarde). Importarlo primero.
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
export {};
