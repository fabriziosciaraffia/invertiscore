// La HUELLA del filtro de listings de la ocupación realizada (23-sep-2026). La comparten el
// generador del ancla (`scripts/generar-ocupacion-realizada-santiago.ts`) y el tier
// `factibilidad-demanda`: el texto entre los marcadores de `process-comparables.ts`, sin
// espacios de más, hasheado. Si el filtro cambia, la huella cambia y el ancla guardada deja de
// corresponderle: el tier se pone rojo hasta que se regenera.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const ARCHIVO_FILTRO = "src/lib/airbnb/process-comparables.ts";

export function textoFiltro(raiz: string): string {
  const src = readFileSync(join(raiz, ARCHIVO_FILTRO), "utf8").replace(/\r\n/g, "\n");
  const a = src.indexOf("// <filtro-ocupacion-realizada>");
  const b = src.indexOf("// </filtro-ocupacion-realizada>");
  if (a === -1 || b === -1 || b < a) return "";
  return src.slice(a, b).replace(/\s+/g, " ").trim();
}

export function huellaFiltro(raiz: string): string {
  const t = textoFiltro(raiz);
  return t ? createHash("sha256").update(t).digest("hex").slice(0, 16) : "";
}
