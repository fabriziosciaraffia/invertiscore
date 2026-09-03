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

/** Un nombre por precio (goal 02-sep-2026): objetivo = "donde cambia el veredicto" ·
 *  sostenible = "donde el aporte se vuelve sostenible" · flujo_neutro = "caja en cero" ·
 *  limite_tir = "límite TIR 6%" · minimo_fuera_rango = "lo que haría falta, fuera de rango"
 *  (solo estructural). "techo" murió como rol. */
export type RolPrecio = "objetivo" | "sostenible" | "flujo_neutro" | "limite_tir" | "minimo_fuera_rango";

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
  /** Umbral de veredicto dentro del tope: "donde cambia el veredicto". null sin umbral. */
  objetivoUF: number | null;
  veredictoAlUmbral: string | null;
  /** Sugerido del motor: "donde el aporte se vuelve sostenible". */
  sostenibleUF: number;
  modoSugerido: "cerrar_actual" | "optimizar_flujo" | "alinear_mercado";
  /** Caso estructural: sin objetivo ni plan; solo lo que haría falta, fuera de rango. */
  esEstructural: boolean;
  minimoFueraDeRangoUF: number | null;
  minimoFueraDeRangoPct: number | null;
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
  const destino = args.veredictoAlUmbral ?? "la banda de arriba";

  if (args.esEstructural) {
    // ── Estructural: NO hay objetivo ni plan. Lo único citable es lo que haría falta. ──
    if (args.minimoFueraDeRangoUF !== null && args.minimoFueraDeRangoUF > 0) {
      const m = args.minimoFueraDeRangoUF;
      const descM = args.minimoFueraDeRangoPct !== null ? Math.abs(args.minimoFueraDeRangoPct) : desc(m);
      const sub = "es lo que haría falta y queda fuera de rango: no es objetivo ni oferta — se cita solo para cerrar la puerta";
      precios.push({ rol: "minimo_fuera_rango", uf: m, pct: descM > 0 ? descM : null, subordinacion: sub });
      lineas.push(`- Lo que haría falta, fuera de rango: ${fmtUFj(m)} (−${pctj(descM)}%) — ${sub}.`);
    }
  } else {
    // ── Objetivo del plan: el umbral cuando existe; sin umbral (base COMPRAR), el sostenible ──
    const objetivo = args.objetivoUF !== null && args.objetivoUF > 0 ? args.objetivoUF : args.sostenibleUF;
    const esUmbral = args.objetivoUF !== null && args.objetivoUF > 0;
    const descO = desc(objetivo);
    precios.push({ rol: "objetivo", uf: objetivo, pct: descO > 0 ? descO : null, subordinacion: "" });
    if (esUmbral) {
      lineas.push(`- Objetivo del plan — donde cambia el veredicto: ${fmtUFj(objetivo)}${descO > 0 ? ` (−${pctj(descO)}% del pedido)` : ""} — al cerrar ahí el análisis pasa a ${destino}; es el número de la mesa (protagonista de \`negociacion\` y de \`posicion\`). Sobre ese precio el veredicto sigue siendo el de hoy; bajo ese precio ya es ${destino}.`);
    } else if (args.modoSugerido === "cerrar_actual") {
      lineas.push(`- Objetivo del plan: ${fmtUFj(objetivo)} — IGUAL al precio pedido (modo cerrar_actual): el aporte ya es sostenible a este precio, no hay descuento que pedir.`);
    } else {
      lineas.push(`- Objetivo del plan — donde el aporte se vuelve sostenible: ${fmtUFj(objetivo)}${descO > 0 ? ` (−${pctj(descO)}% del pedido)` : ""} — el número de la mesa (protagonista de \`negociacion\` y de \`posicion\`). No cambia el veredicto: este caso no tiene umbral dentro de rango.`);
    }
    // ── Sostenible, como dato aparte cuando el objetivo es el umbral ──
    if (esUmbral && !cercano(args.sostenibleUF, objetivo)) {
      const sost = args.sostenibleUF;
      const descS = desc(sost);
      const sub =
        sost < objetivo
          ? `dato de caja, no un segundo objetivo: queda bajo el objetivo, o sea dentro de la zona donde el veredicto ya es ${destino}; es hasta dónde seguir si la conversación da, y nunca "sobre esto no compras"`
          : `dato de caja, no un segundo objetivo: queda SOBRE el objetivo, o sea a ese precio el veredicto todavía no cambia`;
      precios.push({ rol: "sostenible", uf: sost, pct: descS > 0 ? descS : null, subordinacion: sub });
      lineas.push(`- Donde el aporte se vuelve sostenible: ${fmtUFj(sost)}${descS > 0 ? ` (−${pctj(descS)}%)` : ""} — ${args.modoSugerido === "alinear_mercado" ? "precio alineado con el mercado" : "el aporte mensual baja a un nivel sostenible"}. ${sub}.`);
    }
  }
  // ── Flujo-neutro (caja en cero — nunca objetivo) ──
  if (args.precioFlujoNeutroUF > 0) {
    const f = args.precioFlujoNeutroUF;
    const esRebaja = args.descuentoParaNeutro > 0;
    const objetivoRef = precios.find((x) => x.rol === "objetivo")?.uf ?? null;
    const casi = (objetivoRef !== null && cercano(f, objetivoRef));
    const sub = casi
      ? "casi coincide con el objetivo — nómbralo SOLO pegado a él, como el punto donde la caja queda en cero, nunca como un segundo objetivo"
      : `referencia de caja: a ${fmtUFj(f)} el arriendo cubre justo la cuota — es el punto donde la caja queda en cero, no el número a pelear`;
    precios.push({ rol: "flujo_neutro", uf: f, pct: esRebaja ? args.descuentoParaNeutro : null, subordinacion: sub });
    lineas.push(`- Caja en cero: ${args.lecturaFlujoNeutro} — NUNCA objetivo de negociación. Si lo nombras: "${sub}".`);
  }
  // ── Límite TIR 6% (contexto; omitido si <2% del objetivo o sin capital) ──
  const objetivoRef2 = precios.find((x) => x.rol === "objetivo")?.uf ?? null;
  if (args.limiteTirUF !== null && args.limiteTirUF > 0 && !args.sinCapitalPropio && !(objetivoRef2 !== null && cercano(args.limiteTirUF, objetivoRef2))) {
    const l = args.limiteTirUF;
    const descL = desc(l);
    const sub = `límite TIR 6%: sobre ${fmtUFj(l)} la TIR deja de justificar el capital — contexto, no un descuento aparte ni un objetivo`;
    precios.push({ rol: "limite_tir", uf: l, pct: descL > 0 ? descL : null, subordinacion: sub });
    lineas.push(`- Límite TIR 6%: ${fmtUFj(l)}${descL > 0 ? ` (−${pctj(descL)}%)` : ""} — ${sub}.`);
  }
  if (precios.length === 0) return { precios, bloque: "" };

  const protagonistas = args.esEstructural
    ? "\`negociacion\` → SIN plan ni precio objetivo (cierra por la alternativa) · \`posicion\` → solo lo que haría falta, fuera de rango · \`costoMensual\`/\`reestructuracion\` → SIN objetivo de precio"
    : "\`negociacion\`, \`posicion\` y el drawer de distancia → el objetivo del plan · \`costoMensual\`/\`reestructuracion\` → SIN objetivo de precio (sus palancas son pie/tasa/plazo)";

  const bloque = `

=== JERARQUÍA DE PRECIOS DE ESTE CASO (§1.12.6 — cifras canónicas con SU nombre: cita de AQUÍ con estos números EXACTOS y llama a cada precio por su nombre; PROHIBIDO derivar % propios, recalcular descuentos, crear segundos objetivos o llamar a un precio con un nombre que no sea el suyo) ===
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
  /(fuera de rango|lo que har[ií]a falta|dato de caja|donde el aporte|donde cambia el veredicto|l[ií]mite TIR|el que manda|pelea (primero )?por|n[uú]mero de la mesa|referencia de caja|caja queda en cero|no es (el|un|tu) (n[uú]mero|objetivo|segundo objetivo)|tu tope, no|no lo pelees|contexto del techo|cambia la conclusi[oó]n|un solo n[uú]mero, doble raz[oó]n|casi coincide|piso absoluto|no un segundo objetivo|hasta d[oó]nde llegar|no (es|de) negociaci[oó]n|umbral de caja|de caja, no|no (el|es el) precio objetivo|preguntas distintas|no (el|es el) (precio )?objetivo de negociaci[oó]n)/i;

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
