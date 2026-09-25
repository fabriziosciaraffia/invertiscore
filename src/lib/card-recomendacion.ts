// ─────────────────────────────────────────────────────────────────────────────
// LA CARD «LA RECOMENDACIÓN DE FRANCO» — una sola construcción (25-sep-2026)
//
// Hasta el 25-sep la card se armaba dentro de cada hero (HeroLTR / HeroStrDictamen), con nueve
// argumentos que se calculaban ahí mismo. Desde que el TITULAR DE LA PORTADA lo escribe el motor
// y reproduce la card, la portada necesita la MISMA card, y armarla dos veces es la forma segura
// de que un día digan dos cosas. Acá vive la construcción; los heroes la dibujan y la portada
// escribe el titular desde ella (`titular-motor.ts`).
//
// Devuelve el bloque de «Lo que haría yo» (Comprar y Ajustar) y, en Buscar otra, la causa y la
// distancia de `CardBuscarOtra`. Sin lógica nueva: los argumentos son los que los heroes pasaban.
// ─────────────────────────────────────────────────────────────────────────────
import type { AnalisisInput, FullAnalysisResult, Hallazgo, HallazgoDistanciaVeredicto, HallazgoSensibilidad, Veredicto } from "./types";
import type { ShortTermResult } from "./engines/short-term-engine";
import type { SimulacionStr } from "./analysis/simular-str";
import type { BrazoSTR } from "./engines/short-term-score";
import { construirLoQueHariaYo, type BloqueLoQueHariaYo } from "./lo-que-haria-yo";
import { causaBuscarOtraLtr, causaBuscarOtraStr, distanciaBuscarOtra } from "./buscar-otra-copy";
import { resolverArriendoReferencia, resolverProcedenciaArriendo } from "./arriendo-referencia";
import { DIST_PREC_PTS } from "./distancia-veredicto-hallazgo";

export type CardRecomendacion = {
  /** El bloque de «Lo que haría yo». En Buscar otra se construye igual, pero la card no lo dibuja. */
  bloque: BloqueLoQueHariaYo | null;
  /** Solo Buscar otra: lo que dibuja `CardBuscarOtra`. */
  buscar: { causa: string; distancia: string | null } | null;
};

export function construirCardLtr(p: {
  veredicto: Veredicto;
  results: FullAnalysisResult | null | undefined;
  inputData: AnalisisInput | null | undefined;
  currency: "CLP" | "UF";
  valorUF: number;
}): CardRecomendacion {
  const { results, inputData } = p;
  const hallazgos = (results?.hallazgos ?? []) as Hallazgo[];
  const distanciaRow = hallazgos.find((h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto");
  const sensibilidadRow = hallazgos.find((h): h is HallazgoSensibilidad => h.id === "sensibilidad");
  const arriendo = Number(inputData?.arriendo ?? 0);
  const bloque = results
    ? construirLoQueHariaYo({
        veredicto: p.veredicto,
        distancia: distanciaRow ?? null,
        sensibilidad: sensibilidadRow ?? null,
        arriendoDeclaradoCLP: arriendo,
        // El mismo precio que el pop-up: «Poner ese pie cuesta» y «Pie el día uno» dicen lo mismo.
        precioUF: Number(inputData?.precio ?? 0),
        // DE DÓNDE SALIÓ EL ARRIENDO (12-sep-2026): la MISMA derivación que usa el prompt.
        // Tuyo → «Declaraste»; aceptaste la estimación de Franco → «Usamos …, la mediana de
        // tu zona»; sin referencia no se sabe → «El análisis usa …».
        verifica: (() => {
          if (!(arriendo > 0)) return null;
          const ref = resolverArriendoReferencia(inputData);
          return { cifraCLP: arriendo, procedencia: resolverProcedenciaArriendo(arriendo, ref), fuente: ref?.fuente };
        })(),
        currency: p.currency,
        valorUF: p.valorUF,
        // El otro margen de COMPRAR (12-sep-2026): el último precio que sigue siendo
        // Comprar, medido por el motor en el hallazgo de sensibilidad. Ausente en filas
        // viejas ⇒ la fila no va.
        precioMax: (() => {
          const uf = sensibilidadRow?.valor.precioMaximoComprarUF;
          const precio = Number(inputData?.precio ?? 0);
          return uf != null && precio > 0
            ? {
                uf,
                pct: Math.round((uf / precio - 1) * 1000) / 10,
                // A DÓNDE CAE SI PAGAS MÁS (15-sep-2026). La misma bisección ya lo evaluaba
                // y lo botaba adentro del predicado; ahora lo retiene. Ausente en filas
                // persistidas antes del campo ⇒ la segunda línea no va.
                caeA: sensibilidadRow?.valor.veredictoSobrePrecioMaximo ?? null,
              }
            : null;
        })(),
      })
    : null;
  // Sin combinación que ofrecer, la card dice por qué no conviene y a qué distancia queda
  // Comprar. Sin botón y sin pop-up. El texto sale de `buscar-otra-copy.ts`.
  const buscar =
    p.veredicto === "BUSCAR OTRA"
      ? {
          causa: causaBuscarOtraLtr({
            brazosGate1Activos: distanciaRow?.valor.brazosGate1Activos ?? [],
            arriendoCLP: arriendo,
            flujoMensualCLP: Number(results?.metrics?.flujoNetoMensual ?? 0),
            desviacionPct: results?.metrics?.precioVsComuna?.confiable ? results.metrics.precioVsComuna.desviacionPct ?? null : null,
          }),
          distancia: arriendo > 0 ? distanciaBuscarOtra(distanciaRow?.valor, "ltr") : null,
        }
      : null;
  return { bloque, buscar };
}

export function construirCardStr(p: {
  veredicto: Veredicto;
  results: ShortTermResult;
  simulacion: SimulacionStr | null;
  currency: "CLP" | "UF";
  valorUF: number;
}): CardRecomendacion {
  const { results, simulacion } = p;
  const hallazgos = (results.hallazgos ?? []) as Hallazgo[];
  const distancia = hallazgos.find((h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto");
  const fr = simulacion?.fronterasIngreso ?? null;
  const adr = results.metrics?.tarifaNoche ?? results.ejesAplicados?.adrFinal ?? results.escenarios.base.adrReferencia;
  // EL BLOQUE DETERMINISTA DE §5 (bloque C · 11-sep-2026): el MISMO constructor de LTR con
  // `modalidad: "str"`, y en COMPRAR las dos filas resueltas acá, que es donde vive el dato:
  //   · AGUANTA sale de la frontera de tarifa del motor (`fronterasIngreso.abajo`), con el
  //     número MEDIDO. Solo sin frontera dentro del rango explorado (−70%) aguanta «−70% o más».
  //   · VERIFICA solo si la tarifa la definiste tú (`adrFuente === "override"`).
  const bloque = construirLoQueHariaYo({
    modalidad: "str",
    // El mismo precio que el pop-up: «Poner ese pie cuesta» y «Pie el día uno» dicen lo mismo.
    precioUF: Number(simulacion?.fronteraPrecio?.precioUFActual ?? 0),
    veredicto: p.veredicto,
    distancia: distancia ?? null,
    currency: p.currency,
    valorUF: p.valorUF,
    // ⚠ SE PUBLICA EL NÚMERO MEDIDO (15-sep-2026): `firme` queda para el único caso donde «o
    // más» es lo honesto, sin frontera dentro del rango explorado (−70%).
    aguanta: fr
      ? fr.abajo
        ? { marginPct: Math.round((1 - fr.abajo.factor) * 1000) / 10, firme: false, caeA: fr.abajo.veredicto ?? null }
        : { marginPct: 70, firme: true, caeA: null }
      : null,
    verifica: results.adrFuente === "override" ? { cifraCLP: adr } : null,
    // El piso en pesos cuelga de la tarifa que USA el análisis, tuya o de la zona.
    montoMercadoCLP: adr,
    // El otro margen de COMPRAR: `fronteraPrecio.caeA` —el precio al que el veredicto cae
    // subiendo el precio—; el máximo es un paso de precisión por debajo.
    precioMax: (() => {
      const fp = simulacion?.fronteraPrecio ?? null;
      if (!fp?.caeA || !(fp.precioUFActual > 0)) return null;
      const uf = Math.floor(fp.precioUFActual * (fp.caeA.factor - DIST_PREC_PTS / 100));
      return uf > fp.precioUFActual
        ? { uf, pct: Math.round((uf / fp.precioUFActual - 1) * 1000) / 10, caeA: fp.caeA.veredicto ?? null }
        : null;
    })(),
  });
  const bePctMercado = (() => {
    const be = Number((results as { breakEvenPctDelMercado?: number }).breakEvenPctDelMercado);
    // El campo viaja como fracción (1,27) en unas filas y como porcentaje (127) en otras.
    return Number.isFinite(be) && be > 0 ? (be <= 5 ? be * 100 : be) : null;
  })();
  const buscar =
    p.veredicto === "BUSCAR OTRA"
      ? {
          causa: causaBuscarOtraStr({
            motivos: (results as { francoScore?: { gates?: { motivos?: BrazoSTR[] } } }).francoScore?.gates?.motivos ?? [],
            flujoMensualCLP: Number(results.escenarios?.base?.flujoCajaMensual ?? 0),
            breakEvenPctDelMercado: bePctMercado,
          }),
          distancia: distanciaBuscarOtra(distancia?.valor, "str"),
        }
      : null;
  return { bloque, buscar };
}
