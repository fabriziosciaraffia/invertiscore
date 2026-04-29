"use client";

import type { ZoneInsightData, ZonePOI } from "@/hooks/useZoneInsight";

type CategoryKey = keyof ZoneInsightData["pois"];

const CATEGORY_ORDER: CategoryKey[] = [
  "metro",
  "trenes",
  "parques",
  "clinicas",
  "universidades",
  "institutos",
  "colegios",
  "malls",
  "negocios",
];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  metro: "Transporte (metro)",
  trenes: "Transporte (tren)",
  parques: "Parques y vida barrial",
  clinicas: "Salud (clínicas y hospitales)",
  universidades: "Universidades",
  institutos: "Institutos profesionales",
  colegios: "Colegios principales",
  malls: "Centros comerciales",
  negocios: "Zonas de negocios",
};

const CATEGORY_COLOR: Record<CategoryKey, string> = {
  metro: "#EF4444",
  trenes: "#F59E0B",
  parques: "#84CC16",
  clinicas: "#10B981",
  universidades: "#3B82F6",
  institutos: "#8B5CF6",
  colegios: "#6366F1",
  malls: "#EC4899",
  negocios: "#A855F7",
};

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

interface Props {
  pois: ZoneInsightData["pois"];
}

export function ZonePOIsList({ pois }: Props) {
  const nonEmpty = CATEGORY_ORDER.filter((k) => pois[k].length > 0);
  if (nonEmpty.length === 0) {
    return (
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0">
        No encontramos atractores urbanos dentro de 2,5 km. Zona de baja densidad.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {nonEmpty.map((k) => {
        const list = pois[k];
        const color = CATEGORY_COLOR[k];
        return (
          <div
            key={k}
            style={{
              borderLeft: `3px solid ${color}`,
              background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
              borderRadius: "0 8px 8px 0",
              padding: "14px 16px",
            }}
          >
            <div className="flex items-baseline gap-2 mb-2">
              <span
                className="w-2 h-2 rounded-full shrink-0 relative top-[-1px]"
                style={{ background: color }}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] font-semibold text-[var(--franco-text)]">
                {CATEGORY_LABELS[k]}
              </span>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.06em]"
                style={{ color: "var(--franco-text-secondary)" }}
              >
                · {list.length} {list.length === 1 ? "lugar" : "lugares"}
              </span>
            </div>
            <ul className="list-none p-0 m-0 flex flex-col">
              {list.map((poi: ZonePOI, i: number) => {
                const close = poi.distancia < 500;
                return (
                  <li
                    key={`${poi.nombre}-${i}`}
                    className="flex items-center justify-between gap-3 py-1.5"
                    style={{
                      borderTop:
                        i === 0
                          ? "none"
                          : "1px dashed color-mix(in srgb, var(--franco-text) 12%, transparent)",
                    }}
                  >
                    <span className="font-body text-[12px] md:text-[13px] text-[var(--franco-text)] truncate">
                      {poi.nombre}
                      {poi.linea ? (
                        <span
                          className="font-mono text-[10px] ml-1.5"
                          style={{ color: "var(--franco-text-secondary)" }}
                        >
                          ({poi.linea})
                        </span>
                      ) : null}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {close && (
                        <span
                          className="inline-flex items-center gap-1 font-mono uppercase"
                          title="A menos de 500 m caminando (menos de 7 min)"
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.06em",
                            color: "var(--ink-400)",
                            background: "color-mix(in srgb, var(--ink-400) 10%, transparent)",
                            border: "0.5px solid color-mix(in srgb, var(--ink-400) 28%, transparent)",
                            borderRadius: 3,
                            padding: "2px 6px",
                          }}
                        >
                          <span
                            className="zone-pulse-dot inline-block rounded-full"
                            style={{ width: 5, height: 5, background: "var(--ink-400)" }}
                          />
                          Cerca
                        </span>
                      )}
                      <span
                        className="font-mono text-[11px]"
                        style={{
                          color: close ? "var(--ink-400)" : "var(--franco-text-secondary)",
                          fontWeight: close ? 600 : 400,
                        }}
                      >
                        {formatDistance(poi.distancia)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
