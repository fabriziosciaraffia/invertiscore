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

import { simularPie } from "@/lib/analysis";
import type { AnalisisInput } from "@/lib/types";
import { VViz, Escalera, type FilaEscalera } from "./vocabulario";
// `fmtAxisMoney` es la forma compacta canónica del repo ($54,2M / UF 1,3K); no se
// replica un formateador nuevo para esto.
import { fmtMoney, fmtAxisMoney } from "@/components/analysis/utils";

type Currency = "CLP" | "UF";

/** Tolerancia del invariante, en pesos. */
const TOLERANCIA_FLUJO = 1000;

export function EscaleraPie({
  input,
  valorUF,
  asOf,
  flujoPersistido,
  precioCLPPersistido,
  currency,
}: {
  input: AnalisisInput | undefined;
  valorUF: number;
  /** Fecha del análisis. Sin ella la proyección usaría "hoy" y los meses hasta la
   *  entrega saldrían mal en compra en verde, así que sin fecha NO se dibuja. */
  asOf: Date | undefined;
  /** Flujo mensual que el informe ya muestra en el resto de la página. */
  flujoPersistido: number | undefined;
  /** `metrics.precioCLP` persistido: de ahí sale el UF congelado del análisis. */
  precioCLPPersistido: number | undefined;
  currency: Currency;
}) {
  if (!input || !asOf || !(valorUF > 0) || typeof flujoPersistido !== "number") return null;

  // ── EL UF DEL RECOMPUTE ES EL CONGELADO DEL ANÁLISIS, NO EL DE HOY ──
  // `valorUF` es el UF vigente de la página (sirve para formatear y para el toggle
  // CLP/UF), pero el análisis se calculó con el UF de su fecha. Recomputar con el de
  // hoy cambia el precio en pesos y por lo tanto el flujo: el invariante lo detectaba
  // y apagaba la escalera entera. El congelado se deriva exacto de lo persistido.
  const ufCongelado = precioCLPPersistido && input.precio > 0 ? precioCLPPersistido / input.precio : valorUF;

  const niveles = simularPie(input, ufCongelado, asOf);
  // Vacío ⇒ pie 0 (lo cubre un bono: subirlo es deshacer el trato) o compra al
  // contado. La decisión vive en el motor; acá solo se obedece.
  if (niveles.length === 0) return null;

  const actual = niveles.find((n) => n.esActual);
  if (!actual) return null;

  // ── INVARIANTE ── el nivel "actual" tiene que reproducir el flujo que el informe
  // ya muestra. Si diverge, la escalera estaría describiendo otro deal que el resto
  // de la página: se calla en vez de mostrar dos cifras del mismo mes.
  if (Math.abs(actual.flujoMensual - flujoPersistido) > TOLERANCIA_FLUJO) return null;

  const money = (n: number) => fmtMoney(n, currency, valorUF);
  const signo = (n: number) => (n < 0 ? "−" : "+") + money(Math.abs(n));

  const filas: FilaEscalera[] = niveles.map((n) => {
    const delta = n.flujoMensual - actual.flujoMensual;
    return {
      pie: `${n.piePct}%`,
      pieMonto: fmtAxisMoney(n.pieCLP, currency, valorUF),
      esActual: n.esActual,
      flujo: signo(n.flujoMensual),
      flujoNegativo: n.flujoMensual < 0,
      flujoDelta: n.esActual
        ? undefined
        : `${fmtAxisMoney(Math.abs(delta), currency, valorUF)} ${delta > 0 ? "mejor" : "peor"}`,
      tir: n.tirPct != null ? `${n.tirPct.toFixed(1).replace(".", ",")}%` : "—",
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
