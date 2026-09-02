"use client";

import type { ReactNode } from "react";
import type { ZoneInsightData } from "@/hooks/useZoneInsight";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";

/**
 * LA ZONA — sección del informe (contrato CONGELADO 02-sep-2026, T4).
 *
 * Un párrafo de síntesis (la IA de zona que ya existe) + tres celdas con nombre
 * en fácil, cada una con la cifra de la zona y su comparación contra el sujeto:
 *   · Precio del m² en la comuna    → tu depto: UF X · N% sobre/bajo
 *   · Arriendo típico de esta zona  → tu arriendo: $X · percentil, dónde cae
 *   · Valorización en 10 años       → Santiago: N% · tu proyección usa 3% anual
 * Cierra con «Explorar →», que abre el drawer de zona (mapa, lugares, fuente).
 *
 * Reemplaza la card recesiva "Lo que no ves a simple vista". Misma degradación
 * declarada: si la zona no cargó, se dice, y el enlace sigue vivo.
 */

const PROY_PCT = `${Math.round(PLUSVALIA_PROYECCION_ANUAL * 100)}%`;

/** Síntesis CORTA de la sección (ajuste de Fabrizio 02-sep): el titular del
 *  zone_insight + las dos primeras oraciones del insight, ~40 palabras. La prosa
 *  completa vive solo en el drawer. Si las dos oraciones pasan de 45 palabras,
 *  queda una. Sin titular (insights viejos), solo las oraciones. */
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

/** Corta en el n-ésimo fin de oración (`. ? !` seguido de espacio o fin). Los
 *  puntos de miles ($778.000) no cortan porque no van seguidos de espacio. */
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

const pct1 = (n: number) => n.toFixed(1).replace(".", ",");
const fmtCLP = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const fmtUFn = (n: number) => `UF ${pct1(n)}`;
const fmtMil = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1).replace(".", ",")} MM` : `$${Math.round(n / 1000)} mil`);

/** Las tres celdas — compartidas por la sección y por el drawer (mismos datos, misma lectura). */
export function ZonaCeldas({
  stats,
  currency,
  valorUF,
  arriendoUsuarioCLP,
}: {
  stats: ZoneInsightData["stats"];
  currency: "CLP" | "UF";
  valorUF: number;
  arriendoUsuarioCLP: number;
}) {
  const m2 = stats.precioM2;
  const of = stats.ofertaComparable;
  const plus = stats.plusvaliaHistorica;
  const fmtM2 = (uf: number) => (currency === "UF" ? fmtUFn(uf) : fmtCLP(uf * (valorUF || 0)));
  const fmtArr = (clp: number) => (currency === "UF" ? `UF ${pct1(valorUF > 0 ? clp / valorUF : 0)}` : fmtMil(clp));

  const celdaM2: { v: string; s: ReactNode } = m2
    ? {
        v: fmtM2(m2.medianaComuna),
        s: (
          <>
            Tu depto: <b>{fmtM2(m2.tuDepto)}</b> · {pct1(Math.abs(m2.diffPct))}% {m2.diffPct >= 0 ? "sobre" : "bajo"} la mediana
          </>
        ),
      }
    : { v: "—", s: "Sin mediana comparable para esta comuna." };

  const celdaArr: { v: string; s: ReactNode } = of
    ? {
        v: `${fmtArr(of.rangoArriendoMin)}–${fmtArr(of.rangoArriendoMax)}`,
        s:
          arriendoUsuarioCLP > 0 ? (
            <>
              Tu arriendo: <b>{fmtArr(arriendoUsuarioCLP)}</b> ·{" "}
              {of.percentilTuDepto === 0
                ? "bajo el rango"
                : of.percentilTuDepto >= 80
                  ? `P${of.percentilTuDepto}, en el tope del rango`
                  : `P${of.percentilTuDepto}, en el rango medio`}{" "}
              de {of.totalDeptos} avisos
            </>
          ) : (
            <>{of.totalDeptos} avisos de arriendo activos</>
          ),
      }
    : { v: "—", s: "Sin avisos de arriendo comparables." };

  const mismaProy = Math.round(plus.anualizada * 10) === Math.round(PLUSVALIA_PROYECCION_ANUAL * 1000);
  const celdaPlus: { v: string; s: ReactNode } = {
    v: `${plus.valor}%`,
    s: (
      <>
        Gran Santiago: <b>{plus.promedioSantiago}%</b> ·{" "}
        {mismaProy ? `tu proyección usa el mismo ${PROY_PCT} anual` : `histórico ${pct1(plus.anualizada)}% al año; tu proyección usa ${PROY_PCT}`}
      </>
    ),
  };

  return (
    <div className="zona-cells">
      <div>
        <div className="k">Precio del m² en la comuna</div>
        <div className="v">{celdaM2.v}</div>
        <div className="s">{celdaM2.s}</div>
      </div>
      <div>
        <div className="k">Arriendo típico de esta zona</div>
        <div className="v">{celdaArr.v}</div>
        <div className="s">{celdaArr.s}</div>
      </div>
      <div>
        <div className="k">Valorización en 10 años</div>
        <div className="v">{celdaPlus.v}</div>
        <div className="s">{celdaPlus.s}</div>
      </div>
    </div>
  );
}

interface Props {
  data: ZoneInsightData | null;
  loading: boolean;
  error?: string | null;
  onClick: () => void;
  currency: "CLP" | "UF";
  valorUF?: number;
  arriendoUsuarioCLP?: number;
  comuna?: string;
}

export function ZoneInsightMiniCard({ data, loading, error, onClick, currency, valorUF = 0, arriendoUsuarioCLP = 0, comuna }: Props) {
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
  const avisos = data?.stats.ofertaComparable?.totalDeptos ?? 0;

  return (
    <div className="zona-sec">
      {(titular || sintesis) && (
        <p className="v-prosa zona-sint">
          {titular && <strong>{titular}.</strong>}
          {titular && sintesis ? " " : ""}
          {sintesis}
        </p>
      )}
      {data && <ZonaCeldas stats={data.stats} currency={currency} valorUF={valorUF} arriendoUsuarioCLP={arriendoUsuarioCLP} />}
      <div className="zona-foot">
        <div className="v-fuente" style={{ margin: 0 }}>
          {data
            ? `Zone insight Franco${avisos ? ` · ${avisos} avisos de arriendo en ${comuna ?? "la comuna"}` : ""}`
            : hasError
              ? "Zone insight Franco"
              : ""}
        </div>
        <button type="button" className="doc-lnk" onClick={onClick} disabled={loading && !data}>
          Explorar →
        </button>
      </div>
    </div>
  );
}
