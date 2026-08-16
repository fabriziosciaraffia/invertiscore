// ============================================================================
// JERARQUÍA DE PRECIOS (§1.12.6) — colapso pre-digerido + guard de enforcement
// ============================================================================
// El re-censo 2026-08-16 dejó 33 ALTAs D3 de una sola familia: varios precios /
// porcentajes de descuento conviviendo en la prosa sin que ninguno diga cuál
// manda. La REGLA 8 del prompt existe pero una instrucción no es enforcement
// (lección voseo: la segunda pasada es código). Dos capas:
//
//  1. COLAPSO (construirJerarquiaPrecios): un solo bloque del user prompt con
//     TODOS los precios activos del caso — una cifra canónica por rol, el
//     protagonista por pieza asignado y las subordinaciones YA escritas para
//     todos los pares (generaliza el arbitraje <2%, que antes era el único par
//     pre-digerido). Lo que la IA no recibe crudo, no puede confundir.
//  2. GUARD (detectarColisionesJerarquia): post-parse, detecta piezas que citan
//     ≥2 cifras canónicas de roles distintos SIN marcador de subordinación.
//     Anclado a las cifras canónicas del caso — NO un contador lexical de "%"
//     (medido sobre las 177 prosas frescas del re-censo: el conteo dispara 90/139
//     con contexto laxo y 5/139 con recall 19% en estricto; inservible en ambos
//     extremos). El caller reintenta con feedback y, a la 2ª falla, appendea la
//     línea de arbitraje canónica (fallback determinístico).
// ============================================================================

export type RolPrecio = "techo" | "umbral" | "flujo_neutro" | "limite_tir";

export interface PrecioCanonico {
  rol: RolPrecio;
  uf: number;
  /** % de descuento vs el precio pedido; null cuando no es una rebaja (flujo-neutro ≥ pedido). */
  pct: number | null;
  /** Línea de subordinación canónica de este rol frente al protagonista del caso. */
  subordinacion: string;
}

export interface JerarquiaPrecios {
  precios: PrecioCanonico[];
  /** Bloque listo para interpolar en el user prompt ("" si el caso no tiene precios que jerarquizar). */
  bloque: string;
}

const fmtUFj = (n: number) => `UF ${Math.round(n).toLocaleString("es-CL")}`;
const pctj = (n: number) => (Math.round(n * 10) / 10).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function construirJerarquiaPrecios(args: {
  precioPedidoUF: number;
  techoUF: number;
  modoSugerido: "cerrar_actual" | "optimizar_flujo" | "alinear_mercado";
  umbralVeredictoUF: number | null;
  veredictoAlUmbral: string | null;
  sugeridoMandadoPorVeredicto: boolean;
  precioFlujoNeutroUF: number;
  descuentoParaNeutro: number;
  /** Lectura pre-digerida del flujo-neutro (lecturaPrecioFlujoNeutro) — fuente única del signo. */
  lecturaFlujoNeutro: string;
  limiteTirUF: number | null;
  sinCapitalPropio: boolean;
}): JerarquiaPrecios {
  const p = args.precioPedidoUF;
  if (!(p > 0)) return { precios: [], bloque: "" };
  const desc = (x: number) => ((p - x) / p) * 100;
  const cercano = (a: number, b: number) => a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) < 0.02;

  const precios: PrecioCanonico[] = [];
  const lineas: string[] = [];

  // ── Techo (protagonista de negociacion) + umbral de veredicto ──
  // El motor ya colapsa sugerido→umbral cuando el umbral está más abajo
  // (sugeridoMandadoPorVeredicto); acá solo queda el caso umbral SOBRE el techo.
  const umbralDistinto =
    args.umbralVeredictoUF !== null && !args.sugeridoMandadoPorVeredicto && !cercano(args.umbralVeredictoUF, args.techoUF);
  const descTecho = desc(args.techoUF);
  if (args.modoSugerido === "cerrar_actual") {
    precios.push({ rol: "techo", uf: args.techoUF, pct: null, subordinacion: "" });
    lineas.push(`- Techo de negociación: ${fmtUFj(args.techoUF)} — IGUAL al precio pedido (modo cerrar_actual): cerrar al precio actual, sin descuento que pedir.`);
  } else if (args.sugeridoMandadoPorVeredicto && args.umbralVeredictoUF !== null) {
    precios.push({ rol: "techo", uf: args.techoUF, pct: descTecho, subordinacion: "" });
    lineas.push(`- Techo de negociación: ${fmtUFj(args.techoUF)} (−${pctj(descTecho)}% del pedido) — COINCIDE con el umbral de veredicto: un solo número, doble razón (es el número de la mesa Y el que pasa el análisis a ${args.veredictoAlUmbral ?? "la banda de arriba"}). NO lo presentes como dos cifras.`);
  } else {
    precios.push({ rol: "techo", uf: args.techoUF, pct: descTecho > 0 ? descTecho : null, subordinacion: "" });
    lineas.push(`- Techo de negociación: ${fmtUFj(args.techoUF)}${descTecho > 0 ? ` (−${pctj(descTecho)}% del pedido)` : ""} — el número de la mesa (protagonista de \`negociacion\`).`);
  }
  if (umbralDistinto && args.umbralVeredictoUF !== null) {
    const u = args.umbralVeredictoUF;
    const descU = desc(u);
    const sub = `pelea primero por ${fmtUFj(u)} — es el que cambia la conclusión; ${fmtUFj(args.techoUF)} es hasta dónde llegar si la conversación da: tu tope, no un segundo objetivo`;
    precios.push({ rol: "umbral", uf: u, pct: descU > 0 ? descU : null, subordinacion: sub });
    lineas.push(`- Umbral de veredicto: ${fmtUFj(u)}${descU > 0 ? ` (−${pctj(descU)}%)` : ""} — al cruzarlo el análisis pasa a ${args.veredictoAlUmbral ?? "la banda de arriba"} (protagonista de \`posicion\` y del drawer de distancia).`);
    lineas.push(`  · Si citas umbral y techo en la misma pieza, usa esta subordinación tal cual (adapta lo mínimo): "${sub}". La banda de esfuerzo (ANCLAS) se narra UNA vez, del número que la trae — nunca rotules dos cifras con la misma banda.`);
  }

  // ── Flujo-neutro (referencia de caja — nunca objetivo) ──
  if (args.precioFlujoNeutroUF > 0) {
    const f = args.precioFlujoNeutroUF;
    const esRebaja = args.descuentoParaNeutro > 0;
    const casi = cercano(f, args.techoUF) || (args.umbralVeredictoUF !== null && cercano(f, args.umbralVeredictoUF));
    const sub = casi
      ? `casi coincide con ${cercano(f, args.techoUF) ? "el techo" : "el umbral de veredicto"} — nómbralo SOLO pegado a él, como el punto donde la caja queda en cero, nunca como un segundo objetivo`
      : `referencia de caja: a ${fmtUFj(f)} el arriendo cubre justo la cuota — es el punto donde la caja queda en cero, no el número a pelear`;
    precios.push({ rol: "flujo_neutro", uf: f, pct: esRebaja ? args.descuentoParaNeutro : null, subordinacion: sub });
    lineas.push(`- Flujo-neutro: ${args.lecturaFlujoNeutro} — NUNCA objetivo de negociación. Si lo nombras: "${sub}".`);
  }

  // ── Límite TIR (contexto del techo; omitido si <2% del techo o sin capital) ──
  if (args.limiteTirUF !== null && args.limiteTirUF > 0 && !args.sinCapitalPropio && !cercano(args.limiteTirUF, args.techoUF)) {
    const l = args.limiteTirUF;
    const descL = desc(l);
    const sub = `contexto del techo: bajo ${fmtUFj(l)} la TIR deja de justificar el capital — no es un descuento aparte ni un objetivo`;
    precios.push({ rol: "limite_tir", uf: l, pct: descL > 0 ? descL : null, subordinacion: sub });
    lineas.push(`- Límite TIR: ${fmtUFj(l)}${descL > 0 ? ` (−${pctj(descL)}%)` : ""} — ${sub}.`);
  }

  if (precios.length === 0) return { precios, bloque: "" };

  const protagonistas = umbralDistinto
    ? "\`negociacion\` → el techo · \`posicion\` y el drawer de distancia → el umbral de veredicto · \`costoMensual\`/\`reestructuracion\` → SIN objetivo de precio (sus palancas son pie/tasa/plazo)"
    : "\`negociacion\`, \`posicion\` y el drawer de distancia → el techo · \`costoMensual\`/\`reestructuracion\` → SIN objetivo de precio (sus palancas son pie/tasa/plazo)";

  const bloque = `

=== JERARQUÍA DE PRECIOS DE ESTE CASO (§1.12.6 — cifras canónicas: cita de AQUÍ con estos números EXACTOS; PROHIBIDO derivar % propios, recalcular descuentos o crear segundos objetivos) ===
Protagonista por pieza: ${protagonistas}. Cada pieza cita SU protagonista; cualquier otro precio de esta lista solo puede aparecer CON su línea de subordinación.
${lineas.join("\n")}`;

  return { precios, bloque };
}

// ─── GUARD (capa 2) ─────────────────────────────────────────────────────────

/**
 * Marcadores de subordinación que satisfacen el guard: las frases canónicas del
 * bloque MÁS las formas orgánicas con que la prosa real subordina (medidas en la
 * validación FP sobre las 177 del re-censo: "ese es el umbral de caja, no el
 * precio objetivo", "es de caja, no de negociación" — subordinaciones legítimas
 * que un regex solo-canónico marcaba como colisión).
 */
export const MARCADOR_SUBORDINACION =
  /(el que manda|pelea (primero )?por|n[uú]mero de la mesa|referencia de caja|caja queda en cero|no es (el|un|tu) (n[uú]mero|objetivo|segundo objetivo)|tu tope, no|no lo pelees|contexto del techo|cambia la conclusi[oó]n|un solo n[uú]mero, doble raz[oó]n|casi coincide|piso absoluto|no un segundo objetivo|hasta d[oó]nde llegar|no (es|de) negociaci[oó]n|umbral de caja|de caja, no|no (el|es el) precio objetivo|preguntas distintas|no (el|es el) (precio )?objetivo de negociaci[oó]n)/i;

export interface ColisionJerarquia {
  pieza: string;
  roles: RolPrecio[];
}

/** Menciones de cifras canónicas en un texto: % (±0,25 pp) o UF (±2). */
function rolesEnTexto(texto: string, precios: PrecioCanonico[]): Set<RolPrecio> {
  const roles = new Set<RolPrecio>();
  const nums: number[] = [];
  const rePct = /(\d{1,3}(?:,\d{1,2})?)\s?%/g;
  let m: RegExpExecArray | null;
  while ((m = rePct.exec(texto)) !== null) nums.push(parseFloat(m[1].replace(",", ".")));
  const reUF = /UF\s?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/g;
  const ufs: number[] = [];
  while ((m = reUF.exec(texto)) !== null) ufs.push(parseFloat(m[1].replace(/\./g, "").replace(",", ".")));
  for (const p of precios) {
    const porPct = p.pct !== null && nums.some((n) => Math.abs(n - (p.pct as number)) <= 0.25);
    const porUF = ufs.some((v) => Math.abs(v - p.uf) <= 2);
    if (porPct || porUF) roles.add(p.rol);
  }
  return roles;
}

/**
 * Núcleo del guard, sobre pares {pieza, texto}. Colisión = una pieza cita ≥2
 * cifras canónicas de roles DISTINTOS sin marcador de subordinación. Expuesto
 * a este nivel para el test de regresión y la validación de falsos positivos
 * sobre los informes ensamblados del re-censo (que son texto, no JSON).
 */
export function detectarColisionesEnTexto(
  piezas: { pieza: string; texto: string }[],
  precios: PrecioCanonico[],
): ColisionJerarquia[] {
  if (precios.length < 2) return [];
  const out: ColisionJerarquia[] = [];
  for (const { pieza, texto } of piezas) {
    if (!texto) continue;
    const roles = rolesEnTexto(texto, precios);
    if (roles.size >= 2 && !MARCADOR_SUBORDINACION.test(texto)) {
      out.push({ pieza, roles: Array.from(roles) });
    }
  }
  return out;
}

/** Mapa pieza → textos del JSON LTR (solo prosa IA; los drawers de motor son coherentes por construcción). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function piezasDeAiLtr(ai: any): { pieza: string; texto: string; campos: string[] }[] {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return [
    { pieza: "conviene.respuestaDirecta", campos: ["conviene.respuestaDirecta_clp", "conviene.respuestaDirecta_uf"], texto: `${s(ai?.conviene?.respuestaDirecta_clp)}\n${s(ai?.conviene?.respuestaDirecta_uf)}` },
    { pieza: "posicion", campos: ["conviene.cajaAccionable_clp", "conviene.cajaAccionable_uf"], texto: `${s(ai?.conviene?.cajaAccionable_clp)}\n${s(ai?.conviene?.cajaAccionable_uf)}` },
    {
      pieza: "negociacion", campos: ["negociacion.contenido_clp", "negociacion.contenido_uf", "negociacion.estrategiaSugerida_clp", "negociacion.estrategiaSugerida_uf", "negociacion.cajaAccionable_clp", "negociacion.cajaAccionable_uf"],
      texto: [ai?.negociacion?.contenido_clp, ai?.negociacion?.contenido_uf, ai?.negociacion?.estrategiaSugerida_clp, ai?.negociacion?.estrategiaSugerida_uf, ai?.negociacion?.cajaAccionable_clp, ai?.negociacion?.cajaAccionable_uf, ai?.negociacion?.precios?.glosaPrimeraOferta_clp, ai?.negociacion?.precios?.glosaPrimeraOferta_uf, ai?.negociacion?.precios?.glosaWalkAway_clp, ai?.negociacion?.precios?.glosaWalkAway_uf].map(s).join("\n"),
    },
    { pieza: "costoMensual", campos: ["costoMensual.contenido_clp", "costoMensual.contenido_uf", "costoMensual.cajaAccionable_clp", "costoMensual.cajaAccionable_uf"], texto: [ai?.costoMensual?.contenido_clp, ai?.costoMensual?.contenido_uf, ai?.costoMensual?.cajaAccionable_clp, ai?.costoMensual?.cajaAccionable_uf].map(s).join("\n") },
    { pieza: "reestructuracion", campos: ["reestructuracion.contenido_clp", "reestructuracion.contenido_uf"], texto: [ai?.reestructuracion?.contenido_clp, ai?.reestructuracion?.contenido_uf].map(s).join("\n") },
    { pieza: "largoPlazo", campos: ["largoPlazo.contenido_clp", "largoPlazo.contenido_uf"], texto: [ai?.largoPlazo?.contenido_clp, ai?.largoPlazo?.contenido_uf].map(s).join("\n") },
  ];
}

/** Colisiones sobre el JSON LTR parseado (wrapper de producción). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function detectarColisionesJerarquia(ai: any, precios: PrecioCanonico[]): ColisionJerarquia[] {
  return detectarColisionesEnTexto(piezasDeAiLtr(ai), precios);
}

/** Correctivo del retry quirúrgico: nombra qué chocó y cuál manda. */
export function correctivoJerarquia(colisiones: ColisionJerarquia[], precios: PrecioCanonico[]): string {
  const detalle = colisiones
    .map((c) => `${c.pieza} cita a la vez [${c.roles.join(" + ")}] sin decir cuál manda`)
    .join("; ");
  const subs = precios.filter((p) => p.subordinacion).map((p) => `· ${p.rol}: "${p.subordinacion}"`).join("\n");
  return `

⚠️ CORRECCIÓN DE JERARQUÍA DE PRECIOS (§1.12.6): la versión anterior mezcló precios de roles distintos sin subordinación — ${detalle}. Cada pieza cita SU protagonista (ver bloque JERARQUÍA DE PRECIOS); si nombras un segundo precio de la lista, incluye su línea de subordinación TAL CUAL:
${subs}
Reescribe el JSON COMPLETO respetando la doctrina §1-§17.`;
}

/**
 * Fallback determinístico (2ª falla): appendea la línea de arbitraje canónica a
 * los campos de la pieza ofensora. Muta `ai` in place; devuelve cuántos campos tocó.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function appendArbitrajeCanonico(ai: any, colisiones: ColisionJerarquia[], precios: PrecioCanonico[]): number {
  const piezas = piezasDeAiLtr(ai);
  let tocados = 0;
  for (const c of colisiones) {
    // La línea del rol subordinado presente en la colisión (el primero con subordinación).
    const linea = c.roles.map((r) => precios.find((p) => p.rol === r && p.subordinacion)).find(Boolean)?.subordinacion;
    if (!linea) continue;
    const def = piezas.find((p) => p.pieza === c.pieza);
    if (!def) continue;
    for (const campo of def.campos) {
      const [a, b] = campo.split(".");
      const obj = ai?.[a];
      if (obj && typeof obj[b] === "string" && obj[b].length > 0 && !MARCADOR_SUBORDINACION.test(obj[b])) {
        obj[b] = `${obj[b].replace(/\s+$/, "")} ${linea.charAt(0).toUpperCase()}${linea.slice(1)}.`;
        tocados++;
      }
    }
  }
  return tocados;
}
