import { MapPin } from "lucide-react";
import type { MarketDataRow } from "@/lib/market-data";
import type { AnalisisInput } from "@/lib/types";
import { fmtCLP, fmtPct, normalizeMetrics } from "./utils";

/**
 * Comparación tu/zona en 3 KPIs (precio/m², arriendo, rent. bruta) + mapa.
 * Move verbatim desde results-client.tsx LTR (Ronda 4a.1). Hoy sin usages
 * activos en LTR — preservada para reuso futuro.
 *
 * Prefiere zonaRadio (radius-based) sobre zoneData (comuna-level). Si no hay
 * datos en ninguno, retorna mensaje "no disponible".
 */
export function ZoneComparisonCards({
  m,
  zoneData,
  comuna,
  currency,
  fmt,
  mapQuery,
  googleMapUrl,
  inputData,
  valorUF,
}: {
  m: ReturnType<typeof normalizeMetrics>;
  zoneData: MarketDataRow[] | null | undefined;
  comuna?: string;
  currency: "CLP" | "UF";
  fmt: (n: number) => string;
  mapQuery: string;
  googleMapUrl: string;
  inputData?: AnalisisInput;
  valorUF: number;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zonaRadio = (inputData as any)?.zonaRadio as { precioM2VentaCLP?: number; arriendoPromedio?: number; arriendoPrecioM2?: number; sampleSizeArriendo?: number; sampleSizeVenta?: number; radioMetros?: number } | undefined;
  const hasRadioData = zonaRadio && (zonaRadio.precioM2VentaCLP || zonaRadio.arriendoPromedio);

  if (!m) {
    return <p className="text-sm text-[var(--franco-text-secondary)]">Datos de mercado no disponibles.</p>;
  }

  // Prefer radius-based data; fallback to comuna-level market_data
  let avgArriendoZona: number;
  let avgM2Zona: number; // UF/m²
  let totalPubs: number;
  let sourceLabel: string;

  if (hasRadioData) {
    avgArriendoZona = zonaRadio.arriendoPromedio || 0;
    avgM2Zona = zonaRadio.precioM2VentaCLP ? Math.round(zonaRadio.precioM2VentaCLP / valorUF * 10) / 10 : 0;
    totalPubs = Math.max(zonaRadio.sampleSizeArriendo || 0, zonaRadio.sampleSizeVenta || 0);
    sourceLabel = `Basado en ${totalPubs} comparables en radio de ${zonaRadio.radioMetros || 800}m.`;
  } else if (zoneData && zoneData.length > 0) {
    avgArriendoZona = Math.round(zoneData.reduce((s, d) => s + d.arriendo_promedio, 0) / zoneData.length);
    avgM2Zona = Math.round(zoneData.reduce((s, d) => s + d.precio_m2_promedio, 0) / zoneData.length * 10) / 10;
    totalPubs = zoneData.reduce((s, d) => s + d.numero_publicaciones, 0);
    sourceLabel = `Basado en ${totalPubs} publicaciones activas en ${comuna}.`;
  } else {
    return <p className="text-sm text-[var(--franco-text-secondary)]">Datos de mercado no disponibles para esta zona.</p>;
  }

  // Yield zona: derive from the same values shown in the ARRIENDO and PRECIO/M² cards
  // so that if tuyo == zona for both, rent. bruta also matches exactly
  const superficie = inputData?.superficie || 50;
  const precioTotalZonaCLP = avgM2Zona * superficie * valorUF;
  const yieldZona = precioTotalZonaCLP > 0 && avgArriendoZona > 0
    ? (avgArriendoZona * 12) / precioTotalZonaCLP * 100
    : (m.rentabilidadBruta ?? 0) * 0.9;

  const tuyoPrecioM2 = currency === "UF" ? m.precioM2 : m.precioM2 * valorUF;
  const zonaPrecioM2 = currency === "UF" ? avgM2Zona : avgM2Zona * valorUF;

  const cards = [
    {
      title: currency === "UF" ? "PRECIO/M² (UF)" : "PRECIO/M²",
      tuyo: tuyoPrecioM2,
      zona: zonaPrecioM2,
      fmtVal: (v: number) => currency === "UF" ? `UF ${v.toFixed(1).replace(".", ",")}` : fmtCLP(v),
      invertColor: true, // lower is better
    },
    {
      title: "ARRIENDO",
      tuyo: m.ingresoMensual,
      zona: avgArriendoZona,
      fmtVal: (v: number) => fmt(v),
      invertColor: false, // higher is better
    },
    {
      title: "RENT. BRUTA",
      tuyo: m.rentabilidadBruta,
      zona: Math.round(yieldZona * 100) / 100,
      fmtVal: (v: number) => fmtPct(v),
      invertColor: false, // higher is better
    },
  ];

  return (
    <div>
      <p className="text-xs text-[var(--franco-text-secondary)] mb-3">
        {sourceLabel}
        {hasRadioData && avgArriendoZona > 0 && m.ingresoMensual > 0 && (() => {
          const diff = ((m.ingresoMensual - avgArriendoZona) / avgArriendoZona) * 100;
          return Math.abs(diff) > 10 && diff < 0
            ? " La sugerencia de Franco usa la mediana (más conservadora que el promedio)."
            : null;
        })()}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {cards.map((c) => {
          const delta = c.zona !== 0 ? ((c.tuyo - c.zona) / c.zona) * 100 : 0;
          const isFavorable = c.invertColor ? delta < 0 : delta > 0;
          const deltaColor = isFavorable ? "text-[var(--franco-positive)]" : "text-signal-red";
          const deltaSign = delta > 0 ? "+" : "";
          const contextText = c.invertColor
            ? (delta < 0 ? "bajo el promedio" : "sobre el promedio")
            : (delta > 0 ? "sobre el promedio" : "bajo el promedio");
          return (
            <div key={c.title} className="bg-[var(--franco-elevated)] border border-[var(--franco-border)] rounded-[10px] p-4 text-center">
              <p className="font-body text-[10px] text-[var(--franco-text-secondary)] uppercase tracking-wide">{c.title}</p>
              <p className={`font-mono text-[32px] font-bold leading-none mt-1.5 ${deltaColor}`}>{deltaSign}{Math.round(delta)}%</p>
              <p className="font-body text-[10px] text-[var(--franco-text-muted)] mt-2">{contextText}</p>
              <div className="border-t border-[var(--franco-border)] mt-3 pt-2.5 space-y-1">
                <p className="text-[11px]"><span className="font-body text-[var(--franco-text-secondary)]">Tú: </span><span className="font-mono text-[var(--franco-text)]">{c.fmtVal(c.tuyo)}</span></p>
                <p className="text-[11px]"><span className="font-body text-[var(--franco-text-muted)]">Zona: </span><span className="font-mono text-[var(--franco-text-secondary)]">{c.fmtVal(c.zona)}</span></p>
              </div>
            </div>
          );
        })}
      </div>
      {/* Map */}
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-[var(--franco-text-secondary)]">
          <MapPin className="h-4 w-4" />
          <span>Ubicación: {mapQuery}</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-[var(--franco-border)]">
          <iframe src={googleMapUrl} width="100%" height="300" style={{ border: 0 }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Mapa de ubicación" />
        </div>
      </div>
    </div>
  );
}
