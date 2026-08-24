// ============================================================================
// HALLAZGO DEL GATE — la causa del veredicto entra a la pirámide
// ============================================================================
// Caso medido: `04dafb00` es el ÚNICO informe del parque con veredicto BUSCAR
// OTRA y CERO hallazgos adversos. Su pirámide son once cards "A favor" y una
// neutral, y su veredicto lo decide `g1_regulacion` — un gate que no produce
// ningún hallazgo. El hero explica el motivo (la glosa de gates funciona), pero
// la pirámide entera celebra porque la causa real es INVISIBLE en las cards.
//
// El orden no puede mediarlo: `ordenarHallazgosUnico` ancla el 01 en el adverso
// más decisivo, y acá no hay ninguno. Medido sobre el parque, el orden SÍ hace
// su trabajo donde hay adverso (7b1c4ba1, 661f3362 y compañía anclan en
// `flujo_mensual` con decisividad 0,85); el hueco es exactamente el caso sin
// adversas.
//
// ALCANCE DELIBERADAMENTE ANGOSTO
// ───────────────────────────────
// El hallazgo se emite SOLO cuando un gate decide el veredicto y ninguna otra
// pieza de la pirámide es adversa. Con al menos un adverso, el orden ya media y
// agregar una card duplicaría el mensaje. Hoy eso es 1 informe; la razón de
// implementarlo no es el volumen sino que el hueco es estructural: se repite
// cada vez que un gate dispara solo.
//
// LA DECISIVIDAD ES MEDIDA, NO ASIGNADA
// ─────────────────────────────────────
// No se inventa un número para forzar el 01. Se compara el veredicto de la BANDA
// del score contra el veredicto FINAL: si el gate mueve la banda, ese gate es —
// por la definición que este repo ya usa para la decisividad ("neutralizarlo
// flipea el veredicto o desarma un gate")— lo más decisivo del caso. Si no la
// mueve, no hay hallazgo que emitir.
// ============================================================================

import type { HallazgoGateVeredicto } from "./types";

/** Veredicto que daría la banda del score, sin gates. Espejo de short-term-score:443. */
export function veredictoDeBanda(score: number): string {
  return score >= 70 ? "COMPRAR" : score >= 45 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
}

/**
 * Emite el hallazgo del gate, o null si no corresponde.
 *
 * `glosas` son las del motor (GLOSA_BRAZO) — el builder NO reescribe la causa,
 * la presenta. `hayAdverso` lo decide el caller sobre la pirámide ya construida.
 */
export function buildHallazgoGateVeredicto(p: {
  /** Motivos activos del gate, en orden de precedencia (gates.motivos). */
  motivos: string[];
  /** Glosa por motivo, del motor. */
  glosas: Readonly<Record<string, string>>;
  score: number;
  veredictoFinal: string;
  /** ¿La pirámide ya trae alguna card adversa? Con una, el orden media solo. */
  hayAdverso: boolean;
}): HallazgoGateVeredicto | null {
  if (p.hayAdverso) return null;
  if (!p.motivos.length) return null;
  const banda = veredictoDeBanda(p.score);
  // Sin flip no hay nada que mediar: el veredicto ya sale de la banda.
  if (banda === p.veredictoFinal) return null;

  const glosa = p.glosas[p.motivos[0]] ?? "";
  if (!glosa) return null;
  // La glosa del motor viene en registro técnico ("Edificio no permite Airbnb —
  // operación inviable"): se usa su primera cláusula, que es el hecho.
  const hecho = glosa.split("—")[0].trim();

  return {
    id: "gate_veredicto",
    tipo: "gate_veredicto",
    titular: "Hay una condición que decide por sí sola.",
    fraseCanonica:
      `${hecho}. Esto es lo que fija el veredicto en ${p.veredictoFinal}: por puntaje el análisis daría ` +
      `${banda}, y ninguna de las cifras a favor cambia esa condición.`,
    valor: {
      motivos: p.motivos,
      veredictoDeBanda: banda,
      veredictoFinal: p.veredictoFinal,
    },
    direccion: "adverso",
    // Medida: el gate mueve la banda, así que neutralizarlo flipea el veredicto.
    decisividad: 1,
    magnitudContinua: 1,
    procedencia: { base: "gates del motor", confianza: "alta" },
  };
}
