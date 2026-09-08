// ============================================================================
// ETIQUETA DEL VEREDICTO — única fuente de la escritura (goal 10a · 07-sep-2026)
// ============================================================================
// Los tres veredictos se PERSISTEN como "COMPRAR" / "AJUSTA SUPUESTOS" / "BUSCAR OTRA"
// (`Veredicto` en types.ts): esa es la identidad y no cambia. Lo que el usuario LEE es
// otra cosa y vive solo acá: COMPRAR · AJUSTAR · BUSCAR OTRO.
//
// Tres formas, una por superficie:
//   · "banda": MAYÚSCULAS para la banda de portada, badges y el OG ("BUSCAR OTRO").
//   · "frase": para leyendas, dials, drawers y prosa de UI ("Buscar otro").
//   · "corta": para la celda de la matriz y el eje del OG ("Buscar").
//
// Módulo PURO (sin React, sin DB): lo usan componentes, rutas edge (OG) y emails.
// Ningún literal de etiqueta vive fuera de este archivo: lo caza el catch-test
// scripts/eval/golden/etiqueta-veredicto-catch-test.ts, que corre con el QUICK.
// Prompts, guards y el PDF (/documento) siguen con la etiqueta vieja hasta 10b.
// ============================================================================

import type { Veredicto } from "./types";

export type FormaEtiqueta = "banda" | "frase" | "corta";

const ETIQUETAS: Record<Veredicto, Record<FormaEtiqueta, string>> = {
  COMPRAR: { banda: "COMPRAR", frase: "Comprar", corta: "Comprar" },
  "AJUSTA SUPUESTOS": { banda: "AJUSTAR", frase: "Ajustar", corta: "Ajustar" },
  "BUSCAR OTRA": { banda: "BUSCAR OTRO", frase: "Buscar otro", corta: "Buscar" },
};

const esVeredicto = (v: unknown): v is Veredicto => typeof v === "string" && v in ETIQUETAS;

/** Etiqueta visible de un veredicto persistido. `fallback` para valores que no son
 *  veredicto (legacy, null): por defecto devuelve el valor tal cual (o ""). */
export function etiquetaVeredicto(v: Veredicto | string | null | undefined, forma: FormaEtiqueta = "frase", fallback?: string): string {
  if (esVeredicto(v)) return ETIQUETAS[v][forma];
  return fallback ?? (typeof v === "string" ? v : "");
}

/** Los tres, en el orden canónico del producto (de mejor a peor), unidos por `sep`. */
export function listaVeredictos(forma: FormaEtiqueta = "banda", sep = " · "): string {
  return (["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"] as const).map((v) => ETIQUETAS[v][forma]).join(sep);
}

// ============================================================================
// LA LÍNEA QUE DECLARA — el título del bloque «¿Conviene?» (v21 · 08-sep-2026)
// ============================================================================
// El bloque perdió su rótulo genérico («¿Conviene o no conviene?», que preguntaba
// lo que la banda de la portada ya contestó) y pasó a titularse con la RESPUESTA:
// una oración imperativa por veredicto, y bajo ella las razones que la sostienen.
//
// SON CONSTANTES, NO UN CAMPO DEL PROMPT. Tres strings fijos no necesitan modelo:
// meterlos al schema costaría tokens por generación para reproducir algo que ya
// está decidido, y dejaría que cada corrida los escribiera distinto. Viven acá,
// junto a la etiqueta, porque son la MISMA decisión escrita para otra superficie:
// el usuario tiene que leer la misma palabra en la banda y en el título.
//
// La segunda cláusula es idéntica en los tres a propósito. La lista que va debajo
// es MIXTA —trae razones a favor y en contra en el mismo bloque, ordenadas por
// peso— así que un cierre direccional («lo que no cierra») se contradice con la
// primera línea a favor. «Esto es lo que pesa» describe el criterio de la lista,
// que es lo único cierto para los tres veredictos.
//
// «Ajusta los números», no «los supuestos»: supuesto es palabra nuestra, del motor.
// El valor persistido sigue siendo "AJUSTA SUPUESTOS" y no cambia.
// ============================================================================

const LINEAS_DECLARA: Record<Veredicto, string> = {
  COMPRAR: "Compra. Esto es lo que pesa:",
  "AJUSTA SUPUESTOS": "Ajusta los números. Esto es lo que pesa:",
  "BUSCAR OTRA": "Busca otro. Esto es lo que pesa:",
};

/** Título del bloque de razones, por veredicto. `null` si el valor no es un
 *  veredicto conocido (legacy sin normalizar): el caller decide el vacío. */
export function lineaQueDeclara(v: Veredicto | string | null | undefined): string | null {
  return esVeredicto(v) ? LINEAS_DECLARA[v] : null;
}
