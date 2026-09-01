"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ESCALERA DEL PLAZO — la segunda palanca del cuerpo de financiamiento, hermana de
// `EscaleraPie` y con las MISMAS reglas de invariante.
//
// POR QUÉ NO REUSA LA COLUMNA DE TIR. Medido sobre 300 análisis del parque: de los
// 169 que pueden estirar, la TIR a 10 años al pasar a 30 SUBE en 127 (75%), queda
// plana en 35 y baja en 7. Dentro del horizonte del informe, estirar el plazo mejora
// el flujo Y el retorno — con flujo+TIR este diagrama diría "estira siempre", con
// cara de dato. El costo del plazo vive fuera de los 10 años que el informe proyecta,
// y por eso la tercera columna es el interés del crédito COMPLETO.
//
// EL HORIZONTE VA EN CADA CELDA, NO EN EL RÓTULO DE LA COLUMNA. La intención era
// rotularla "INTERÉS TOTAL DEL CRÉDITO (30 años)", pero el horizonte CAMBIA POR FILA:
// la fila de 15 años muestra interés a 15 años. Un horizonte fijo en el encabezado
// sería falso en tres de las cuatro filas. Va como subtexto de cada monto ("a 25
// años"), que cumple lo mismo —el lector lo ve sin buscarlo, no en nota al pie— y es
// verdadero fila a fila.
// ─────────────────────────────────────────────────────────────────────────────

import type { NivelPlazo } from "@/lib/analysis";
import { VViz, Escalera, type FilaEscalera } from "./vocabulario";
import { fmtMoney, fmtAxisMoney } from "@/components/analysis/utils";

type Currency = "CLP" | "UF";

/** Tolerancia del invariante, en pesos. Misma que la escalera del pie: las dos
 *  responden al mismo flujo persistido y no pueden discrepar sobre él. */
const TOLERANCIA_FLUJO = 1000;

/**
 * Guarda del invariante, espejo de `nivelActualValidado` del pie: el nivel del plazo
 * declarado tiene que reproducir el flujo que el informe ya muestra. Si diverge, la
 * escalera se calla entera — nunca se dibuja una tabla cuyo "hoy" contradice el
 * número del hero.
 *
 * Verificado sobre 291 análisis del parque antes de escribir este render: 291/291
 * reproducen el flujo (delta mediana 0), 291/291 tienen interés monótono en el plazo
 * y 291/291 cuadran con la cuota y el crédito persistidos.
 */
export function nivelPlazoValidado(
  niveles: NivelPlazo[] | undefined,
  flujoPersistido: number | undefined,
): NivelPlazo | null {
  if (!niveles || niveles.length === 0 || typeof flujoPersistido !== "number") return null;
  const actual = niveles.find((n) => n.esActual);
  if (!actual) return null;
  if (Math.abs(actual.flujoMensual - flujoPersistido) > TOLERANCIA_FLUJO) return null;
  return actual;
}

export function EscaleraPlazo({
  niveles,
  valorUF,
  flujoPersistido,
  currency,
}: {
  /** Ya calculados por `simularPlazo`. El render no recalcula nada. */
  niveles: NivelPlazo[];
  valorUF: number;
  /** Flujo mensual que el informe ya muestra en el resto de la página. */
  flujoPersistido: number | undefined;
  currency: Currency;
}) {
  if (!(valorUF > 0)) return null;
  const actual = nivelPlazoValidado(niveles, flujoPersistido);
  if (!actual) return null;

  const money = (n: number) => fmtMoney(n, currency, valorUF);
  const signo = (n: number) => (n < 0 ? "−" : "+") + money(Math.abs(n));
  // El interés se guarda en UF (ver el aviso de unidades en `NivelPlazo`) y se
  // convierte ACÁ, con la misma UF que el resto de la página.
  const interes = (uf: number) => fmtAxisMoney(uf * valorUF, currency, valorUF);

  const filas: FilaEscalera[] = niveles.map((n) => {
    const deltaFlujo = n.flujoMensual - actual.flujoMensual;
    const deltaInteres = n.interesTotalUF - actual.interesTotalUF;
    return {
      nivel: `${n.plazoAnios} años`,
      nivelSub: money(n.cuotaMensual) + " de cuota",
      esActual: n.esActual,
      flujo: signo(n.flujoMensual),
      flujoNegativo: n.flujoMensual < 0,
      flujoDelta: n.esActual
        ? undefined
        : `${fmtAxisMoney(Math.abs(deltaFlujo), currency, valorUF)} ${deltaFlujo > 0 ? "mejor" : "peor"}`,
      costo: interes(n.interesTotalUF),
      // El horizonte de ESTA fila, no el del informe. En la fila de hoy, el delta.
      costoSub: n.esActual
        ? `a ${n.plazoAnios} años · hoy`
        : `${interes(Math.abs(deltaInteres))} ${deltaInteres > 0 ? "más" : "menos"}`,
    };
  });

  // ── EL CIERRE SE DERIVA DEL DATO ── igual que en la escalera del pie: la lectura
  // NO es la misma para quien puede estirar y para quien ya está en el tope. El 42%
  // del parque está en 30 años, y para esa gente el diagrama se lee hacia arriba.
  const enElTope = actual.plazoAnios >= 30;
  const masCorto = niveles[0];
  const ahorroSiAcorta = actual.interesTotalUF - masCorto.interesTotalUF;
  const costoCuotaSiAcorta = masCorto.cuotaMensual - actual.cuotaMensual;

  return (
    <VViz t="Tu deal con distintos plazos">
      <Escalera
        filas={filas}
        ancha
        cols={["Plazo", "Tu flujo mensual", "Interés total del crédito"]}
        pie={
          enElTope ? (
            <>
              Ya estás en el plazo más largo que dan los bancos: el alivio en la cuota ya lo tienes, y el
              interés de arriba es lo que cuesta. Acortar a {masCorto.plazoAnios} años te ahorra{" "}
              {interes(ahorroSiAcorta)} de interés y te sube la cuota {money(costoCuotaSiAcorta)} al mes.
            </>
          ) : (
            <>
              Estirar el plazo alivia el mes y encarece el crédito completo: la cuota baja porque la deuda
              dura más, no porque cueste menos. Los bancos prestan en tramos de 5 años, hasta 30.
            </>
          )
        }
      />
    </VViz>
  );
}
