"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ESCALERA DEL PIE — superficie única para los dos cuerpos que la usan
// (13 financiamiento STR · 17 reestructuración LTR).
//
// Reemplaza la referencia de "óptimo de pie 25%", que se rastreó hasta el fondo y
// resultó ser un valor convencional sin cálculo detrás: no marca un umbral de mejora
// de tasa, ni el punto donde el flujo cruza a neutro, ni un requisito bancario.
// Dibujarlo como barra de referencia le habría dado autoridad de dato a una
// convención. Acá no se declara ningún óptimo: se muestra el intercambio y el lector
// decide según su liquidez.
//
// Vive en un módulo propio y no en uno de los dos archivos de cuerpos para que no
// haya que cruzar imports entre AnalysisDrawer y DrawersPropios (hoy no se importan
// entre sí en ese sentido) y para que las dos superficies no puedan divergir.
// ─────────────────────────────────────────────────────────────────────────────

import type { NivelPie } from "@/lib/analysis";
import { VViz, Escalera, type FilaEscalera } from "./vocabulario";
// `fmtAxisMoney` es la forma compacta canónica del repo ($54,2M / UF 1,3K); no se
// replica un formateador nuevo para esto.
import { fmtMoney, fmtAxisMoney } from "@/components/analysis/utils";

type Currency = "CLP" | "UF";

/** Tolerancia del invariante, en pesos. */
const TOLERANCIA_FLUJO = 1000;

/**
 * Guarda compartida del invariante: devuelve el nivel actual SOLO si reproduce el
 * flujo que el informe ya muestra. La cadena del 13 (financiamiento STR) deriva su
 * salto de estos mismos niveles, así que depende de la MISMA verdad: si la escalera
 * se calla, la cadena también — nunca una dibujada y la otra muda sobre datos
 * distintos del mismo mes.
 */
export function nivelActualValidado(
  niveles: NivelPie[] | undefined,
  flujoPersistido: number | undefined,
): NivelPie | null {
  if (!niveles || niveles.length === 0 || typeof flujoPersistido !== "number") return null;
  const actual = niveles.find((n) => n.esActual);
  if (!actual) return null;
  if (Math.abs(actual.flujoMensual - flujoPersistido) > TOLERANCIA_FLUJO) return null;
  return actual;
}

export function EscaleraPie({
  niveles,
  valorUF,
  flujoPersistido,
  currency,
}: {
  /** Ya calculados por el helper de SU motor: `simularPie` (LTR) o
   *  `simularPieStr` (STR). El render es uno solo para las dos modalidades. */
  niveles: NivelPie[];
  valorUF: number;
  /** Flujo mensual que el informe ya muestra en el resto de la página. */
  flujoPersistido: number | undefined;
  currency: Currency;
}) {
  if (!(valorUF > 0)) return null;
  // Vacío ⇒ pie 0 (lo cubre un bono: subirlo es deshacer el trato), compra al contado,
  // o contexto irreconstruible. La decisión vive en el motor; acá solo se obedece.
  // ── INVARIANTE (guarda compartida) ── el nivel "actual" tiene que reproducir el
  // flujo que el informe ya muestra; si diverge, la escalera se calla.
  const actual = nivelActualValidado(niveles, flujoPersistido);
  if (!actual) return null;

  const money = (n: number) => fmtMoney(n, currency, valorUF);
  const signo = (n: number) => (n < 0 ? "−" : "+") + money(Math.abs(n));

  const filas: FilaEscalera[] = niveles.map((n) => {
    const delta = n.flujoMensual - actual.flujoMensual;
    return {
      // Campos NEUTROS desde el tramo 3: la primitiva la comparte con la escalera del
      // plazo, cuyo "nivel" son años y cuyo "costo" es el interés del crédito.
      nivel: `${n.piePct}%`,
      nivelSub: fmtAxisMoney(n.pieCLP, currency, valorUF),
      esActual: n.esActual,
      flujo: signo(n.flujoMensual),
      flujoNegativo: n.flujoMensual < 0,
      flujoDelta: n.esActual
        ? undefined
        : `${fmtAxisMoney(Math.abs(delta), currency, valorUF)} ${delta > 0 ? "mejor" : "peor"}`,
      costo: n.tirPct != null ? `${n.tirPct.toFixed(1).replace(".", ",")}%` : "—",
    };
  });

  // ── EL CIERRE SE DERIVA DEL DATO, NO SE ASUME ──
  // La dirección del trade-off NO es constante: medido sobre el parque, con TIR
  // negativa el apalancamiento juega en contra y la TIR SUBE al poner más pie
  // (un caso real: 5% → TIR −1,4% · 20% → TIR +0,7%). Afirmar "cada punto de pie te
  // cuesta retorno" sería falso justo en los deals más apretados.
  const primero = niveles[0];
  const ultimo = niveles[niveles.length - 1];
  const tirBaja = primero.tirPct != null && ultimo.tirPct != null && ultimo.tirPct < primero.tirPct;
  const tirSube = primero.tirPct != null && ultimo.tirPct != null && ultimo.tirPct > primero.tirPct;
  // "Desde X% el mes cierra en verde" SOLO tiene sentido si hoy está en rojo: con el
  // flujo actual ya positivo, anunciar un cruce más arriba sugiere que hace falta más
  // pie para algo que ya ocurre.
  const cruzaVerde =
    actual.flujoMensual < 0
      ? niveles.find((n) => n.flujoMensual >= 0 && n.piePct > actual.piePct)
      : undefined;

  const trade = tirBaja
    ? "Más pie alivia el mes y baja el retorno sobre tu plata; menos pie rinde más y aprieta el mes."
    : tirSube
      ? "Acá más pie mejora las dos cosas: el mes y el retorno. Pasa cuando el crédito cuesta más de lo que el deal rinde, así que apalancar juega en contra."
      : "El retorno casi no se mueve con el pie; lo que cambia es cuánto aporta tu bolsillo cada mes.";

  return (
    <VViz t="Tu deal con distintos niveles de pie">
      <Escalera
        filas={filas}
        pie={
          <>
            {trade}
            {cruzaVerde ? ` Desde ${cruzaVerde.piePct}% el mes cierra en verde.` : ""} Los bancos financian en
            tramos de 5%.
          </>
        }
      />
    </VViz>
  );
}
