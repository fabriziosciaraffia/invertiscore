// PiramideHallazgos — los hallazgos del motor renderizados en 3 niveles
// (GenericFindingCard) bajo el ORDEN ÚNICO (esquema C-umbral, orden-hallazgos.ts).
//
//  - Junta los hallazgos disponibles: carriers del motor (results.metrics) +
//    results.hallazgos + sobreprecio async (aiAnalysis.hallazgoSobreprecio). Dedup
//    por id. Cuando sobreprecio llega por el polling, el re-render lo inserta y
//    reordena solo (sin lógica extra: el orden se deriva de props en cada render).
//  - Orden ÚNICO: 01 = adverso más decisivo si pasa el piso 0,85; resto ranking
//    puro decisividad→magnitud sin partición por dirección. Es el MISMO orden que
//    muestra el índice del hero (que numera 01-03) — la numeración continúa acá.
//  - Nivel por posición: 01 → 1 · 02-03 → 2 · el resto → 3. Cada card lleva su
//    número en el eyebrow y un id de ancla estable (el índice del hero linkea).
//
// El "ver detalle" se conecta vía onOpenDrawer; la secuencia prev/next de los
// drawers se deriva de ESTE mismo array (un solo orden de verdad).

import type { AIAnalysisV2, FullAnalysisResult, Hallazgo } from "@/lib/types";
import type { DrawerKey } from "@/components/ui/AnalysisDrawer";
import { GenericFindingCard } from "./GenericFindingCard";
import {
  anchorHallazgo,
  dedupHallazgos,
  numeroHallazgo,
  ordenarHallazgosUnico,
} from "@/lib/orden-hallazgos";

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
  // y con decisividad vieja, no debe gobernar ni el ranking ni la narración).
  return dedupHallazgos(out);
}

// Orden EXACTO que renderiza la pirámide (orden único C-umbral). Exportado: el
// índice del hero toma sus primeros 3 de ESTE mismo array, y la navegación
// prev/next de los drawers también se deriva de acá — un solo orden de verdad.
// gather + dedup + sort viven acá; el componente lo consume tal cual.
export function ordenarHallazgosPiramide(
  results: FullAnalysisResult | null | undefined,
  aiAnalysis: AIAnalysisV2 | null | undefined,
): Hallazgo[] {
  const gathered = gatherHallazgos(results, aiAnalysis);
  // distancia_veredicto NO va en la pirámide. Primero se le dio posición fija (banda
  // propia) porque competir por ranking degradaba hallazgos decisivos; después quedó claro
  // que tampoco es un hallazgo que explique el veredicto — es la salida, y su lugar es
  // "La posición de Franco", que ahora abre su drawer. Acá se excluye del orden: eso lo
  // saca del render Y de la secuencia prev/next (que se deriva de este mismo array), que
  // es lo correcto: ya no es una parada de la pirámide. El hallazgo sigue intacto en el
  // motor, el PDF y el prompt.
  return ordenarHallazgosUnico(gathered.filter((h) => h.id !== "distancia_veredicto"));
}

/**
 * Orden para el DOCUMENTO (PDF), que sí lista la distancia al veredicto: ahí no hay
 * drawers ni "La posición de Franco" clickeable, así que el hallazgo tiene que aparecer
 * entre los demás o se pierde. Mismo gather y mismo ORDEN ÚNICO que la web — la única
 * diferencia es que no se excluye (con decisividad 0 y sin magnitud, la distancia cae
 * sola al fondo de la lista). Función aparte y no un flag booleano para que en el call
 * site se lea QUÉ superficie se está armando.
 */
export function ordenarHallazgosDocumento(
  results: FullAnalysisResult | null | undefined,
  aiAnalysis: AIAnalysisV2 | null | undefined,
): Hallazgo[] {
  return ordenarHallazgosUnico(gatherHallazgos(results, aiAnalysis));
}

/**
 * Reparto visual de la pirámide: 1 + 2 + resto. `ordenarHallazgosPiramide` ya excluye
 * `distancia_veredicto`, así que acá no hay nada que filtrar — se conserva el defensive
 * filter por si un caller pasa un array armado a mano.
 */
export function piramideLayout(ordered: Hallazgo[]): {
  nivel1: Hallazgo | undefined;
  nivel2: Hallazgo[];
  nivel3: Hallazgo[];
} {
  const rank = ordered.filter((h) => h.id !== "distancia_veredicto");
  return { nivel1: rank[0], nivel2: rank.slice(1, 3), nivel3: rank.slice(3) };
}

// Matriz de columnas del nivel 3 según cuántos chips quedan (Familia A, aprobada por
// Fabrizio). La estructura 1+2+resto NO cambia; solo el grid del resto se adapta para
// que la última fila quede balanceada en todo N∈[5,9] (evita el huérfano de N=7 y el
// 3+2 suelto de N=8). Clases ESTÁTICAS: Tailwind JIT no genera `grid-cols-${n}`
// interpolado, así que cada string de columnas es literal. El orden de `resto` se
// preserva (orden único): en el caso de 5, los 2 chips más decisivos ganan ancho en la
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

  const { nivel1, nivel2, nivel3 } = piramideLayout(ordered);
  if (!nivel1) return null;
  // Número de posición en el orden único (el índice del hero numera 01-03 con el
  // MISMO array, así que acá la numeración simplemente continúa).
  const numeroDe = (h: Hallazgo) => numeroHallazgo(ordered.indexOf(h));

  // Eco literal apertura↔01: la prosa (respuestaDirecta, Plan C) SIEMPRE abre con
  // la fraseCanonica del hallazgo 01 del orden único (ai-generation.ts). Cuando la
  // card 01 repite esa MISMA fraseCanonica en su body, el usuario leería el mismo
  // bloque dos veces en una pantalla. Detección DIRECTA (no proxy) sobre el texto
  // persistido de la moneda mostrada: si la respuestaDirecta empieza (normalizada)
  // con la fraseCanonica del 01, se suprime solo el <p> body de esa card. Sin eco
  // (prosa pre-Plan-C, o prosa vieja anclada a otro 01) → body intacto.
  // Normalización mínima: colapsa whitespace + trim + lower (ambos lados salen del
  // mismo string del motor; el trim/collapse blinda el borde).
  const respuestaDirectaCorona =
    currency === "CLP"
      ? aiAnalysis?.conviene?.respuestaDirecta_clp
      : aiAnalysis?.conviene?.respuestaDirecta_uf;
  // Canoniza "zona"→"comuna" antes de comparar: la fraseCanonica FRESCA dice
  // "mediana de la comuna" (fix wording), pero la prosa PERSISTIDA legacy abre con
  // "mediana de la zona". Sin esta normalización el eco no haría startsWith y el
  // body de la card 01 reaparecería duplicado (misma idea, dos fraseos) en las filas
  // legacy con sobreprecio en 01. Forward-only: no regeneramos la prosa vieja.
  const normEco = (s: string | null | undefined) =>
    (s ?? "").replace(/\s+/g, " ").trim().toLowerCase().replace(/\bzona\b/g, "comuna");
  // La prosa ensamblada antepone la RESPUESTA al veredicto ("Conviene." / "No
  // conviene." / "Todavía no: …") ANTES de la apertura fija — sin descontarla, el
  // startsWith nunca calza y el eco sobrevive (la card 01 repite el bloque que la
  // prosa acaba de decir). Se strippea ese prefijo antes de comparar.
  const stripRespuesta = (s: string) =>
    s.replace(/^(conviene(, con una condición)?\.|no conviene\.|todavía no:[^.]*\.)\s*/i, "");
  const fraseCorona = normEco(nivel1.fraseCanonica);
  const bodyCoronaDuplicado =
    fraseCorona.length > 0 && stripRespuesta(normEco(respuestaDirectaCorona)).startsWith(fraseCorona);

  return (
    <section className="mt-3">
      {/* Encuadre — el mismo orden que anunció el índice del hero */}
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
        {/* Nivel 1 — la posición 01, ancho completo. bodyDuplicado suprime el <p> si la
            prosa ya abrió con esta misma fraseCanonica (eco literal apertura↔01). */}
        <GenericFindingCard hallazgo={nivel1} nivel={1} numero={numeroDe(nivel1)} anchorId={anchorHallazgo(nivel1)} bodyDuplicado={bodyCoronaDuplicado} currency={currency} valorUF={valorUF} onOpenDrawer={onOpenDrawer} />

        {/* Nivel 2 — 02 y 03, en fila */}
        {nivel2.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nivel2.map((h) => (
              <GenericFindingCard key={h.id} hallazgo={h} nivel={2} numero={numeroDe(h)} anchorId={anchorHallazgo(h)} currency={currency} valorUF={valorUF} onOpenDrawer={onOpenDrawer} />
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
                <GenericFindingCard key={h.id} hallazgo={h} nivel={3} numero={numeroDe(h)} anchorId={anchorHallazgo(h)} currency={currency} valorUF={valorUF} onOpenDrawer={onOpenDrawer} />
              ))}
            </div>
          ))}
      </div>
    </section>
  );
}
