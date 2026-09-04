"use client";

import type { ReactNode } from "react";
import type { ZoneInsightData } from "@/hooks/useZoneInsight";
import type { HallazgoSobreprecio } from "@/lib/types";
import { fechaCortaCL } from "@/lib/fecha-cl";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";
import { PLUSVALIA_DEFAULT_RANGO, PLUSVALIA_ESTIMADO, PLUSVALIA_ESTIMADO_DEFAULT } from "@/lib/plusvalia-estimado.gen";
import { VFuente, VProsa } from "@/components/analysis/hallazgos/vocabulario";

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

const FUENTE_LABEL: Record<string, string> = { arenas_cayo: "Arenas & Cayo", gfk: "GfK" };

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

  const serie = PLUSVALIA_ESTIMADO[p.comuna];
  const valorizacion = serie
    ? { valor10: serie.plusvalia10a, anualizada: serie.anualizada, fuente: FUENTE_LABEL[serie.fuente] ?? serie.fuente, rango: serie.rangoHist, propia: true }
    : { valor10: PLUSVALIA_ESTIMADO_DEFAULT.plusvalia10a, anualizada: PLUSVALIA_ESTIMADO_DEFAULT.anualizada, fuente: "promedio Gran Santiago", rango: PLUSVALIA_DEFAULT_RANGO, propia: false };

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

/** Síntesis CORTA de la sección: el titular del zone_insight + las dos primeras oraciones
 *  del insight, ~40 palabras. La prosa completa vive solo en el drawer. Si las dos
 *  oraciones pasan de 45 palabras, queda una. Sin titular (insights viejos), solo las
 *  oraciones. */
function pickSintesis(data: ZoneInsightData | null, currency: "CLP" | "UF"): { titular: string; texto: string } {
  if (!data) return { titular: "", texto: "" };
  const i = data.insight;
  const clp = currency === "CLP";
  const titular = ((clp ? i.headline_clp : i.headline_uf) || i.headline_clp || "").trim().replace(/[.:;]+$/, "");
  const fuente = (clp ? i.narrative_clp : i.narrative_uf) || (clp ? i.preview_clp : i.preview_uf) || "";
  let texto = primerasOraciones(fuente, 2);
  if (palabras(texto) > 45) texto = primerasOraciones(fuente, 1);
  return { titular, texto };
}

const palabras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** Corta en el n-ésimo fin de oración (`. ? !` seguido de espacio o fin). Los puntos de
 *  miles ($778.000) no cortan porque no van seguidos de espacio. */
function primerasOraciones(texto: string, n: number): string {
  const t = texto.trim();
  const re = /[.!?](?=\s|$)/g;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    k += 1;
    if (k === n) return t.slice(0, m.index + 1);
  }
  return t;
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
}: {
  data: ZoneInsightData | null;
  loading: boolean;
  error?: string | null;
  onClick: () => void;
  currency: "CLP" | "UF";
  valorUF: number;
  zona: ZonaLtr;
}) {
  const hasError = !!error && !data;
  const esCoords = !!error && (/\b400\b/.test(error) || /coordenada/i.test(error));
  const sint = pickSintesis(data, currency);
  const sintesis = hasError
    ? esCoords
      ? "Zona no disponible para esta dirección."
      : "No pudimos cargar la zona ahora."
    : loading && !data
      ? "Analizando transporte, servicios y demanda de la zona…"
      : sint.texto;
  const titular = hasError || (loading && !data) ? "" : sint.titular;

  return (
    <div>
      {(titular || sintesis) && (
        <VProsa>
          {titular && <strong>{titular}.</strong>}
          {titular && sintesis ? " " : ""}
          {sintesis}
        </VProsa>
      )}
      <ZonaCeldasLtr zona={zona} currency={currency} valorUF={valorUF} cargando={loading && !data} />
      <div className="zona-foot">
        <VFuente>{fuenteZonaLtr(zona)}</VFuente>
        <button type="button" className="doc-lnk" onClick={onClick} disabled={loading && !data}>
          Explorar →
        </button>
      </div>
    </div>
  );
}
