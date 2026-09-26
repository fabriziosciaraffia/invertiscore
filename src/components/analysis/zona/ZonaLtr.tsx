"use client";

import { useState, type ReactNode } from "react";
import type { ZoneInsightData } from "@/hooks/useZoneInsight";
import type { HallazgoSobreprecio } from "@/lib/types";
import { fechaCortaCL } from "@/lib/fecha-cl";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";
import { PLUSVALIA_ESTIMADO_DEFAULT } from "@/lib/plusvalia-estimado.gen";
import { procedenciaPlusvalia } from "@/lib/plusvalia-procedencia";
import { Modal, VProsa, VViz, VFuente } from "@/components/analysis/hallazgos/vocabulario";
import { FilaDato, FilasDato, Planilla, type FilaPlanilla } from "@/components/analysis/shared";
import { ZoneMap } from "@/components/zone-insight/ZoneMap";
import {
  fmtRadioArriendo,
  leerMuestraArriendo,
  resolverArriendoReferencia,
  respaldoArriendo,
  type EstadoRespaldoArriendo,
  type MuestraArriendo,
} from "@/lib/arriendo-referencia";
import { RANGO_GRAN_SANTIAGO } from "@/lib/plusvalia-procedencia";

/**
 * LA ZONA · LTR (goal "LTR hereda piezas compartidas", 05-sep-2026).
 *
 * Las mismas tres celdas que STR (`.zona-cells`), cada una con su cifra, la comparación
 * contra el sujeto y su procedencia {n, fecha}:
 *   · Precio del m² en la comuna — la MISMA mediana del hallazgo de sobreprecio
 *     (`hallazgoSobreprecio.valor`: mediana, n, universo) fechada con el `resolvedAt` del
 *     snapshot. Sin hallazgo → "sin datos suficientes". Murió la mediana viva sin
 *     procedencia del zone-insight: una sola mediana con la prosa y el hallazgo.
 *   · Arriendo típico de esta zona — rango P10–P90 de avisos activos del zone-insight con
 *     su n y su fecha (`asOf`, ausente en caches anteriores). La posición de tu arriendo
 *     es "dentro / sobre / bajo el rango", calculada acá contra el MISMO monto que se
 *     imprime. Sin percentil en ningún lado.
 *   · Valorización en 10 años — acumulado y anualizado de la serie de la comuna, con
 *     fuente y período del `.gen.ts`; comuna fuera de tabla → promedio Gran Santiago,
 *     dicho explícitamente.
 * La síntesis (IA de zona) y el botón Explorar siguen igual. Nada de acá recalcula.
 */

export interface ZonaLtr {
  m2: { mediana: number; tuya: number; desviacionPct: number; n: number; universo?: "nuevo" | "usado"; comuna: string; fecha: string } | null;
  arriendo: { min: number; max: number; n: number; tuyo: number; posicion: "dentro" | "sobre" | "bajo" | null; fecha: string | null } | null;
  valorizacion: { valor10: number; anualizada: number; fuente: string; rango: string; propia: boolean };
}

export function buildZonaLtr(p: {
  stats: ZoneInsightData["stats"] | null | undefined;
  sobre: HallazgoSobreprecio | null | undefined;
  medianaResolvedAt: string | null | undefined;
  arriendoUsuarioCLP: number;
  comuna: string;
}): ZonaLtr {
  const v = p.sobre?.valor;
  const m2 =
    v && v.medianaComunaUfM2 > 0 && v.n > 0
      ? {
          mediana: v.medianaComunaUfM2,
          tuya: v.sujetoUfM2,
          desviacionPct: v.desviacionPct,
          n: v.n,
          universo: v.universo,
          comuna: v.comuna || p.comuna,
          fecha: p.medianaResolvedAt || new Date().toISOString(),
        }
      : null;

  const of = p.stats?.ofertaComparable ?? null;
  const tuyo = p.arriendoUsuarioCLP > 0 ? p.arriendoUsuarioCLP : 0;
  const arriendo = of
    ? {
        min: of.rangoArriendoMin,
        max: of.rangoArriendoMax,
        n: of.totalDeptos,
        tuyo,
        posicion: (tuyo > 0 ? (tuyo < of.rangoArriendoMin ? "bajo" : tuyo > of.rangoArriendoMax ? "sobre" : "dentro") : null) as "dentro" | "sobre" | "bajo" | null,
        fecha: of.asOf ?? null,
      }
    : null;

  const proc = procedenciaPlusvalia(p.comuna);
  const valorizacion = proc.entry
    ? { valor10: proc.entry.plusvalia10a, anualizada: proc.entry.anualizada, fuente: proc.fuenteCorta, rango: proc.rango, propia: true }
    : { valor10: PLUSVALIA_ESTIMADO_DEFAULT.plusvalia10a, anualizada: PLUSVALIA_ESTIMADO_DEFAULT.anualizada, fuente: proc.fuenteCorta, rango: proc.rango, propia: false };

  return { m2, arriendo, valorizacion };
}

const PROY_PCT = `${Math.round(PLUSVALIA_PROYECCION_ANUAL * 100)}%`;
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");
const fmtCLP = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const fmtMil = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1).replace(".", ",")} MM` : `$${Math.round(n / 1000)} mil`);

export function ZonaLtrSection({
  data,
  loading,
  currency,
  valorUF,
  zonaR2,
  inputData,
  comuna,
  direccion,
  zoneCenter,
  onAbiertoChange,
}: {
  data: ZoneInsightData | null;
  loading: boolean;
  currency: "CLP" | "UF";
  valorUF: number;
  /** Contrato §8. Lo arma el caller con `buildZonaLtrR2`. */
  zonaR2: ZonaLtrR2;
  /** El input del análisis: de acá sale la muestra guardada (`leerMuestraArriendo`). */
  inputData: unknown;
  comuna: string;
  direccion?: string;
  zoneCenter?: { lat: number; lng: number } | null;
  /** Telemetría del caller: se entera cuando el modal abre y cierra. */
  onAbiertoChange?: (abierto: boolean) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const cambiar = (v: boolean) => {
    setAbierto(v);
    onAbiertoChange?.(v);
  };
  const sintesis = sintesisZonaLtrR2(zonaR2);

  return (
    <div>
      <VProsa>{sintesis}</VProsa>
      <ZonaCeldasLtrR2 zona={zonaR2} currency={currency} valorUF={valorUF} />
      <div className="zona-foot">
        {/* La procedencia de cada tarjeta ya está en su propia línea y el período de la
            valorización en el pie común. El enlace lo nombra el contrato §8. */}
        <span />
        <button type="button" className="doc-lnk" onClick={() => cambiar(true)}>
          Ver los comparables →
        </button>
      </div>
      <Modal abierto={abierto} onClose={() => cambiar(false)} titulo={`La zona · ${comuna}`} sub={direccion || undefined}>
        <ComparablesLtr
          zona={zonaR2}
          sintesis={sintesis}
          muestra={leerMuestraArriendo(inputData)}
          superficie={Number((inputData as { superficie?: unknown } | null)?.superficie) || 0}
          currency={currency}
          valorUF={valorUF}
          zoneInsight={data}
          zoneCargando={loading && !data}
          zoneCenter={zoneCenter ?? null}
          comuna={comuna}
        />
      </Modal>
    </div>
  );
}

/**
 * La síntesis de la zona desde las MISMAS cifras que las tres tarjetas del contrato §8: la
 * mediana de arriendo del RADIO (no el rango P10–P90 de la comuna, que era la segunda
 * referencia), tu m² contra la mediana comunal y la valorización propia de la comuna.
 * Determinista; sin dato, sin oración. La usan la card y el modal.
 */
export function sintesisZonaLtrR2(z: ZonaLtrR2): string {
  const partes: string[] = [];
  const ar = z.arriendo;
  if (ar && ar.brechaPct !== null && z.arriendoTuyo > 0) {
    const donde = ar.esRadio ? ` publicados a menos de ${fmtRadioArriendo(ar.radioMetros)}` : " de la comuna";
    const muestra = `${ar.n} ${ar.n === 1 ? "arriendo" : "arriendos"}${donde}`;
    partes.push(
      ar.brechaPct === 0
        ? `tu arriendo está en la mediana de ${muestra}`
        : `tu arriendo está ${Math.abs(ar.brechaPct)}% ${ar.brechaPct > 0 ? "sobre" : "bajo"} la mediana de ${muestra}`,
    );
  }
  const m2 = z.m2;
  if (m2 && m2.desviacionPct != null) {
    partes.push(
      Math.abs(m2.desviacionPct) < 0.5
        ? "tu precio por m² está en la mediana de la comuna"
        : `tu precio por m² está ${pct1(Math.abs(m2.desviacionPct))}% ${m2.desviacionPct > 0 ? "sobre" : "bajo"} la mediana de la comuna`,
    );
  }
  const pl = z.valorizacion;
  if (pl.propia) {
    partes.push(pl.anualizada < 0 ? `la comuna perdió ${pct1(Math.abs(pl.anualizada))}% al año` : `la comuna se valorizó ${pct1(pl.anualizada)}% al año`);
  }
  if (!partes.length) return "Sin datos suficientes de la zona.";
  const texto = partes.join(" · ");
  return texto.charAt(0).toUpperCase() + texto.slice(1) + ".";
}

/** Percentil lineal sobre una lista ya ordenada (mismo criterio que `comparables-radio`). */
function percentilOrdenado(xs: number[], p: number): number {
  const i = (p / 100) * (xs.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? xs[lo] : xs[lo] + (xs[hi] - xs[lo]) * (i - lo);
}

/** El cuerpo del modal de comparables. Exportado para el gate: se renderiza sin el Modal. */
export function ComparablesLtr({
  zona,
  sintesis,
  muestra,
  superficie,
  currency,
  valorUF,
  zoneInsight,
  zoneCargando,
  zoneCenter,
  comuna,
}: {
  zona: ZonaLtrR2;
  sintesis: string;
  muestra: MuestraArriendo | null;
  superficie: number;
  currency: "CLP" | "UF";
  valorUF: number;
  zoneInsight: ZoneInsightData | null;
  zoneCargando: boolean;
  zoneCenter: { lat: number; lng: number } | null;
  comuna: string;
}) {
  const money = (clp: number) => (currency === "UF" ? `UF ${pct1(valorUF > 0 ? clp / valorUF : 0)}` : fmtCLP(clp));
  const ar = zona.arriendo;
  const donde = ar ? (ar.esRadio ? `a menos de ${fmtRadioArriendo(ar.radioMetros)}` : "en la comuna") : "";

  let lista: ReactNode;
  if (!ar) {
    lista = (
      <VViz t="Arriendos cerca">
        <p className="v-copy">Sin arriendos publicados cerca para comparar: este análisis no tiene referencia de arriendo de la zona.</p>
      </VViz>
    );
  } else if (!muestra) {
    lista = (
      <VViz t={`Los ${ar.n} arriendos con los que se compara`}>
        <p className="v-copy">Este análisis guardó la mediana y cuántos avisos la forman, no los avisos. Los análisis nuevos guardan la lista.</p>
      </VViz>
    );
  } else {
    const conDorms = muestra.modo === "conDorms";
    const precios = muestra.avisos.map((a) => a.precio).sort((a, b) => a - b);
    const pm2 = muestra.avisos
      .filter((a) => a.m2 && a.m2 > 0)
      .map((a) => a.precio / (a.m2 as number))
      .sort((a, b) => a - b);
    const mitad = conDorms
      ? [percentilOrdenado(precios, 25), percentilOrdenado(precios, 75)]
      : pm2.length && superficie > 0
        ? [percentilOrdenado(pm2, 25) * superficie, percentilOrdenado(pm2, 75) * superficie]
        : null;
    const posicion =
      ar.brechaPct === null || zona.arriendoTuyo <= 0
        ? null
        : ar.brechaPct === 0
          ? "en la mediana"
          : `${Math.abs(ar.brechaPct)}% ${ar.brechaPct > 0 ? "sobre" : "bajo"} la mediana`;
    const filas: FilaPlanilla[] = muestra.avisos.map((a, i) => ({
      th: String(i + 1),
      celdas: [
        { v: a.distanciaM != null ? `${a.distanciaM.toLocaleString("es-CL")} m` : "—" },
        { v: money(a.precio) },
        { v: a.m2 != null ? a.m2.toLocaleString("es-CL") : "—" },
        { v: a.m2 ? money(a.precio / a.m2) : "—" },
      ],
    }));
    lista = (
      <VViz t={`Los ${ar.n} arriendos con los que se compara`}>
        <FilasDato>
          <FilaDato k="Dónde están" v={donde} />
          {conDorms ? (
            <FilaDato k="Mediana de sus arriendos" sub="la referencia de la card" v={money(ar.mediana)} unidad="/mes" tono="in" />
          ) : (
            <>
              <FilaDato k="Mediana del precio por m²" v={pm2.length ? money(percentilOrdenado(pm2, 50)) : "—"} unidad="/m²" />
              <FilaDato k={`× tus ${superficie.toLocaleString("es-CL")} m²`} sub="la referencia de la card" v={money(ar.mediana)} unidad="/mes" tono="in" />
            </>
          )}
          {mitad && (
            <FilaDato
              k="La mitad de los avisos"
              sub={conDorms ? undefined : `llevados a tus ${superficie.toLocaleString("es-CL")} m²`}
              v={`${money(mitad[0])} – ${money(mitad[1])}`}
            />
          )}
          {zona.arriendoTuyo > 0 && <FilaDato k="Tu arriendo" sub={posicion ?? undefined} v={money(zona.arriendoTuyo)} unidad="/mes" />}
        </FilasDato>
        <Planilla columnas={["#", "Distancia", "Arriendo", "m²", "Por m²"]} filas={filas} />
      </VViz>
    );
  }

  const m2 = zona.m2;
  const universo = m2?.universo === "nuevo" ? " nuevos" : m2?.universo === "usado" ? " usados" : "";
  const fuente = [
    ar ? `arriendos publicados ${donde} · ${ar.n} ${ar.n === 1 ? "aviso" : "avisos"}` : null,
    m2 && m2.mediana != null && m2.n > 0 ? `venta: ${m2.n} deptos${universo} de ${comuna}` : null,
    `valorización: ${zona.valorizacion.fuente} ${zona.valorizacion.rango}`,
    zoneInsight ? "lugares: Google Places" : null,
  ].filter(Boolean) as string[];
  const fuenteTxt = fuente.join(" · ");

  return (
    <div className="doc-tokens">
      <VProsa>{sintesis}</VProsa>
      <ZonaCeldasLtrR2 zona={zona} currency={currency} valorUF={valorUF} />
      {lista}
      {zoneCenter && zoneInsight && (
        <VViz t="El depto y lo que hay alrededor">
          <ZoneMap centerLat={zoneCenter.lat} centerLng={zoneCenter.lng} pois={zoneInsight.pois} />
        </VViz>
      )}
      {zoneInsight ? (
        <VViz t="Lugares a menos de 2,5 km">
          <ZonaLugares pois={zoneInsight.pois} />
        </VViz>
      ) : zoneCargando ? (
        <VViz t="Lugares a menos de 2,5 km">
          <p className="v-copy">…</p>
        </VViz>
      ) : null}
      <VFuente>{fuenteTxt.charAt(0).toUpperCase() + fuenteTxt.slice(1)}</VFuente>
    </div>
  );
}

const LUGAR_LABEL: Record<keyof ZoneInsightData["pois"], string> = {
  metro: "Metro",
  trenes: "Tren",
  parques: "Parque",
  clinicas: "Clínica",
  universidades: "Universidad",
  institutos: "Instituto",
  colegios: "Colegio",
  malls: "Centro comercial",
  negocios: "Zona de negocios",
};

/** Los lugares como filas (nombre · tipo y comuna · distancia), los más cercanos primero, y
 *  una línea con lo que NO hay en el radio. Vivía en `AnalysisDrawer`; se mudó con la zona. */
function ZonaLugares({ pois }: { pois: ZoneInsightData["pois"] }) {
  const cats = Object.keys(LUGAR_LABEL) as (keyof ZoneInsightData["pois"])[];
  const filas = cats
    .flatMap((k) => pois[k].map((p) => ({ ...p, tipo: LUGAR_LABEL[k] })))
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 8);
  const faltan = cats.filter((k) => pois[k].length === 0 && ["metro", "clinicas", "malls"].includes(k)).map((k) => LUGAR_LABEL[k].toLowerCase());
  const dist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
  if (filas.length === 0) {
    return <p className="zona-sin">No detectamos transporte, comercio ni servicios a menos de 2,5 km. Zona residencial periférica.</p>;
  }
  return (
    <div>
      {filas.map((p, i) => (
        <div key={`${p.nombre}-${i}`} className="lugar">
          <span className="n">{p.nombre}</span>
          <span className="d">{dist(p.distancia)}</span>
          <span className="t">
            {p.tipo}
            {p.linea ? ` · ${p.linea}` : ""}
            {p.comuna ? ` · ${p.comuna}` : ""}
          </span>
        </div>
      ))}
      {faltan.length > 0 && <p className="zona-sin">Sin {faltan.join(", ").replace(/, ([^,]*)$/, " ni $1")} en el radio</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LA ZONA DEL CONTRATO (§8) — tres tarjetas, el arriendo primero.

   NO ES UN RESTILADO DE LAS CELDAS DE ARRIBA: cambia QUÉ NÚMERO MANDA. Hoy la celda
   lidera con la REFERENCIA (la mediana comunal, el rango P10–P90) y el dato del lector
   va en la línea chica. El contrato lo invierte —tu valor grande, la referencia debajo,
   la diferencia en una píldora— porque la pregunta que trae el lector a esta sección es
   «¿cómo quedo yo?», no «cuánto vale la comuna».

   Y EL ARRIENDO VA PRIMERO porque es el único dato TUYO que puede quedar peor que la
   referencia, y es el número del que cuelga todo el análisis.

   LOS CUATRO DATOS SALEN DEL MOTOR. Ninguno se inventa:

     1. La mediana de arriendo del RADIO — `resolverArriendoReferencia(inputData)`, que
        es la fuente única del arriendo de referencia. No es la que la zona mostraba: la
        celda vieja usa `ofertaComparable`, que es un rango P10–P90 de la COMUNA entera,
        sin radio. O sea que el informe tenía dos referencias de arriendo distintas y la
        que trae procedencia geográfica era la que esta sección no usaba.
     2. El conteo de publicaciones y su radio — `n` y `radioMetros` de la misma fuente,
        formateados con `fmtRadioArriendo`, el MISMO formateador del caveat del capítulo
        II, para que el mismo dato no se imprima distinto en el mismo informe.
     3. Tu precio por m² — `input.precio / input.superficie`, la división y nada más.
        NO es un dato nuevo del motor: es exactamente lo que el motor divide en
        `analysis.ts:527` para armar `sujetoUfM2`. Se recalcula acá en vez de leer el
        hallazgo porque el hallazgo existe en 1.133 de 1.447 filas y la división existe
        siempre: así la tarjeta muestra tu número aunque no haya mediana con que
        compararlo. Va SIN estacionamiento, igual que el motor, para quedar en la misma
        base que la mediana comunal.
     4. La referencia de valorización — `PLUSVALIA_ESTIMADO_DEFAULT`, el promedio Gran
        Santiago. Hoy existe solo como FALLBACK cuando la comuna no tiene serie propia,
        así que en el 95% de las filas nunca se ve.

   EL CAVEAT DEL PERÍODO VA EN EL PIE COMÚN, y no es prolijidad: las 27 comunas con serie
   propia corren en TRES rangos distintos (2014-2024, 2015-2025, 2015-2024) y el promedio
   Gran Santiago es 2014-2024. En parte de los casos la píldora compara períodos que no
   son el mismo. El pie lo dice en vez de esconderlo.

   LAS PÍLDORAS NO INVENTAN SEMÁNTICA. Cada dirección sale de la que el código ya tenía:
     · arriendo — declarar POR ENCIMA de la mediana es el caso exigente. Es literal
       `respaldoArriendo`: «advertencia: brechaPct > 0», y por debajo lo llama
       conservador. Sobre → mal, bajo → bien, en la mediana → neutro.
     · m² — el hallazgo se llama «sobreprecio» y marca adverso cuando el sujeto está por
       encima. Sobre → mal, bajo → bien.
     · valorización — sobre el promedio → bien. Es la única de las tres donde «más» es
       mejor, y por eso es la única que puede pintarse de `--up`.
   ───────────────────────────────────────────────────────────────────────────── */

export interface ZonaLtrR2 {
  /** TU arriendo, SIEMPRE que lo haya (24-sep-2026). Vivía dentro de `arriendo`, que es
   *  `null` sin referencia de radio, y con él se perdía: 420 de 1.218 filas LTR (34%)
   *  mostraban «Tu arriendo —» con el arriendo declarado. Lo tuyo no depende de que haya
   *  con qué compararlo. */
  arriendoTuyo: number;
  /** La mediana del radio con que se contrasta. `null` = no hay con qué contrastar. */
  arriendo:
    | {
        mediana: number;
        n: number;
        radioMetros: number;
        /** Solo cuando la referencia es contrastable y la muestra alcanza. */
        brechaPct: number | null;
        /** Los cinco estados de `respaldoArriendo`, que deciden qué se dibuja. */
        estado: EstadoRespaldoArriendo;
        /** `false` en «comuna»: la muestra no es de un radio y la frase no lo dice. */
        esRadio: boolean;
      }
    | null;
  /** Tu UF/m² (siempre que haya precio y superficie) contra la mediana comunal. */
  m2:
    | {
        tuya: number;
        /** `null` = hay tu número pero no hay mediana confiable con que compararlo. */
        mediana: number | null;
        desviacionPct: number | null;
        n: number;
        universo?: "nuevo" | "usado";
        fecha: string;
      }
    | null;
  valorizacion: {
    valor10: number;
    anualizada: number;
    fuente: string;
    rango: string;
    propia: boolean;
    /** Promedio Gran Santiago, con su período. La referencia que hoy no se ve. */
    referencia10: number;
    rangoReferencia: string;
  };
}

export function buildZonaLtrR2(p: {
  base: ZonaLtr;
  inputData: unknown;
  arriendoUsuarioCLP: number;
  precioUF: number;
  superficie: number;
}): ZonaLtrR2 {
  const ref = resolverArriendoReferencia(p.inputData);
  const tuyo = p.arriendoUsuarioCLP > 0 ? p.arriendoUsuarioCLP : 0;
  const r = respaldoArriendo(p.inputData, tuyo);
  const arriendo =
    ref && r.estado !== "sin_referencia"
      ? {
          mediana: ref.valorCLP,
          n: ref.n,
          radioMetros: ref.radioMetros,
          brechaPct: r.brechaPct,
          estado: r.estado,
          esRadio: ref.fuente === "radio",
        }
      : null;

  // La división del motor, sin estacionamiento (analysis.ts:527). No es dato nuevo.
  const tuyaUfM2 = p.superficie > 0 && p.precioUF > 0 ? Math.round((p.precioUF / p.superficie) * 10) / 10 : 0;
  const m2 =
    tuyaUfM2 > 0
      ? {
          tuya: tuyaUfM2,
          mediana: p.base.m2 ? p.base.m2.mediana : null,
          desviacionPct: p.base.m2 ? p.base.m2.desviacionPct : null,
          n: p.base.m2?.n ?? 0,
          universo: p.base.m2?.universo,
          fecha: p.base.m2?.fecha ?? "",
        }
      : null;

  return {
    arriendoTuyo: tuyo,
    arriendo,
    m2,
    valorizacion: {
      ...p.base.valorizacion,
      referencia10: PLUSVALIA_ESTIMADO_DEFAULT.plusvalia10a,
      rangoReferencia: RANGO_GRAN_SANTIAGO,
    },
  };
}

type TonoPildora = "bien" | "mal" | "neu";

function Pildora({ tono, children }: { tono: TonoPildora; children: ReactNode }) {
  return <span className={`zp zp-${tono}`}>{children}</span>;
}

/** Las tres tarjetas del contrato §8. */
export function ZonaCeldasLtrR2({
  zona,
  currency,
  valorUF,
  cargando = false,
}: {
  zona: ZonaLtrR2;
  currency: "CLP" | "UF";
  valorUF: number;
  cargando?: boolean;
}) {
  // EL UF/m² VA SIN DECIMAL, y tu número y la mediana con la MISMA regla. Es la misma
  // decisión que ya tomó la referencia de los hallazgos («UF 92 · med 94»,
  // `referencia-hallazgo.ts`): un decimal sobre una mediana de N publicaciones es
  // precisión falsa, y la diferencia entre UF 92,0 y UF 92 es ruido. La precisión que
  // importa la lleva la píldora, que es el % de brecha. Redondear solo uno de los dos
  // sería peor que redondear los dos: el lector compararía cifras de distinta escala.
  const fmtM2 = (uf: number) =>
    currency === "UF" ? `UF ${Math.round(uf).toLocaleString("es-CL")}` : fmtCLP(uf * (valorUF || 0));
  const fmtArr = (clp: number) => (currency === "UF" ? `UF ${pct1(valorUF > 0 ? clp / valorUF : 0)}` : fmtMil(clp));
  const { arriendoTuyo: tuyo, arriendo: ar, m2, valorizacion: pl } = zona;

  // El período de la serie de la comuna contra el del promedio: si no son el mismo, la
  // comparación cruza períodos y eso se dice, no se esconde.
  const periodosDistintos = pl.propia && pl.rango !== pl.rangoReferencia;
  const deltaPl = pl.propia ? Math.round(pl.valor10 - pl.referencia10) : null;

  return (
    <>
      <div className="zona-cards">
        {/* 1 · TU ARRIENDO — primero, por el contrato */}
        <div className="zc">
          <p className="zc-k">Tu arriendo</p>
          <p className="zc-v">{tuyo > 0 ? fmtArr(tuyo) : cargando ? "…" : "—"}</p>
          {ar && ar.estado !== "orden_de_magnitud" ? (
            <p className="zc-r">mediana {fmtArr(ar.mediana)}</p>
          ) : (
            <p className="zc-r">&nbsp;</p>
          )}
          {ar && ar.brechaPct !== null ? (
            <Pildora tono={ar.brechaPct > 0 ? "mal" : ar.brechaPct < 0 ? "bien" : "neu"}>
              {ar.brechaPct === 0
                ? "en la mediana"
                : `${Math.abs(ar.brechaPct)}% ${ar.brechaPct > 0 ? "sobre" : "bajo"}`}
            </Pildora>
          ) : null}
          <p className="zc-s">{glosaArriendo(ar, cargando)}</p>
        </div>

        {/* 2 · TU PRECIO POR M² */}
        <div className="zc">
          <p className="zc-k">Tu precio por m²</p>
          <p className="zc-v">{m2 ? fmtM2(m2.tuya) : "—"}</p>
          <p className="zc-r">{m2 && m2.mediana != null ? `mediana ${fmtM2(m2.mediana)}` : <>&nbsp;</>}</p>
          {m2 && m2.desviacionPct != null ? (
            <Pildora tono={m2.desviacionPct > 0 ? "mal" : m2.desviacionPct < 0 ? "bien" : "neu"}>
              {Math.abs(m2.desviacionPct) < 0.5
                ? "en la mediana"
                : `${pct1(Math.abs(m2.desviacionPct))}% ${m2.desviacionPct > 0 ? "sobre" : "bajo"}`}
            </Pildora>
          ) : null}
          <p className="zc-s">{glosaM2(m2)}</p>
        </div>

        {/* 3 · VALORIZACIÓN — la única donde «más» es mejor */}
        <div className="zc">
          <p className="zc-k">Valorización en 10 años</p>
          <p className="zc-v">{pl.valor10}%</p>
          <p className="zc-r">{pl.propia ? `promedio Gran Santiago ${pl.referencia10}%` : <>&nbsp;</>}</p>
          {deltaPl !== null ? (
            <Pildora tono={deltaPl > 0 ? "bien" : deltaPl < 0 ? "mal" : "neu"}>
              {deltaPl === 0 ? "en el promedio" : `${Math.abs(deltaPl)} pts ${deltaPl > 0 ? "sobre" : "bajo"}`}
            </Pildora>
          ) : null}
          <p className="zc-s">
            {pl.propia ? (
              <>
                <b>{pct1(pl.anualizada)}%</b> al año · tu proyección usa {PROY_PCT}
              </>
            ) : (
              <>la comuna no tiene serie propia · tu proyección usa {PROY_PCT}</>
            )}
          </p>
        </div>
      </div>

      {/* EL PIE COMÚN: el caveat del período vive acá, no dentro de la tarjeta. */}
      <p className="zona-caveat">
        {pl.propia ? `Valorización: ${pl.fuente} ${pl.rango}` : `Valorización: ${pl.fuente} ${pl.rango}`}
        {periodosDistintos ? ` · el promedio Gran Santiago es ${pl.rangoReferencia}, o sea otro período` : ""}
        {". Es historia de la zona, no una promesa: tu proyección usa "}
        {PROY_PCT} al año.
      </p>
    </>
  );
}

/** La línea de contexto del arriendo. Una sola, y dice de dónde salió la muestra. */
function glosaArriendo(ar: ZonaLtrR2["arriendo"], cargando: boolean): ReactNode {
  if (!ar) {
    return cargando ? "…" : "Sin arriendos publicados cerca para comparar: este número lo pusiste tú.";
  }
  const donde = ar.esRadio ? `a menos de ${fmtRadioArriendo(ar.radioMetros)}` : "de la comuna";
  if (ar.estado === "orden_de_magnitud") {
    return `Estimado desde el m² de ${ar.n} arriendos de la comuna: es un orden de magnitud, no una mediana.`;
  }
  if (ar.estado === "muestra_chica") {
    return `Solo ${ar.n} ${ar.n === 1 ? "publicación" : "publicaciones"} ${donde}: muestra chica para contrastar.`;
  }
  return `${ar.n} ${ar.n === 1 ? "publicación" : "publicaciones"} ${donde}.`;
}

/** La línea de contexto del m². Sin mediana, dice que no la hay — no se calla. */
function glosaM2(m2: ZonaLtrR2["m2"]): ReactNode {
  if (!m2) return "Sin precio o superficie para calcularlo.";
  if (m2.mediana == null || m2.n <= 0) return "Sin mediana comunal de venta con que compararlo.";
  const universo = m2.universo === "nuevo" ? " nuevos" : m2.universo === "usado" ? " usados" : "";
  return `${m2.n} publicaciones de venta de deptos${universo}${m2.fecha ? ` · ${fechaCortaCL(m2.fecha)}` : ""}.`;
}
