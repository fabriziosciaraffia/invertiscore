// ─────────────────────────────────────────────────────────────────────────────
// LA REFERENCIA BAJO LA CIFRA — contra qué se compara el número de la fila.
//
// Sale ENTERA de `hallazgo.valor`, que el motor ya emite tipado. Render puro: no
// toca el prompt, no mueve el hash, no recalcula nada.
//
// REGLA DURA: donde el `valor` NO trae una referencia tipada, se devuelve null y
// la cifra va sola. Está prohibido inventar un umbral para que la fila no quede
// coja — una referencia inventada es peor que ninguna, porque el lector la lee
// como si el motor la hubiera calculado.
//
// Sin referencia hoy, y por qué:
//   · capex_puesta_a_punto      — `fraccionInversion` es la misma cifra en otra
//                                 unidad, no un umbral contra el cual medirla.
//   · flujo_str                 — `banda: 250000` es una escala de magnitud para
//                                 clasificar, no un valor que el lector reconozca.
//   · estructura_financiamiento — el KPI de la fila es el PIE, y `pieLevel` es un
//                                 juicio ordinal ("aceptable"): no hay umbral de
//                                 pie en `valor`. La tasa sí tiene `tasaMarketPct`,
//                                 pero referenciar la tasa bajo una cifra que habla
//                                 del pie sería comparar dos cosas distintas.
//   · gate_veredicto            — no está medido en ningún fixture.
// ─────────────────────────────────────────────────────────────────────────────

import type { Hallazgo } from "@/lib/types";
import { fmtMoney } from "./utils";

/**
 * Dos precisiones a propósito: la referencia tiene que leerse con la MISMA que la
 * cifra que está arriba, o el par se ve descalibrado.
 *
 * `pct1` (siempre un decimal) va donde el KPI es una tasa de un decimal: «4,3%»
 * con «promedio 4,0%». Con el entero pelado quedaba «promedio 4%» al lado de
 * «4,3%», que es lo que el contrato del wireframe corrige.
 *
 * `pct` (entero cuando es entero) va donde la referencia es un umbral o una banda
 * en números redondos: «normal 30–40%», «firme sobre 15%». Ahí el decimal sobra.
 */
const pct1 = (n: number): string => n.toFixed(1).replace(".", ",") + "%";
const pct = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",")) + "%";

/**
 * Texto de la referencia, o `null` cuando el hallazgo no trae ninguna tipada.
 * Corto a propósito: vive en 10,5px bajo la cifra, no es una frase.
 */
export function referenciaHallazgo(h: Hallazgo, currency: "CLP" | "UF", valorUF: number): string | null {
  const money = (n: number) => fmtMoney(n, currency, valorUF);
  switch (h.id) {
    case "cap_rate":
      return `promedio ${pct1(h.valor.capRefPct)}`;
    case "rentabilidad_str":
      return `umbral ${pct1(h.valor.umbralPct)}`;
    case "plusvalia":
      return `umbral real ${pct1(h.valor.refPct)}`;
    case "tir":
      return `umbral ${pct1(h.valor.umbralPct)}`;
    case "ocupacion_vs_estimacion":
      return `estimado ${pct(h.valor.estimacionPct)}`;
    case "ventaja_vs_ltr":
      return `borde ${pct(h.valor.bordePct)}`;
    case "sensibilidad":
      // Dos cortes tipados; el que informa es el de firmeza (sobre él, el veredicto
      // no depende del supuesto). El de fragilidad vive en el drawer.
      return `firme sobre ${pct(h.valor.corteFavorable)}`;
    case "sensibilidad_str":
      return `frágil sobre ${pct(h.valor.corteFragil)}`;
    case "estructura_costos_str":
      return `normal ${pct(h.valor.bandaFavPct)}–${pct(h.valor.bandaAdvPct)}`;
    case "patrimonio":
      return `pusiste ${money(h.valor.aportadoCLP)}`;
    case "sobreprecio": {
      // F2 · el término PROPIO junto a la mediana. La línea ya decía contra qué se
      // compara («mediana UF 94,2») pero nunca cuánto vale el metro de ESTE depto, y la
      // prosa lo suplía en 14 de 30 generaciones medidas.
      //
      // DOS RECORTES QUE SALIERON DE MEDIR, no de gusto. La columna mide 120px fijos y
      // 104 en móvil; con «mediana» entera o con decimal, el par envuelve a dos líneas:
      //   UF 110,0 · med 101,1  → 2 líneas en desktop Y en móvil
      //   UF 68,4 · med 40,3    → 1 en desktop, 2 en móvil
      //   UF 110 · med 101      → 1 y 1  ← esta
      // El decimal además era precisión falsa: la mediana sale de una muestra de N
      // publicaciones y la diferencia entre UF 110,0 y UF 110 es ruido. La precisión
      // que importa la lleva el KPI, que es el % de brecha.
      const uf = (x: number) => Math.round(x).toLocaleString("es-CL");
      const sujeto = h.valor.sujetoUfM2;
      const mediana = uf(h.valor.medianaComunaUfM2);
      return typeof sujeto === "number" && sujeto > 0
        ? `UF ${uf(sujeto)} · med ${mediana}`
        : `mediana UF ${mediana}`;
    }
    case "flujo_mensual":
      return `cuota ${money(h.valor.dividendoMensualCLP)}`;
    default:
      // capex_puesta_a_punto · flujo_str · estructura_financiamiento ·
      // gate_veredicto · distancia_veredicto (excluido de la pirámide).
      return null;
  }
}
