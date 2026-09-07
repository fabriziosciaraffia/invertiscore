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
// Módulo PURO (sin React, sin DB, sin API): lo ejercita el catch-test
// scripts/eval/golden/titular-final-catch-test.ts dentro del QUICK.
// ============================================================================

import type { Hallazgo } from "./types";
import { evaluarTitular, normalizarMarcasTitular, stripMarcas, validarTitular, type NivelTitular } from "./prosa-marcas";
import { etiquetaVeredicto } from "./veredicto-etiqueta";
import { ordenarHallazgosUnico } from "./orden-hallazgos";

/** Con qué quedó la portada. `ia` = el original validó a la primera. */
export type ViaTitular = "ia" | "reescrito" | "escalon" | "motor";

export interface TitularResuelto {
  /** Nunca vacío. */
  titular: string;
  via: ViaTitular;
  /** Nivel de evaluarTitular sobre el texto elegido (siempre ≠ "invalido"). */
  nivel: Exclude<NivelTitular, "invalido">;
  /** Motivo del nivel cuando es largo renderizable; null si válido. */
  motivo: string | null;
}

const tieneMonto = (s: string): boolean => /\$\s?\d/.test(s) || /\bUF\s?[\d.]/i.test(s);

/** Primer hallazgo del orden único con titular corto, sin marcas ni montos. */
function titularHallazgoTop(hallazgos: Hallazgo[] | null | undefined): string | null {
  for (const h of ordenarHallazgosUnico(hallazgos)) {
    const t = typeof h?.titular === "string" ? stripMarcas(h.titular).trim() : "";
    if (!t || tieneMonto(t)) continue;
    return /[.!?…]$/.test(t) ? t : `${t}.`;
  }
  return null;
}

/**
 * Titular del motor, sin IA: «**Etiqueta.** Titular del hallazgo top.» Si ningún
 * hallazgo sirve (sin titular, con monto, o el resultado supera las 20 palabras),
 * «**Etiqueta.** Respuesta fija del motor.» Devuelve siempre un string no vacío
 * mientras `veredicto` o `respuestaFija` traigan algo.
 */
export function titularMotor(p: {
  veredicto: string;
  hallazgos: Hallazgo[] | null | undefined;
  /** Respuesta fija del motor al veredicto (ai-generation.ts, `respuestaVeredicto`). */
  respuestaFija: string;
}): string {
  const etiqueta = etiquetaVeredicto(p.veredicto, "frase", p.veredicto).trim();
  const cabeza = etiqueta ? `**${etiqueta.replace(/\.$/, "")}.**` : "";
  const armar = (cuerpo: string): string => (cabeza && cuerpo ? `${cabeza} ${cuerpo}` : cabeza || cuerpo);

  const top = titularHallazgoTop(p.hallazgos);
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
export function resolverTitular(p: {
  original: unknown;
  reescrito: string | null;
  veredicto: string;
  hallazgos: Hallazgo[] | null | undefined;
  respuestaFija: string;
}): TitularResuelto {
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

  const motor = titularMotor({ veredicto: p.veredicto, hallazgos: p.hallazgos, respuestaFija: p.respuestaFija });
  const ev = evaluarTitular(motor);
  return {
    titular: motor,
    via: "motor",
    nivel: ev.nivel === "largo_renderizable" ? "largo_renderizable" : "valido",
    motivo: ev.nivel === "largo_renderizable" ? ev.motivo : null,
  };
}
