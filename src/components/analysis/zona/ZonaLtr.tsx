"use client";

import type { ReactNode } from "react";
import type { ZoneInsightData } from "@/hooks/useZoneInsight";
import type { HallazgoSobreprecio } from "@/lib/types";
import { fechaCortaCL } from "@/lib/fecha-cl";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";
import { PLUSVALIA_ESTIMADO_DEFAULT } from "@/lib/plusvalia-estimado.gen";
import { procedenciaPlusvalia } from "@/lib/plusvalia-procedencia";
import { VFuente, VProsa } from "@/components/analysis/hallazgos/vocabulario";
import {
  fmtRadioArriendo,
  resolverArriendoReferencia,
  respaldoArriendo,
  type EstadoRespaldoArriendo,
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

/** Las tres celdas — las usa la sección y el drawer Explorar (mismos datos, misma lectura). */
export function ZonaCeldasLtr({ zona, currency, valorUF, cargando = false }: { zona: ZonaLtr; currency: "CLP" | "UF"; valorUF: number; cargando?: boolean }) {
  const fmtM2 = (uf: number) => (currency === "UF" ? `UF ${pct1(uf)}` : fmtCLP(uf * (valorUF || 0)));
  const fmtArr = (clp: number) => (currency === "UF" ? `UF ${pct1(valorUF > 0 ? clp / valorUF : 0)}` : fmtMil(clp));
  const fecha = (iso: string) => fechaCortaCL(iso);
  const { m2, arriendo: ar, valorizacion: pl } = zona;
  const universo = m2?.universo === "nuevo" ? " nuevos" : m2?.universo === "usado" ? " usados" : "";
  const desv = m2 ? (Math.abs(m2.desviacionPct) < 0.5 ? "en la mediana" : `${pct1(Math.abs(m2.desviacionPct))}% ${m2.desviacionPct > 0 ? "sobre" : "bajo"} la mediana`) : "";
  const posicion = ar?.posicion === "dentro" ? "dentro del rango" : ar?.posicion === "sobre" ? "sobre el rango" : ar?.posicion === "bajo" ? "bajo el rango" : null;

  return (
    <div className="zona-cells">
      <div>
        <p className="k">Precio del m² en la comuna</p>
        <p className="v">{m2 ? fmtM2(m2.mediana) : "sin datos suficientes"}</p>
        {m2 && (
          <p className="s">
            Tu depto: <b>{fmtM2(m2.tuya)}</b> · {desv} · mediana de {m2.n} publicaciones de venta de deptos{universo} · {fecha(m2.fecha)}
          </p>
        )}
      </div>
      <div>
        <p className="k">Arriendo típico de esta zona</p>
        <p className="v">{ar ? `${fmtArr(ar.min)}–${fmtArr(ar.max)}` : cargando ? "…" : "sin datos suficientes"}</p>
        {ar && (
          <p className="s">
            {ar.tuyo > 0 && posicion ? (
              <>
                Tu arriendo: <b>{fmtArr(ar.tuyo)}</b> · {posicion} ·{" "}
              </>
            ) : null}
            {ar.n} avisos activos{ar.fecha ? ` · ${fecha(ar.fecha)}` : ""}
          </p>
        )}
      </div>
      <div>
        <p className="k">Valorización en 10 años</p>
        <p className="v">{pl.valor10}%</p>
        <p className="s">
          {pl.propia ? (
            <>
              <b>{pct1(pl.anualizada)}%</b> al año · {pl.fuente} {pl.rango} · tu proyección usa {PROY_PCT}
            </>
          ) : (
            <>
              promedio Gran Santiago {pl.rango}: la comuna no tiene serie propia · <b>{pct1(pl.anualizada)}%</b> al año · tu proyección usa {PROY_PCT}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * Síntesis determinista (goal "síntesis de zona LTR", 05-sep-2026): una oración por celda
 * con dato, unidas como en STR. La escribe el motor desde las MISMAS celdas; la IA no abre
 * la zona (la prosa cacheada en zone_insight contradecía las celdas: "sin data de precio
 * m²" con la mediana dos líneas más abajo, percentiles que ya no se publican). Sin celda,
 * sin oración; la valorización solo con serie propia de la comuna (el promedio Gran
 * Santiago no es dato de la comuna). Sin ninguna, "Sin datos suficientes de la zona."
 */
export function sintesisZonaLtr(zona: ZonaLtr): string {
  const partes: string[] = [];
  const { m2, arriendo: ar, valorizacion: pl } = zona;
  if (m2) {
    partes.push(
      Math.abs(m2.desviacionPct) < 0.5
        ? "tu precio por m² está en la mediana de la comuna"
        : `tu precio por m² está ${pct1(Math.abs(m2.desviacionPct))}% ${m2.desviacionPct > 0 ? "sobre" : "bajo"} la mediana de la comuna`,
    );
  }
  if (ar && ar.tuyo > 0 && ar.posicion) {
    partes.push(`tu arriendo está ${ar.posicion === "dentro" ? "dentro del" : ar.posicion === "sobre" ? "sobre el" : "bajo el"} rango de la zona`);
  }
  if (pl.propia) {
    partes.push(pl.anualizada < 0 ? `la comuna perdió ${pct1(Math.abs(pl.anualizada))}% al año` : `la comuna se valorizó ${pct1(pl.anualizada)}% al año`);
  }
  if (!partes.length) return "Sin datos suficientes de la zona.";
  const texto = partes.join(" · ");
  return texto.charAt(0).toUpperCase() + texto.slice(1) + ".";
}

export function fuenteZonaLtr(zona: ZonaLtr): ReactNode {
  const partes: string[] = [];
  if (zona.m2) partes.push(`mediana comunal: ${zona.m2.n} publicaciones de venta`);
  if (zona.arriendo) partes.push(`arriendos: ${zona.arriendo.n} avisos activos`);
  partes.push(`valorización: ${zona.valorizacion.fuente} ${zona.valorizacion.rango}`);
  return partes.join(" · ");
}

export function ZonaLtrSection({
  data,
  loading,
  error,
  onClick,
  currency,
  valorUF,
  zona,
  zonaR2,
}: {
  data: ZoneInsightData | null;
  loading: boolean;
  error?: string | null;
  onClick: () => void;
  currency: "CLP" | "UF";
  valorUF: number;
  zona: ZonaLtr;
  /** Contrato §8. Lo arma el caller con `buildZonaLtrR2`. Ausente ⇒ las celdas de
   *  siempre (es un dato que falta, no un interruptor). */
  zonaR2?: ZonaLtrR2;
}) {
  void data;
  void error;
  const sintesis = sintesisZonaLtr(zona);
  const r2 = zonaR2 ?? null;

  return (
    <div>
      <VProsa>{sintesis}</VProsa>
      {r2 ? (
        <ZonaCeldasLtrR2 zona={r2} currency={currency} valorUF={valorUF} cargando={loading && !data} />
      ) : (
        <ZonaCeldasLtr zona={zona} currency={currency} valorUF={valorUF} cargando={loading && !data} />
      )}
      <div className="zona-foot">
        {/* La procedencia de cada tarjeta ya está en su propia línea y el período de la
            valorización en el pie común: repetirla acá sería decir lo mismo tres veces.
            El enlace lo nombra el contrato §8. */}
        {r2 ? <span /> : <VFuente>{fuenteZonaLtr(zona)}</VFuente>}
        <button type="button" className="doc-lnk" onClick={onClick} disabled={loading && !data}>
          {r2 ? "Ver los comparables →" : "Explorar →"}
        </button>
      </div>
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
  /** Tu arriendo contra la mediana del radio. `null` = no hay con qué contrastar. */
  arriendo:
    | {
        tuyo: number;
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
          tuyo,
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
  const { arriendo: ar, m2, valorizacion: pl } = zona;

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
          <p className="zc-v">{ar && ar.tuyo > 0 ? fmtArr(ar.tuyo) : cargando ? "…" : "—"}</p>
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
