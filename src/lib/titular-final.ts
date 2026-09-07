// ============================================================================
// TITULAR FINAL DE PORTADA — resolución determinista, nunca null (goal #8 · 07-sep-2026)
// ============================================================================
// Hasta este goal la cadena era: titular de la IA → retry dirigido → escalón
// (16-20 palabras se renderiza) → null. Un original de >20 palabras cuyo retry no
// convergía dejaba la portada SIN titular: un informe roto, que el golden (A9)
// marcaba en rojo sin que se pudiera leer por qué. GS-6 lo mostró 2 de 3 corridas.
//
// Ahora el titular final es un `string` por construcción. Orden de candidatos:
//   1. original válido (validarTitular: ≤15 palabras, un par `**`, sin montos) → tal cual
//   2. reescrito del retry, si evaluarTitular no lo declara inválido (≤15 válido,
//      o 16-20 palabras como largo renderizable), con las marcas normalizadas
//   3. original, mismo escalón (decisión PARÁ 3: mostrar largo gana a callar)
//   4. TITULAR DEL MOTOR, sin IA: «**Etiqueta.** Titular del hallazgo top.» — la
//      etiqueta del veredicto (veredicto-etiqueta.ts) más el titular corto del primer
//      hallazgo del orden único (orden-hallazgos.ts). ≤11 palabras, un plumón de una
//      o dos palabras, sin montos. Sin hallazgo usable: etiqueta + la respuesta fija
//      del motor al veredicto ("Todavía no: tienes que ajustar los supuestos.").
//
// STR (goal #8b · 07-sep-2026) reutiliza la misma cadena con dos diferencias propias:
//   · el orden es el de la pirámide STR (piramide-orden-str.ts) y el hallazgo que
//     manda el titular tiene que ir en la DIRECCIÓN del veredicto (COMPRAR → favorable,
//     BUSCAR OTRA → adverso, AJUSTA → el 01 tal cual, que es la palanca): el 01 STR
//     puede ser adverso con COMPRAR (efe52b6a: ocupación supuesta > estimada) y un
//     «**Comprar.** Supusiste más ocupación…» contradice la banda.
//   · el motor STR no antepone respuesta fija a la prosa: el último recurso es la
//     LÍNEA FIJA STR de abajo (copy de Fabrizio, 07-sep), no el prompt.
//
// Módulo PURO (sin React, sin DB, sin API): lo ejercita el catch-test
// scripts/eval/golden/titular-final-catch-test.ts dentro del QUICK.
// ============================================================================

import type { Hallazgo, Veredicto } from "./types";
import { evaluarTitular, normalizarMarcasTitular, stripMarcas, validarTitular, type NivelTitular } from "./prosa-marcas";
import { etiquetaVeredicto } from "./veredicto-etiqueta";
import { ordenarHallazgosUnico } from "./orden-hallazgos";
import { ordenarHallazgosPiramideSTR } from "./piramide-orden-str";

/** Con qué quedó la portada. `ia` = el original validó a la primera. */
export type ViaTitular = "ia" | "reescrito" | "escalon" | "motor";

/** Qué orden de hallazgos manda el titular del motor. */
export type OrdenTitular = "ltr" | "str";

export interface TitularResuelto {
  /** Nunca vacío. */
  titular: string;
  via: ViaTitular;
  /** Nivel de evaluarTitular sobre el texto elegido (siempre ≠ "invalido"). */
  nivel: Exclude<NivelTitular, "invalido">;
  /** Motivo del nivel cuando es largo renderizable; null si válido. */
  motivo: string | null;
}

/** Último recurso STR por veredicto (sin hallazgo usable). Copy de Fabrizio (07-sep-2026);
 *  vive acá y no en el prompt: el modelo nunca lo ve. */
export const LINEA_FIJA_STR: Record<Veredicto, string> = {
  COMPRAR: "En renta corta se sostiene solo.",
  "AJUSTA SUPUESTOS": "En renta corta cierra con un ajuste.",
  "BUSCAR OTRA": "En renta corta no cierra.",
};

export function lineaFijaStr(veredicto: string): string {
  return (LINEA_FIJA_STR as Record<string, string>)[veredicto] ?? "";
}

/** Dirección del hallazgo que puede cargar el titular del motor: la del veredicto.
 *  AJUSTA no filtra (su 01 es la palanca, adversa por definición). */
export function direccionPreferidaTitular(veredicto: string): Hallazgo["direccion"] | null {
  if (veredicto === "COMPRAR") return "favorable";
  if (veredicto === "BUSCAR OTRA") return "adverso";
  return null;
}

const tieneMonto = (s: string): boolean => /\$\s?\d/.test(s) || /\bUF\s?[\d.]/i.test(s);

const titularCorto = (h: Hallazgo | null | undefined): string | null => {
  const t = typeof h?.titular === "string" ? stripMarcas(h.titular).trim() : "";
  if (!t || tieneMonto(t)) return null;
  return /[.!?…]$/.test(t) ? t : `${t}.`;
};

/** Primer hallazgo del orden con titular corto usable (sin marcas ni montos). Con
 *  `direccion`, primero el primero que va en esa dirección; si ninguno sirve, el
 *  primero usable del orden (nunca se queda sin candidato por el filtro). */
function titularHallazgoTop(
  hallazgos: Hallazgo[] | null | undefined,
  orden: OrdenTitular,
  direccion: Hallazgo["direccion"] | null,
): string | null {
  const lista = orden === "str" ? ordenarHallazgosPiramideSTR(hallazgos) : ordenarHallazgosUnico(hallazgos);
  if (direccion) {
    for (const h of lista) {
      if (h?.direccion !== direccion) continue;
      const t = titularCorto(h);
      if (t) return t;
    }
  }
  for (const h of lista) {
    const t = titularCorto(h);
    if (t) return t;
  }
  return null;
}

export interface TitularMotorArgs {
  veredicto: string;
  hallazgos: Hallazgo[] | null | undefined;
  /** Último recurso sin hallazgo usable: LTR la respuesta fija del motor
   *  (ai-generation.ts, `respuestaVeredicto`); STR `lineaFijaStr(veredicto)`. */
  respuestaFija: string;
  /** Orden de hallazgos que manda. Default "ltr" (orden único). */
  orden?: OrdenTitular;
  /** Dirección exigida al hallazgo que carga el titular (STR: `direccionPreferidaTitular`). */
  direccionPreferida?: Hallazgo["direccion"] | null;
}

/**
 * Titular del motor, sin IA: «**Etiqueta.** Titular del hallazgo top.» Si ningún
 * hallazgo sirve (sin titular, con monto, o el resultado supera las 20 palabras),
 * «**Etiqueta.** Respuesta fija.» Devuelve siempre un string no vacío mientras
 * `veredicto` o `respuestaFija` traigan algo.
 */
export function titularMotor(p: TitularMotorArgs): string {
  const etiqueta = etiquetaVeredicto(p.veredicto, "frase", p.veredicto).trim();
  const cabeza = etiqueta ? `**${etiqueta.replace(/\.$/, "")}.**` : "";
  const armar = (cuerpo: string): string => (cabeza && cuerpo ? `${cabeza} ${cuerpo}` : cabeza || cuerpo);

  const top = titularHallazgoTop(p.hallazgos, p.orden ?? "ltr", p.direccionPreferida ?? null);
  if (top) {
    const candidato = armar(top);
    if (evaluarTitular(candidato).nivel !== "invalido") return candidato;
  }
  const fija = stripMarcas(p.respuestaFija ?? "").trim();
  const cierre = armar(fija && !tieneMonto(fija) ? fija : "");
  return cierre || etiqueta || fija;
}

/**
 * Resuelve el titular final de la portada. `original` es el titular del JSON de la
 * generación principal (puede ser cualquier cosa); `reescrito` el texto del retry
 * dirigido (null si no hubo o la API falló). Nunca devuelve vacío ni null.
 */
export function resolverTitular(p: TitularMotorArgs & { original: unknown; reescrito: string | null }): TitularResuelto {
  const original = typeof p.original === "string" ? p.original.trim() : "";
  if (original && validarTitular(original).ok) {
    return { titular: original, via: "ia", nivel: "valido", motivo: null };
  }

  const candidatos: Array<{ via: Exclude<ViaTitular, "ia" | "motor">; texto: string }> = [
    { via: "reescrito", texto: (p.reescrito ?? "").trim() },
    { via: "escalon", texto: original },
  ];
  for (const c of candidatos) {
    if (!c.texto) continue;
    const ev = evaluarTitular(c.texto);
    if (ev.nivel === "invalido") continue;
    return { titular: normalizarMarcasTitular(c.texto), via: c.via, nivel: ev.nivel, motivo: ev.motivo };
  }

  const motor = titularMotor(p);
  const ev = evaluarTitular(motor);
  return {
    titular: motor,
    via: "motor",
    nivel: ev.nivel === "largo_renderizable" ? "largo_renderizable" : "valido",
    motivo: ev.nivel === "largo_renderizable" ? ev.motivo : null,
  };
}
