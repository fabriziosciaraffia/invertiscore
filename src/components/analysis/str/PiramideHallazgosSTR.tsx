"use client";

// Pirámide de hallazgos STR (E.1b) — hermano de PiramideHallazgos (LTR). Reusa el mismo
// ORDEN ÚNICO (esquema C-umbral, orden-hallazgos.ts) y la matriz N-variable extendida
// (filasNivel3, N∈[5,12]); renderiza con GenericFindingCard (que ya tiene los casos
// findingDisplay de los 6 propios STR + los heredados LTR). La numeración continúa la
// del índice del hero (01-03 arriba, hasta 12 acá).
//
// A diferencia de la LTR, lee results.hallazgos directamente (el pipeline lo persistió con
// la pirámide completa) — no gathera de carriers del motor ni suprime eco de prosa (la
// pirámide STR vive como sección propia, separada de la prosa IA). E.2: las cards abren
// drawer vía onOpenDrawer + HALLAZGO_DRAWER_STR (el detalle ya no vive en un grid paralelo).

import type { Hallazgo } from "@/lib/types";
import { GenericFindingCard } from "@/components/analysis/GenericFindingCard";
import { filasNivel3 } from "@/lib/orden-hallazgos";
import { anchorHallazgo, numeroHallazgo } from "@/lib/orden-hallazgos";
// Orden extraído a módulo puro server-safe (lo consume también la vista documento).
// Re-exportado acá para no romper los importadores (results-client, DrawerSTR seq).
import { ordenarHallazgosPiramideSTR } from "@/lib/piramide-orden-str";
export { ordenarHallazgosPiramideSTR };
import type { DrawerKeySTR } from "./DrawerSTR";

// Mapa hallazgo → drawer STR. Cada card abre un drawer cuyo título calza con ella.
// rama drawers-propios (F2): los 6 que en E.2 eran chips solo-lectura o compartían
// drawer ahora tienen el suyo propio, motor-templated. estructura_costos_str deja de
// compartir `rentabilidad` y estrena `estructuraCostos`. Exportado: la navegación
// prev/next deriva de este mapa + el orden de la pirámide (un solo orden de verdad).
export const HALLAZGO_DRAWER_STR: Partial<Record<Hallazgo["id"], DrawerKeySTR>> = {
  rentabilidad_str: "rentabilidad",
  flujo_str: "sostenibilidad",
  sensibilidad_str: "sensibilidad",
  ventaja_vs_ltr: "ventajaLtr",
  ocupacion_vs_banda: "factibilidad",
  // Drawers propios F2 (antes heredados solo-lectura / compartido):
  estructura_financiamiento: "financiamiento",
  sobreprecio: "precio",
  tir: "retorno",
  patrimonio: "patrimonio",
  plusvalia: "plusvalia",
  estructura_costos_str: "estructuraCostos",
  // FASE 4: deja de ser la única card sin destino (55% de los informes STR).
  capex_puesta_a_punto: "capexPuestaAPunto",
};


export function PiramideHallazgosSTR({
  hallazgos,
  currency,
  valorUF,
  onOpenDrawer,
}: {
  hallazgos: Hallazgo[] | null | undefined;
  currency: "CLP" | "UF";
  valorUF: number;
  /** Abre el drawer de detalle de un hallazgo. Sin este callback, la pirámide
   *  renderiza sin affordance "Ver detalle" (estado E.1b). */
  onOpenDrawer?: (key: DrawerKeySTR) => void;
}) {
  const ordered = ordenarHallazgosPiramideSTR(hallazgos);
  if (ordered.length === 0) return null;

  const nivel1 = ordered[0];
  const nivel2 = ordered.slice(1, 3);
  const nivel3 = ordered.slice(3);
  // Número de posición en el orden único — la numeración continúa la del índice del hero.
  const numeroDe = (h: Hallazgo) => numeroHallazgo(ordered.indexOf(h));

  return (
    <section className="mt-3">
      <div className="flex items-baseline gap-3 mb-3 px-0.5">
        <span
          className="font-mono uppercase"
          style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--franco-text-tertiary)" }}
        >
          El detalle
        </span>
        <span className="font-serif font-bold" style={{ fontSize: 19 }}>
          En el mismo orden
        </span>
        <span className="font-body ml-auto shrink-0" style={{ fontSize: 12, color: "var(--franco-text-tertiary)" }}>
          {ordered.length} hallazgos
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {/* Nivel 1 — la posición 01, ancho completo */}
        <GenericFindingCard<DrawerKeySTR> hallazgo={nivel1} nivel={1} numero={numeroDe(nivel1)} anchorId={anchorHallazgo(nivel1)} currency={currency} valorUF={valorUF} drawerMap={HALLAZGO_DRAWER_STR} onOpenDrawer={onOpenDrawer} />

        {/* Nivel 2 — 02 y 03, en fila */}
        {nivel2.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nivel2.map((h) => (
              <GenericFindingCard<DrawerKeySTR> key={h.id} hallazgo={h} nivel={2} numero={numeroDe(h)} anchorId={anchorHallazgo(h)} currency={currency} valorUF={valorUF} drawerMap={HALLAZGO_DRAWER_STR} onOpenDrawer={onOpenDrawer} />
            ))}
          </div>
        )}

        {/* Nivel 3 — el resto, chips. Grid adaptativo (filasNivel3, N∈[5,12]). */}
        {nivel3.length > 0 &&
          filasNivel3(nivel3).map((fila, i) => (
            <div key={i} className={`grid grid-cols-1 ${fila.cols} gap-3`}>
              {fila.items.map((h) => (
                <GenericFindingCard<DrawerKeySTR> key={h.id} hallazgo={h} nivel={3} numero={numeroDe(h)} anchorId={anchorHallazgo(h)} currency={currency} valorUF={valorUF} drawerMap={HALLAZGO_DRAWER_STR} onOpenDrawer={onOpenDrawer} />
              ))}
            </div>
          ))}
      </div>
    </section>
  );
}
