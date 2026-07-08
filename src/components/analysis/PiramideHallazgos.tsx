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

  // Dedup por id: el hallazgo CON titular gana SIEMPRE al que no lo tiene (misma
  // regla que el hero — la copia legacy de sobreprecio en ai_analysis, sin titular
  // y con decisividad vieja, no debe gobernar ni el ranking ni la narración). Entre
  // dos con el mismo estado de titular, manda la mayor decisividad.
  const byId = new Map<string, Hallazgo>();
  for (const h of out) {
    const prev = byId.get(h.id);
    const hT = !!h.titular;
    const pT = prev ? !!prev.titular : false;
    const gana = !prev || (hT && !pT) || (hT === pT && h.decisividad > prev.decisividad);
    if (gana) byId.set(h.id, h);
  }
  return Array.from(byId.values());
}

// Matriz de columnas del nivel 3 según cuántos chips quedan (Familia A, aprobada por
// Fabrizio). La estructura 1+2+resto NO cambia; solo el grid del resto se adapta para
// que la última fila quede balanceada en todo N∈[5,9] (evita el huérfano de N=7 y el
// 3+2 suelto de N=8). Clases ESTÁTICAS: Tailwind JIT no genera `grid-cols-${n}`
// interpolado, así que cada string de columnas es literal. El orden de `resto` se
// preserva (Filosofía 1): en el caso de 5, los 2 chips más decisivos ganan ancho en la
// fila de 2 y el resto va a la de 3. Mobile (<md): todas las filas apilan a 1 columna.
function filasNivel3(resto: Hallazgo[]): { items: Hallazgo[]; cols: string }[] {
  const n = resto.length;
  if (n === 2) return [{ items: resto, cols: "md:grid-cols-2" }];
  if (n === 4) return [{ items: resto, cols: "md:grid-cols-4" }];
  if (n === 5)
    return [
      { items: resto.slice(0, 2), cols: "md:grid-cols-2" },
      { items: resto.slice(2), cols: "md:grid-cols-3" },
    ];
  // 1, 3, 6, >6 → grid de 3 (fallback actual): 3 = fila perfecta, 6 = 3+3 por wrap.
  return [{ items: resto, cols: "md:grid-cols-3" }];
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

  // Kicker honesto de la corona: "Lo más decisivo" solo si el coronado (ordered[0],
  // que el orden Filosofía 1 elige por "adverso primero") es TAMBIÉN el de mayor
  // decisividad real del set. Si no lo es (ej. un favorable más decisivo que todos
  // los adversos), la card muestra "Ojo antes de firmar" — así no contradice al
  // TOP-3 del hero, que sí ordena por decisividad. Tolerancia float por si dos
  // hallazgos empatan en el máximo.
  const maxDecisividad = Math.max(...gathered.map((h) => h.decisividad));
  const esElMasDecisivo = nivel1.decisividad >= maxDecisividad - 1e-9;

  // Eco literal apertura↔corona: la prosa (respuestaDirecta, Plan C) SIEMPRE abre con
  // la fraseCanonica del hallazgo #1 por decisividad (ai-generation.ts:1567-1592). Cuando
  // ese #1 es también el coronado por la pirámide (Filosofía 1), el body de la corona
  // —que es esa MISMA fraseCanonica— repite el bloque que la prosa ya dijo arriba.
  // Detección DIRECTA (no proxy) sobre el texto persistido de la moneda mostrada: si la
  // respuestaDirecta empieza (normalizada) con la fraseCanonica del coronado, se suprime
  // solo el <p> body de la corona. Sin eco (corona≠#1, o prosa pre-Plan-C con apertura
  // distinta) → body intacto. Normalización mínima: colapsa whitespace + trim + lower
  // (ambos lados salen del mismo string del motor; el trim/collapse blinda el borde).
  const respuestaDirectaCorona =
    currency === "CLP"
      ? aiAnalysis?.conviene?.respuestaDirecta_clp
      : aiAnalysis?.conviene?.respuestaDirecta_uf;
  // Canoniza "zona"→"comuna" antes de comparar: la fraseCanonica FRESCA dice
  // "mediana de la comuna" (fix wording), pero la prosa PERSISTIDA legacy abre con
  // "mediana de la zona". Sin esta normalización el eco no haría startsWith y el
  // body de la corona reaparecería duplicado (misma idea, dos fraseos) en las filas
  // legacy con sobreprecio coronado. Forward-only: no regeneramos la prosa vieja.
  const normEco = (s: string | null | undefined) =>
    (s ?? "").replace(/\s+/g, " ").trim().toLowerCase().replace(/\bzona\b/g, "comuna");
  const fraseCorona = normEco(nivel1.fraseCanonica);
  const bodyCoronaDuplicado =
    fraseCorona.length > 0 && normEco(respuestaDirectaCorona).startsWith(fraseCorona);

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
          Empezando por lo adverso
        </span>
        <span className="font-body ml-auto shrink-0" style={{ fontSize: 12, color: "var(--franco-text-tertiary)" }}>
          {ordered.length} hallazgos
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {/* Nivel 1 — decisivo, ancho completo. bodyDuplicado suprime el <p> si la
            prosa ya abrió con esta misma fraseCanonica (eco literal apertura↔corona). */}
        <GenericFindingCard hallazgo={nivel1} nivel={1} esElMasDecisivo={esElMasDecisivo} bodyDuplicado={bodyCoronaDuplicado} currency={currency} valorUF={valorUF} onOpenDrawer={onOpenDrawer} />

        {/* Nivel 2 — los dos siguientes, en fila */}
        {nivel2.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nivel2.map((h) => (
              <GenericFindingCard key={h.id} hallazgo={h} nivel={2} currency={currency} valorUF={valorUF} onOpenDrawer={onOpenDrawer} />
            ))}
          </div>
        )}

        {/* Nivel 3 — el resto, chips. Grid adaptativo (filasNivel3) para que la última
            fila quede balanceada en todo N; en filas de 2 los chips solo son más anchos
            (mismo componente/props). El orden lo fija el sort de arriba, no este render. */}
        {nivel3.length > 0 &&
          filasNivel3(nivel3).map((fila, i) => (
            <div key={i} className={`grid grid-cols-1 ${fila.cols} gap-3`}>
              {fila.items.map((h) => (
                <GenericFindingCard key={h.id} hallazgo={h} nivel={3} currency={currency} valorUF={valorUF} onOpenDrawer={onOpenDrawer} />
              ))}
            </div>
          ))}
      </div>
    </section>
  );
}
