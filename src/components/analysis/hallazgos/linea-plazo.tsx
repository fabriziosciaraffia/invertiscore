"use client";

// ════════════════════════════════════════════════════════════════════════════
// LA LÍNEA DEL PLAZO — lo que el crédito cuesta FUERA del horizonte del informe.
//
// Reemplaza a `EscaleraPlazo` (retirada el 17-sep-2026 con los dos drawers que la
// montaban, inalcanzables desde el 5-sep). La escalera dibujaba cuatro plazos con su
// cuota, su flujo y su interés; acá van dos renglones con cuatro cifras.
//
// POR QUÉ SOBREVIVE SIENDO LO ÚNICO QUE SOBREVIVIÓ: el interés total del crédito no
// lo dice ninguna otra superficie del informe. Ni la matriz pie × plazo del capítulo,
// ni la grilla del pop-up —que muestra veredicto y score—, ni el PDF. Y no es una
// omisión que se pueda tapar con otra vista: las tres trabajan dentro de los diez
// años que el informe proyecta, y este costo vive a 25 o 30.
//
// POR QUÉ VA PEGADA A LA MATRIZ: medido sobre 300 análisis, de los 169 que pueden
// estirar la TIR a 10 años SUBE en 127 (75%). O sea que la matriz, sola, dice
// «estirá siempre» con cara de dato. La línea es lo que la contesta; separadas,
// pierden el razonamiento.
//
// ⛔ POR QUÉ SON DOS RENGLONES Y NO UNO. Se probaron las formas cortas de nombrar las
// dos direcciones en una sola línea («acortar corre al revés», «cada 5 años de
// plazo») y las dos AFIRMAN UNA SIMETRÍA QUE NO EXISTE. La cuota es convexa: medido
// en filas reales, estirar 25→30 compra $84.337 de alivio por $26,9M de interés,
// mientras acortar 25→20 cuesta $131.817 por $25,6M. Por el mismo movimiento de
// interés, el peso que ganas estirando sale 1,6 veces más caro que el que devuelves
// acortando. Una sola dirección deja al lector suponiendo el espejo, que es
// justamente lo que el dato desmiente.
// ════════════════════════════════════════════════════════════════════════════

import type { NivelPlazo } from "@/lib/analysis";
import { fmtMoney, fmtAxisMoney } from "@/components/analysis/utils";

type Currency = "CLP" | "UF";

/** Tolerancia del invariante, en pesos. La misma que tenía la escalera. */
const TOLERANCIA_FLUJO = 1000;

/**
 * Guarda del invariante, heredada de `EscaleraPlazo`: el nivel declarado tiene que
 * reproducir el flujo que el informe ya muestra. Si diverge, la línea se calla — nunca
 * un delta contra un "hoy" que contradice el número del hero.
 *
 * Verificado sobre 291 análisis del parque cuando se escribió la escalera: 291/291
 * reproducen el flujo (delta mediana 0), 291/291 tienen interés monótono en el plazo y
 * 291/291 cuadran con la cuota y el crédito persistidos.
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

export function LineaPlazo({
  niveles,
  valorUF,
  flujoPersistido,
  currency,
}: {
  /** Ya calculados por `simularPlazo` (LTR) o `simularPlazoStr` (STR). No se recalcula acá. */
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
  const interes = (uf: number) => fmtAxisMoney(Math.abs(uf) * valorUF, currency, valorUF);

  const masLargo = niveles[niveles.length - 1];

  // ── EN EL TOPE ── 25,6% de las filas LTR y 32,8% de las STR ya están en 30 años.
  // A esa gente no se le ofrece estirar —no hay adónde— y el par sería la misma línea
  // repetida: se dice lo que cuesta estar donde está, que es la única dirección que tiene.
  if (actual.plazoAnios >= masLargo.plazoAnios) {
    const previo = niveles[niveles.length - 2];
    if (!previo) return null;
    return (
      <p className="doc-reparto linea-plazo">
        Ya estás en el plazo más largo que dan los bancos. Acortar a {previo.plazoAnios} te sube la
        cuota <b>{money(previo.cuotaMensual - actual.cuotaMensual)}</b> al mes y te ahorra{" "}
        <b>{interes(actual.interesTotalUF - previo.interesTotalUF)}</b> de interés.
      </p>
    );
  }

  // ── EL PAR ── una dirección por renglón, cada una con sus dos cifras. El renglón de
  // acortar solo existe si hay un tramo más corto: quien está en el mínimo (15 años) no
  // tiene adónde bajar y recibe una línea sola, no un par cojo.
  //
  // Arriba va el TOPE (30) y abajo el tramo inmediatamente más corto, no el mínimo: desde
  // 25 el par habla de 30 y de 20. Bajar dos tramos de una daría una cifra que el lector no
  // puede encadenar con la de arriba.
  const arriba = masLargo;
  const masCortos = niveles.filter((n) => n.plazoAnios < actual.plazoAnios);
  const abajo = masCortos.length > 0 ? masCortos[masCortos.length - 1] : null;

  return (
    <div className="linea-plazo">
      <p className="doc-reparto">
        Estirar a {arriba.plazoAnios} años: <b>{money(arriba.flujoMensual - actual.flujoMensual)}</b> más
        al mes, <b>{interes(arriba.interesTotalUF - actual.interesTotalUF)}</b> más de interés.
      </p>
      {abajo && (
        <p className="doc-reparto">
          Acortar a {abajo.plazoAnios}: <b>{money(actual.flujoMensual - abajo.flujoMensual)}</b> menos al
          mes, <b>{interes(actual.interesTotalUF - abajo.interesTotalUF)}</b> menos de interés.
        </p>
      )}
    </div>
  );
}

