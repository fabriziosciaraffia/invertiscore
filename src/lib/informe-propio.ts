// ─────────────────────────────────────────────────────────────────────────────
// LA TARJETA DE UN DEPTO YA ANALIZADO DICE SU INFORME (05-nov-2026, decisión de Fabrizio).
//
// Hasta hoy, la tarjeta de un depto que la persona ya analizó (Explorar —tarjeta y lista—, la selección del dashboard y la
// primera selección de /deptos y del dashboard) mostraba el veredicto y el puntaje DE LA NOCHE —la evaluación de
// avisos_evaluados— al lado de «Ya lo analizaste · Ver informe». Si su informe dio otra cosa (otro pie, otro plazo, otro día),
// la tarjeta contradecía el informe que tiene en la mano. Ahora la tarjeta dice lo que dice SU informe:
//   · el chip de la casa con el veredicto y el puntaje GUARDADOS en su informe, y la fecha: «✓ Comprar · 79 · tu informe del
//     13-oct» (ChipInformePropio; el chip es ChipVeredicto, el único de veredicto en todo el producto);
//   · si la noche hoy da distinto, una línea chica: «hoy la noche da 82» (o con el veredicto, si cambió).
// Módulo PURO (lo usan las cuatro tarjetas y el tier TARJETA-ANALIZADA). El resumen de cada informe lo trae
// informe-propio-servidor.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { esVeredicto, etiquetaVeredicto, signoVeredicto } from "@/lib/veredicto-etiqueta";

/** Lo que la tarjeta necesita del informe de la persona: lo GUARDADO al crearlo (results.veredicto y score), y su fecha. */
export interface ResumenInforme {
  veredicto: string | null;
  score: number | null;
  /** created_at del informe (ISO). */
  fecha: string;
}

/** Lo que dice la noche de ese depto (la evaluación de la tarjeta). */
export interface VeredictoNoche {
  veredicto?: string | null;
  score?: number | null;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «13-oct», en hora de Chile. Vacío si no parsea. */
export function fechaInforme(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", day: "numeric", month: "numeric" }).formatToParts(d);
  const dia = partes.find((p) => p.type === "day")?.value ?? "";
  const mes = Number(partes.find((p) => p.type === "month")?.value ?? 0);
  return dia && mes ? `${dia}-${MESES[mes - 1]}` : "";
}

/** El chip de la casa en texto («✓ Comprar · 79»), como lo dibuja ChipVeredicto. */
function chipTexto(veredicto: string | null, score: number | null): string | null {
  if (!veredicto || !esVeredicto(veredicto)) return null;
  return `${signoVeredicto(veredicto)} ${etiquetaVeredicto(veredicto, "frase")}${score != null ? ` · ${score}` : ""}`;
}

export const INFORME_PROPIO_COPY = {
  /** Lo que va al lado del chip: «tu informe del 13-oct». */
  fecha: (r: ResumenInforme): string => {
    const f = fechaInforme(r.fecha);
    return f ? `tu informe del ${f}` : "tu informe";
  },
  /** Sin veredicto guardado (filas viejas): solo el informe y su fecha. */
  sinVeredicto: (r: ResumenInforme): string => {
    const f = fechaInforme(r.fecha);
    return f ? `✓ Tu informe del ${f}` : "✓ Tu informe";
  },
  /** La línea chica cuando la noche da distinto. */
  noche: (n: { veredicto: string | null; score: number | null; cambiaVeredicto: boolean }): string =>
    n.cambiaVeredicto && n.veredicto
      ? `hoy la noche da ${etiquetaVeredicto(n.veredicto, "frase")}${n.score != null ? ` · ${n.score}` : ""}`
      : `hoy la noche da ${n.score}`,
} as const;

/** El chip del informe de la persona, en texto: «✓ Comprar · 79 · tu informe del 13-oct». */
export function chipInforme(r: ResumenInforme): string {
  const chip = chipTexto(r.veredicto, r.score);
  return chip ? `${chip} · ${INFORME_PROPIO_COPY.fecha(r)}` : INFORME_PROPIO_COPY.sinVeredicto(r);
}

/**
 * La línea chica de la noche, o null si la noche da lo mismo que el informe (o no da nada que comparar). Dice el veredicto
 * solo si cambió; si no, el puntaje.
 */
export function lineaNoche(r: ResumenInforme, noche: VeredictoNoche | null | undefined): string | null {
  if (!noche) return null;
  const vN = noche.veredicto ?? null, sN = noche.score ?? null;
  const cambiaVeredicto = !!vN && !!r.veredicto && vN !== r.veredicto;
  const cambiaScore = sN != null && sN !== r.score;
  if (!cambiaVeredicto && !cambiaScore) return null;
  return INFORME_PROPIO_COPY.noche({ veredicto: vN, score: sN, cambiaVeredicto });
}
