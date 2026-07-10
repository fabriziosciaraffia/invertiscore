"use client";

// Pirámide de hallazgos STR (E.1b) — hermano de PiramideHallazgos (LTR). Reusa el mismo
// orden Filosofía 1 (adversos primero, por decisividad), el guard de corona honesta y la
// matriz N-variable extendida (filasNivel3, N∈[5,12]); renderiza con GenericFindingCard
// (que ya tiene los casos findingDisplay de los 6 propios STR + los heredados LTR).
//
// A diferencia de la LTR, lee results.hallazgos directamente (el pipeline lo persistió con
// la pirámide completa) — no gathera de carriers del motor ni suprime eco de prosa (la
// pirámide STR vive como sección propia, separada de la prosa IA). Sin drawer affordance por
// ahora (los drawers STR viven en SubjectCardGridSTR).

import type { Hallazgo } from "@/lib/types";
import { GenericFindingCard } from "@/components/analysis/GenericFindingCard";
import { cmpDecisividad, esAdverso, filasNivel3 } from "@/components/analysis/PiramideHallazgos";

/** Dedup por id: el hallazgo CON titular gana; entre iguales, mayor decisividad. */
function dedup(hallazgos: Hallazgo[]): Hallazgo[] {
  const byId = new Map<string, Hallazgo>();
  for (const h of hallazgos) {
    const prev = byId.get(h.id);
    const hT = !!h.titular;
    const pT = prev ? !!prev.titular : false;
    const gana = !prev || (hT && !pT) || (hT === pT && h.decisividad > prev.decisividad);
    if (gana) byId.set(h.id, h);
  }
  return Array.from(byId.values());
}

export function PiramideHallazgosSTR({
  hallazgos,
  currency,
  valorUF,
}: {
  hallazgos: Hallazgo[] | null | undefined;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const gathered = dedup(Array.isArray(hallazgos) ? hallazgos.filter(Boolean) : []);
  if (gathered.length === 0) return null;

  const adversos = gathered.filter(esAdverso).sort(cmpDecisividad);
  const favorables = gathered.filter((h) => !esAdverso(h)).sort(cmpDecisividad);
  const ordered = [...adversos, ...favorables];

  const nivel1 = ordered[0];
  const nivel2 = ordered.slice(1, 3);
  const nivel3 = ordered.slice(3);

  // Corona honesta: "Lo más decisivo" solo si el coronado es también el de mayor decisividad
  // real Y algún hallazgo mueve el score (guard STR: adversos todos solo-lectura ⇒ no).
  const maxDecisividad = Math.max(...gathered.map((h) => h.decisividad));
  const esElMasDecisivo = maxDecisividad > 1e-9 && nivel1.decisividad >= maxDecisividad - 1e-9;

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
          Empezando por lo adverso
        </span>
        <span className="font-body ml-auto shrink-0" style={{ fontSize: 12, color: "var(--franco-text-tertiary)" }}>
          {ordered.length} hallazgos
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {/* Nivel 1 — decisivo, ancho completo */}
        <GenericFindingCard hallazgo={nivel1} nivel={1} esElMasDecisivo={esElMasDecisivo} currency={currency} valorUF={valorUF} />

        {/* Nivel 2 — los dos siguientes, en fila */}
        {nivel2.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nivel2.map((h) => (
              <GenericFindingCard key={h.id} hallazgo={h} nivel={2} currency={currency} valorUF={valorUF} />
            ))}
          </div>
        )}

        {/* Nivel 3 — el resto, chips. Grid adaptativo (filasNivel3, N∈[5,12]). */}
        {nivel3.length > 0 &&
          filasNivel3(nivel3).map((fila, i) => (
            <div key={i} className={`grid grid-cols-1 ${fila.cols} gap-3`}>
              {fila.items.map((h) => (
                <GenericFindingCard key={h.id} hallazgo={h} nivel={3} currency={currency} valorUF={valorUF} />
              ))}
            </div>
          ))}
      </div>
    </section>
  );
}
