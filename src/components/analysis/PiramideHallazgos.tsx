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
// Exportado (E.1b): lo reusa PiramideHallazgosSTR para el mismo orden Filosofía 1.
export const cmpDecisividad = (a: Hallazgo, b: Hallazgo) =>
  b.decisividad - a.decisividad || ((b.magnitudContinua ?? 0) - (a.magnitudContinua ?? 0));

// Filosofía 1: adverso (o neutral/leve) va en el grupo de arriba; favorable abajo.
export const esAdverso = (h: Hallazgo) => h.direccion !== "favorable";

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

// Orden EXACTO que renderiza la pirámide (Filosofía 1: adversos por decisividad,
// luego favorables). Exportado (fix-drawers): la navegación prev/next de los drawers
// se deriva de ESTE mismo array — un solo orden de verdad. gather + dedup + sort viven
// acá; el componente lo consume tal cual (sin recomputar), y el orquestador (SubjectCardGrid)
// lo usa para armar la secuencia de drawers.
export function ordenarHallazgosPiramide(
  results: FullAnalysisResult | null | undefined,
  aiAnalysis: AIAnalysisV2 | null | undefined,
): Hallazgo[] {
  const gathered = gatherHallazgos(results, aiAnalysis);
  // distancia_veredicto NO compite: se saca del sort y se inserta en posición fija.
  // Cuando competía (direccion "adverso" + magnitud alta) empujaba hallazgos genuinamente
  // decisivos fuera del top-3 — medido: cap_rate 0,85 y sobreprecio 0,88 degradados a chip
  // en 3 filas del corpus. Su lugar es narrativo, no ganado: va justo después del bloque
  // de adversos, para que se lea "esto es lo que duele → esto es lo que te separa → esto
  // es lo que acompaña".
  const rankeables = gathered.filter((h) => h.id !== "distancia_veredicto");
  const distancia = gathered.find((h) => h.id === "distancia_veredicto") ?? null;
  const adversos = rankeables.filter(esAdverso).sort(cmpDecisividad);
  const favorables = rankeables.filter((h) => !esAdverso(h)).sort(cmpDecisividad);
  const base = [...adversos, ...favorables];
  if (!distancia) return base;
  // Después del último adverso; si no hay adversos, en posición 2 (tras el primer favorable).
  const pos = adversos.length > 0 ? adversos.length : Math.min(1, base.length);
  return [...base.slice(0, pos), distancia, ...base.slice(pos)];
}

/**
 * Reparto visual de la pirámide. Los NIVELES se asignan sobre los hallazgos rankeables
 * (los 9 del ranking), NO sobre el array completo: `distancia_veredicto` no compite por
 * nivel igual que no compite por orden. Se renderiza como banda propia de ancho completo
 * entre el nivel 1 y el nivel 2 — el lugar que le da el orden de lectura sin robarle un
 * puesto a nadie. Así los demás conservan EXACTAMENTE los niveles que tenían antes de que
 * este hallazgo existiera.
 */
export function piramideLayout(ordered: Hallazgo[]): {
  distancia: Hallazgo | null;
  nivel1: Hallazgo | undefined;
  nivel2: Hallazgo[];
  nivel3: Hallazgo[];
} {
  const distancia = ordered.find((h) => h.id === "distancia_veredicto") ?? null;
  const rank = ordered.filter((h) => h.id !== "distancia_veredicto");
  return { distancia, nivel1: rank[0], nivel2: rank.slice(1, 3), nivel3: rank.slice(3) };
}

// Matriz de columnas del nivel 3 según cuántos chips quedan (Familia A, aprobada por
// Fabrizio). La estructura 1+2+resto NO cambia; solo el grid del resto se adapta para
// que la última fila quede balanceada en todo N∈[5,9] (evita el huérfano de N=7 y el
// 3+2 suelto de N=8). Clases ESTÁTICAS: Tailwind JIT no genera `grid-cols-${n}`
// interpolado, así que cada string de columnas es literal. El orden de `resto` se
// preserva (Filosofía 1): en el caso de 5, los 2 chips más decisivos ganan ancho en la
// fila de 2 y el resto va a la de 3. Mobile (<md): todas las filas apilan a 1 columna.
export function filasNivel3(resto: Hallazgo[]): { items: Hallazgo[]; cols: string }[] {
  const n = resto.length;
  if (n === 2) return [{ items: resto, cols: "md:grid-cols-2" }];
  if (n === 4) return [{ items: resto, cols: "md:grid-cols-4" }];
  if (n === 5)
    return [
      { items: resto.slice(0, 2), cols: "md:grid-cols-2" },
      { items: resto.slice(2), cols: "md:grid-cols-3" },
    ];
  // E.1b — pirámide STR llega a N=10/11 (resto 7/8). Balanceo sin huérfano:
  if (n === 7)
    return [
      { items: resto.slice(0, 4), cols: "md:grid-cols-4" },
      { items: resto.slice(4), cols: "md:grid-cols-3" },
    ];
  if (n === 8)
    return [
      { items: resto.slice(0, 4), cols: "md:grid-cols-4" },
      { items: resto.slice(4), cols: "md:grid-cols-4" },
    ];
  // 1, 3, 6, 9, >8 → grid de 3 (fallback): 3/6/9 = filas perfectas por wrap.
  return [{ items: resto, cols: "md:grid-cols-3" }];
}

// Guard de corona honesta — criterio ÚNICO para LTR y STR (lo importa PiramideHallazgosSTR).
// El kicker "Lo más decisivo" se gana solo si el coronado es el ÚNICO con la decisividad
// máxima del set. Antes bastaba con empatar en el máximo (>=), y eso rompía en el caso
// frecuente: DECISIVIDAD_FLOOR (0,85 en analysis.ts) pisa al MISMO valor a todo hallazgo
// cuya neutralización flipea el veredicto o desarma un gate — ~1 de cada 4 análisis
// (medido en 1488c9a). Con empate, quién corona lo decide el orden Filosofía 1 (adverso
// primero) y quién va 01 en el TOP-3 lo decide el desempate por magnitud → dos "lo más
// importante" distintos en la misma pantalla. Máximo ESTRICTO: si hay empate nadie reclama
// el título y la corona cae al kicker existente "Ojo antes de firmar".
// Devuelve false también cuando NADIE mueve el score (max≈0, posible en STR con adversos
// todos solo-lectura) — ese guard ya existía y se conserva.
export function coronaEsLaMasDecisiva(corona: Hallazgo, gathered: Hallazgo[]): boolean {
  const max = Math.max(...gathered.map((h) => h.decisividad));
  if (!(max > 1e-9)) return false;
  const enElMaximo = gathered.filter((h) => h.decisividad >= max - 1e-9);
  return enElMaximo.length === 1 && corona.decisividad >= max - 1e-9;
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
  const ordered = ordenarHallazgosPiramide(results, aiAnalysis);
  if (ordered.length === 0) return null;

  // Niveles sobre los RANKEABLES (distancia_veredicto va aparte, banda propia).
  const { distancia, nivel1, nivel2, nivel3 } = piramideLayout(ordered);
  if (!nivel1) return null;
  // Guard de corona: se evalúa sobre los rankeables, no sobre el set completo — la
  // distancia tiene decisividad 0 fija y no debe contar como candidata al máximo.
  const gathered = ordered.filter((h) => h.id !== "distancia_veredicto");

  // Kicker honesto de la corona: "Lo más decisivo" solo si el coronado (ordered[0],
  // que el orden Filosofía 1 elige por "adverso primero") es el ÚNICO de mayor
  // decisividad real del set. Si no lo es —porque hay otro más decisivo (ej. un
  // favorable sobre todos los adversos) o porque EMPATA en el máximo—, la card
  // muestra "Ojo antes de firmar": así no contradice al TOP-3 del hero, que
  // desempata por magnitud continua. Criterio en coronaEsLaMasDecisiva (compartido
  // con la pirámide STR).
  const esElMasDecisivo = coronaEsLaMasDecisiva(nivel1, gathered);

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

        {/* Distancia al veredicto — banda propia de ancho completo, entre el nivel 1 y el
            nivel 2. No compite por puesto ni por nivel: es el puente de lectura entre "lo
            que duele" y "lo que acompaña". Ausente en COMPRAR. */}
        {distancia && (
          <GenericFindingCard hallazgo={distancia} nivel={2} currency={currency} valorUF={valorUF} onOpenDrawer={onOpenDrawer} />
        )}

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
