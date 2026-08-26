// ─────────────────────────────────────────────────────────────────────────────
// Marcas de destacador en prosa IA — fuente única (FASE 2 rediseño Dictamen).
//
// El contrato de prompt marca frases clave con `**…**` (markdown bold). El render
// las pinta con plumón (FASE 4); mientras esa UI no existe, el render actual las
// STRIPEA con `stripMarcas` (render tolerante: la prosa nueva nunca muestra `**`
// crudos, cualquiera sea el orden de deploys). El golden usa `marcasBalanceadas`
// como invariante: los sanitizers del pipeline recortan por ORACIÓN entera
// (PLANC-BUDGET-TRIM, PLANC-DUAL-STRIPPED en LTR; stripCardEcho en STR), así que
// un par que cruce el punto puede quedar mutilado en un `**` impar — el check lo
// caza en generación fresca y el prompt prohíbe marcas que crucen oraciones.
//
// Regla dura: este módulo NO interpreta contenido (no valida "frase completa" ni
// largo del núcleo — eso es del prompt y del juez). Solo cuenta y stripea tokens.
// ─────────────────────────────────────────────────────────────────────────────

/** Cantidad de tokens `**` en el texto. Un par bien formado aporta 2. */
export function contarTokensMarca(texto: string): number {
  return (texto.match(/\*\*/g) ?? []).length;
}

/**
 * true si los tokens `**` del texto están balanceados (cantidad par, incluido 0).
 * No exige que haya marcas: prosa sin `**` es válida.
 */
export function marcasBalanceadas(texto: string): boolean {
  return contarTokensMarca(texto) % 2 === 0;
}

/**
 * Validación de forma del `titular` (contrato FASE 2 §1) — fuente única para el
 * guard de generación y para los checks A9/AS4 del golden. Valida FORMA
 * verificable (palabras, marcas, montos); el contenido (fórmula, jerga,
 * olor-IA) lo miran el prompt y el juez semántico.
 */
export function validarTitular(titular: unknown): { ok: boolean; motivo: string | null } {
  if (typeof titular !== "string" || !titular.trim()) return { ok: false, motivo: "ausente" };
  const t = titular.trim();
  const tokens = contarTokensMarca(t);
  if (tokens !== 2) return { ok: false, motivo: `marcas: ${tokens} tokens \`**\` (exigido: un par)` };
  const nucleo = t.match(/\*\*([\s\S]+?)\*\*/)?.[1] ?? "";
  if (!nucleo.trim()) return { ok: false, motivo: "marca vacía" };
  const palabras = (s: string) => (s.trim().match(/\S+/g) || []).length;
  // El núcleo ≤7 palabras es regla de PROMPT (contrato §1), NO de este check:
  // el check duro del contrato (§5.2) exige presente + ≤15 + un par + sin
  // montos, y nada más. Medido en FULL (25-ago): el modelo cuenta mal el núcleo
  // (9→8 tras dos refuerzos) y descartarle el titular entero por una palabra
  // producía portadas sin titular sistemáticas — peor producto que un plumón de
  // 8 palabras. El PARÁ 2 muestra los núcleos reales; si Fabrizio quiere el
  // tope duro, se agrega acá con su decisión.
  const plano = stripMarcas(t);
  if (palabras(plano) > 15) return { ok: false, motivo: `${palabras(plano)} palabras (máx 15)` };
  // Sin montos en moneda (§0): $ seguido de dígito, o UF junto a dígitos.
  if (/\$\s?\d/.test(plano) || /\bUF\s?[\d.]/i.test(plano)) {
    return { ok: false, motivo: "trae monto en moneda (la cifra vive en cifraClave)" };
  }
  return { ok: true, motivo: null };
}

/**
 * Normaliza las marcas de un titular renderizable: un par queda tal cual; cero
 * marcas queda tal cual (sin plumón); tokens impares o pares extra conservan
 * SOLO el primer par completo y strippean el resto (decisión PARÁ 3: marcas
 * rotas nunca anulan un titular — "sin plumón o con el primero, nunca null").
 */
export function normalizarMarcasTitular(titular: string): string {
  const tokens = contarTokensMarca(titular);
  if (tokens === 0 || tokens === 2) return titular;
  const m = titular.match(/\*\*([\s\S]+?)\*\*/);
  if (!m) return stripMarcas(titular);
  const antes = titular.slice(0, m.index ?? 0);
  const despues = titular.slice((m.index ?? 0) + m[0].length);
  return stripMarcas(antes) + m[0] + stripMarcas(despues);
}

export type NivelTitular = "valido" | "largo_renderizable" | "invalido";

/**
 * Evaluación ESCALONADA del titular (decisión PARÁ 3 — mostrar largo gana a
 * callar): ≤15 palabras → válido; 16-20 → se renderiza igual, marcado como
 * violación blanda; >20 → null; montos en moneda → null SIEMPRE (rompen el
 * toggle CLP/UF); marcas rotas no bloquean en ningún nivel (se normalizan).
 * `validarTitular` sigue siendo el contrato ESTRICTO (objetivo del retry y
 * métrica de forma); esta función decide qué llega a la portada.
 */
export function evaluarTitular(titular: unknown): { nivel: NivelTitular; motivo: string | null } {
  if (typeof titular !== "string" || !titular.trim()) return { nivel: "invalido", motivo: "ausente" };
  const plano = stripMarcas(titular.trim());
  if (/\$\s?\d/.test(plano) || /\bUF\s?[\d.]/i.test(plano)) {
    return { nivel: "invalido", motivo: "trae monto en moneda (rompe el toggle CLP/UF)" };
  }
  const palabras = (plano.match(/\S+/g) || []).length;
  if (palabras > 20) return { nivel: "invalido", motivo: `${palabras} palabras (tope duro: 20)` };
  if (palabras > 15) return { nivel: "largo_renderizable", motivo: `${palabras} palabras (ideal ≤15) — se renderiza igual` };
  return { nivel: "valido", motivo: null };
}

/**
 * Elimina los tokens `**` dejando el texto plano (el contenido marcado queda).
 * Render tolerante FASE 2: cero cambio visual frente a la prosa sin marcas.
 * En FASE 4 el punto de consumo pasa de strip a plumón — mismo módulo.
 * Con tokens desbalanceados igual stripea todos: un `**` huérfano crudo en
 * pantalla es peor que perder el énfasis de esa frase.
 */
export function stripMarcas(texto: string): string {
  return texto.replace(/\*\*/g, "");
}

/**
 * Render tolerante FASE 2 — strip RECURSIVO sobre el objeto de prosa IA, en la
 * RAÍZ de cada superficie (SubjectCardGrid en LTR; results-client en STR): una
 * sola edición por superficie y ningún punto de interpolación olvidado. NO muta
 * el original (la prosa cacheada se comparte con el estado del poll): devuelve
 * una copia solo si hay algo que strippear. En FASE 4 el punto de consumo pasa
 * de este strip al render con plumón — mismo lugar, un solo cambio.
 */
export function stripMarcasDeep<T>(nodo: T): T {
  if (typeof nodo === "string") {
    return (nodo.includes("**") ? stripMarcas(nodo) : nodo) as T;
  }
  if (Array.isArray(nodo)) return nodo.map((n) => stripMarcasDeep(n)) as T;
  if (nodo && typeof nodo === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(nodo as Record<string, unknown>)) out[k] = stripMarcasDeep(v);
    return out as T;
  }
  return nodo;
}
