// PiramideHallazgos — reemplaza el grid 2×2 de dimensiones IA por los 6 hallazgos
// del motor, ordenados por decisividad calibrada y renderizados en 3 niveles
// (GenericFindingCard). Fase 1b.
//
//  - Junta los hallazgos disponibles: carriers del motor (results.metrics) +
//    results.hallazgos + sobreprecio async (aiAnalysis.hallazgoSobreprecio). Dedup
//    por id. Cuando sobreprecio llega por el polling, el re-render lo inserta y
//    reordena solo (sin lógica extra: el orden se deriva de props en cada render).
//  - Orden Filosofía 1: ADVERSOS primero (por decisividad DESC, magnitud DESC como
//    desempate — el mismo comparador de dos niveles que el hero), FAVORABLES después.
//  - Nivel por posición: el más decisivo → 1 · los 2 siguientes → 2 · el resto → 3.
//    Si un favorable muy decisivo cayera nivel 1, es correcto: el punto dice que es
//    a favor, el tamaño dice que pesa.
//
// El "ver detalle" NO se conecta acá (drawers = paso siguiente). Gather replicado
// del HeroLTR a propósito (no se toca el hero); la unificación es posterior.

import type { AIAnalysisV2, FullAnalysisResult, Hallazgo } from "@/lib/types";
import type { DrawerKey } from "@/components/ui/AnalysisDrawer";
import { GenericFindingCard } from "./GenericFindingCard";

// Comparador de dos niveles: decisividad DESC, luego magnitud continua DESC.
const cmpDecisividad = (a: Hallazgo, b: Hallazgo) =>
  b.decisividad - a.decisividad || ((b.magnitudContinua ?? 0) - (a.magnitudContinua ?? 0));

// Filosofía 1: adverso (o neutral/leve) va en el grupo de arriba; favorable abajo.
const esAdverso = (h: Hallazgo) => h.direccion !== "favorable";

function gatherHallazgos(
  results: FullAnalysisResult | null | undefined,
  aiAnalysis: AIAnalysisV2 | null | undefined,
): Hallazgo[] {
  const out: Hallazgo[] = [];
  const push = (h: Hallazgo | null | undefined) => {
    if (h && typeof h.decisividad === "number") out.push(h);
  };
  // Carriers del motor (mismos que lee el hero). El tipo AnalysisMetrics no expone
  // los hallazgo* nominalmente, por eso el narrow via Record.
  const m = results?.metrics as unknown as Record<string, Hallazgo | null | undefined> | undefined;
  push(m?.hallazgoSobreprecio);
  push(m?.hallazgoCapRate);
  push(m?.hallazgoFlujoMensual);
  push(m?.hallazgoPlusvalia);
  push(m?.hallazgoPuestaAPunto);
  // Sobreprecio async (vive en ai_analysis cuando la mediana se resolvió post-motor).
  push(aiAnalysis?.hallazgoSobreprecio);
  // Motor-seeded persistidos (estructura, y los demás en el recompute del render).
  if (Array.isArray(results?.hallazgos)) results.hallazgos.forEach(push);

  // Dedup por id: gana la de mayor decisividad (misma regla que el hero).
  const byId = new Map<string, Hallazgo>();
  for (const h of out) {
    const prev = byId.get(h.id);
    if (!prev || h.decisividad > prev.decisividad) byId.set(h.id, h);
  }
  return Array.from(byId.values());
}

export function PiramideHallazgos({
  results,
  aiAnalysis,
  currency,
  valorUF,
  onOpenDrawer,
}: {
  results: FullAnalysisResult | null | undefined;
  aiAnalysis: AIAnalysisV2 | null | undefined;
  currency: "CLP" | "UF";
  valorUF: number;
  /** Abre el drawer de detalle de un hallazgo (threadeado a cada card). */
  onOpenDrawer: (key: DrawerKey) => void;
}) {
  const gathered = gatherHallazgos(results, aiAnalysis);
  if (gathered.length === 0) return null;

  const adversos = gathered.filter(esAdverso).sort(cmpDecisividad);
  const favorables = gathered.filter((h) => !esAdverso(h)).sort(cmpDecisividad);
  const ordered = [...adversos, ...favorables];

  const nivel1 = ordered[0];
  const nivel2 = ordered.slice(1, 3);
  const nivel3 = ordered.slice(3);

  return (
    <section className="mt-3">
      {/* Encuadre — ordenado por lo que más pesa (molde zone-h del mockup) */}
      <div className="flex items-baseline gap-3 mb-3 px-0.5">
        <span
          className="font-mono uppercase"
          style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--franco-text-tertiary)" }}
        >
          El detalle
        </span>
        <span className="font-serif font-bold" style={{ fontSize: 19 }}>
          Ordenado por lo que más pesa en este deal
        </span>
        <span className="font-body ml-auto shrink-0" style={{ fontSize: 12, color: "var(--franco-text-tertiary)" }}>
          {ordered.length} hallazgos
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {/* Nivel 1 — decisivo, ancho completo */}
        <GenericFindingCard hallazgo={nivel1} nivel={1} currency={currency} valorUF={valorUF} onOpenDrawer={onOpenDrawer} />

        {/* Nivel 2 — los dos siguientes, en fila */}
        {nivel2.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nivel2.map((h) => (
              <GenericFindingCard key={h.id} hallazgo={h} nivel={2} currency={currency} valorUF={valorUF} onOpenDrawer={onOpenDrawer} />
            ))}
          </div>
        )}

        {/* Nivel 3 — el resto, chips */}
        {nivel3.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {nivel3.map((h) => (
              <GenericFindingCard key={h.id} hallazgo={h} nivel={3} currency={currency} valorUF={valorUF} onOpenDrawer={onOpenDrawer} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
