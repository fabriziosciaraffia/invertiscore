// ─────────────────────────────────────────────────────────────────────────
// Prosa de Franco por comuna: lectura y detección de drift.
//
// La prosa se genera UNA vez por comuna y se persiste con el snapshot de los
// números que narró (tabla `comuna_prosa`, migración 20260828). Nunca se genera
// en render. Acá vive lo que el render necesita —leerla— y lo que el generador
// necesita —saber si quedó desfasada—.
//
// POR QUÉ HAY DRIFT. Los números de la comuna se recomputan solos cada 24h
// desde el scraping. La prosa cita cifras concretas, así que puede quedar
// afirmando algo que dejó de ser cierto. El caso testigo ocurrió durante la
// implementación: Providencia dio vuelta su veredicto en cuatro días — su 4D
// pasó de faltarle $23.418 a sobrarle $99.734. Una prosa de esa semana estaría
// diciendo lo contrario de la tabla que tiene al lado.
//
// QUÉ SE HACE CON EL DRIFT. Se MARCA, no se corrige ni se oculta: el render
// publica lo que hay (una cifra movida 2% no vuelve falso el párrafo) y el
// generador usa la marca para decidir qué rehacer en el próximo lote.
// ─────────────────────────────────────────────────────────────────────────

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import type { ComunaStats } from "@/lib/data/comunas-seo";
import { PLUSVALIA_ESTIMADO, coberturaPlusvaliaDe } from "@/lib/plusvalia-estimado.gen";

/** Versión del prompt. Un bump obliga a regenerar el parque completo.
 *  v2: unidades explícitas por cifra + guard de coherencia numérica. La v1
 *  producía errores de unidad que el guard de forma no veía — Macul publicó
 *  "UF 174.210 mensuales" por una brecha que estaba en PESOS, y Cerrillos dio
 *  dos precios de equilibrio distintos para la misma tipología. */
export const PROMPT_VERSION_COMUNA = 2;

/** Lo que la prosa narró, por tipología. Solo lo citable. */
export interface SnapshotTipologia {
  dorms: number;
  nArriendos: number;
  arriendoCLP: number;
  ventaUF: number;
  dividendoCLP: number;
  brechaCLP: number;
  cubre: boolean;
  precioCuotaUF: number;
  deltaPct: number;
  muestraChica: boolean;
}

export interface SnapshotProsa {
  tipologias: SnapshotTipologia[];
  tasaAnual: number;
  piePct: number;
  plazoAnos: number;
  /** Dormitorios de la tipología que encabezaba el relato. */
  liderDorms: number | null;
}

export interface ProsaComuna {
  slug: string;
  comuna: string;
  prosa: string;
  snapshot: SnapshotProsa;
  promptVersion: number;
  modelo: string;
  generadaEn: string;
}

/** Construye el snapshot a partir de las stats vivas. */
export function snapshotDe(stats: ComunaStats, liderDorms: number | null): SnapshotProsa {
  return {
    tipologias: stats.tipologias.map((t) => ({
      dorms: t.dorms,
      nArriendos: t.nArriendos,
      arriendoCLP: t.arriendoCLP,
      ventaUF: t.ventaUF,
      dividendoCLP: t.dividendoCLP,
      brechaCLP: t.brechaCLP,
      cubre: t.cubre,
      precioCuotaUF: t.precioCuotaUF,
      deltaPct: t.deltaPct,
      muestraChica: t.muestraChica,
    })),
    tasaAnual: stats.supuestos.tasaAnual,
    piePct: stats.supuestos.piePct,
    plazoAnos: stats.supuestos.plazoAnos,
    liderDorms,
  };
}

/** Cuánto puede moverse una cifra citada antes de que la prosa quede vieja. */
const TOLERANCIA_PCT = 3;

export type MotivoDrift =
  | "sin-prosa"
  | "version-de-prompt"
  | "cambio-de-tipologias"
  | "veredicto-dado-vuelta"
  | "cambio-de-lider"
  | "cifra-movida"
  | "supuestos-movidos";

export interface Drift {
  hayDrift: boolean;
  motivos: MotivoDrift[];
  detalle: string[];
}

function movio(antes: number, ahora: number, tolPct = TOLERANCIA_PCT): boolean {
  if (antes === 0) return ahora !== 0;
  return Math.abs((ahora - antes) / antes) * 100 > tolPct;
}

/**
 * Compara la foto que narró la prosa contra los números vivos.
 * El motivo más grave —y el que obliga a regenerar sí o sí— es que una
 * tipología haya cambiado de lado: ahí la prosa afirma lo contrario del dato.
 */
export function detectarDrift(
  prosa: ProsaComuna | null,
  stats: ComunaStats,
  liderDorms: number | null
): Drift {
  const motivos: MotivoDrift[] = [];
  const detalle: string[] = [];

  if (!prosa) {
    return { hayDrift: true, motivos: ["sin-prosa"], detalle: ["la comuna no tiene prosa generada"] };
  }
  if (prosa.promptVersion !== PROMPT_VERSION_COMUNA) {
    motivos.push("version-de-prompt");
    detalle.push(`prompt v${prosa.promptVersion} vs v${PROMPT_VERSION_COMUNA} vigente`);
  }

  const antes = prosa.snapshot;
  const porDorms = new Map(antes.tipologias.map((t) => [t.dorms, t]));

  if (antes.tipologias.length !== stats.tipologias.length) {
    motivos.push("cambio-de-tipologias");
    detalle.push(`${antes.tipologias.length} tipologías al generar, ${stats.tipologias.length} ahora`);
  }
  if (antes.liderDorms !== liderDorms) {
    motivos.push("cambio-de-lider");
    detalle.push(`lideraba el ${antes.liderDorms}D, ahora el ${liderDorms}D`);
  }

  for (const t of stats.tipologias) {
    const a = porDorms.get(t.dorms);
    if (!a) {
      motivos.push("cambio-de-tipologias");
      detalle.push(`el ${t.dorms}D no existía al generar`);
      continue;
    }
    if (a.cubre !== t.cubre) {
      motivos.push("veredicto-dado-vuelta");
      detalle.push(
        `el ${t.dorms}D ${a.cubre ? "se pagaba solo y ahora no" : "no se pagaba solo y ahora sí"}`
      );
    }
    if (movio(a.arriendoCLP, t.arriendoCLP)) {
      motivos.push("cifra-movida");
      detalle.push(`arriendo ${t.dorms}D: ${a.arriendoCLP} → ${t.arriendoCLP}`);
    }
    if (movio(a.ventaUF, t.ventaUF)) {
      motivos.push("cifra-movida");
      detalle.push(`precio ${t.dorms}D: UF ${a.ventaUF} → UF ${t.ventaUF}`);
    }
    if (movio(a.precioCuotaUF, t.precioCuotaUF)) {
      motivos.push("cifra-movida");
      detalle.push(`equilibrio ${t.dorms}D: UF ${a.precioCuotaUF} → UF ${t.precioCuotaUF}`);
    }
  }

  // La tasa mueve TODOS los dividendos y precios de equilibrio a la vez.
  if (Math.abs(antes.tasaAnual - stats.supuestos.tasaAnual) > 0.2) {
    motivos.push("supuestos-movidos");
    detalle.push(`tasa ${antes.tasaAnual}% → ${stats.supuestos.tasaAnual}%`);
  }
  if (antes.piePct !== stats.supuestos.piePct || antes.plazoAnos !== stats.supuestos.plazoAnos) {
    motivos.push("supuestos-movidos");
    detalle.push("cambió el pie o el plazo de referencia");
  }

  return {
    hayDrift: motivos.length > 0,
    motivos: Array.from(new Set(motivos)),
    detalle,
  };
}

function getSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface FilaProsa {
  slug: string;
  comuna: string;
  prosa: string;
  snapshot: SnapshotProsa;
  prompt_version: number;
  modelo: string;
  generada_en: string;
}

function aProsa(f: FilaProsa): ProsaComuna {
  return {
    slug: f.slug,
    comuna: f.comuna,
    prosa: f.prosa,
    snapshot: f.snapshot,
    promptVersion: f.prompt_version,
    modelo: f.modelo,
    generadaEn: f.generada_en,
  };
}

/**
 * Prosa de una comuna. `null` cuando no hay — la página cae a su síntesis
 * calculada, que nunca miente aunque diga menos.
 */
export async function getProsaComuna(slug: string): Promise<ProsaComuna | null> {
  const { data, error } = await getSupabase()
    .from("comuna_prosa")
    .select("slug, comuna, prosa, snapshot, prompt_version, modelo, generada_en")
    .eq("slug", slug)
    .maybeSingle();
  reportarFalloQuery(error, { ruta: "lib/data/comuna-prosa", operacion: "leer-prosa", tags: { slug } });
  return data ? aProsa(data as FilaProsa) : null;
}

/** Todas las prosas, para el generador del lote. */
export async function getTodasLasProsas(): Promise<Map<string, ProsaComuna>> {
  const { data, error } = await getSupabase()
    .from("comuna_prosa")
    .select("slug, comuna, prosa, snapshot, prompt_version, modelo, generada_en");
  reportarFalloQuery(error, { ruta: "lib/data/comuna-prosa", operacion: "leer-prosas" });
  const m = new Map<string, ProsaComuna>();
  for (const f of (data ?? []) as FilaProsa[]) m.set(f.slug, aProsa(f));
  return m;
}

// ─────────────────────────────────────────────────────────────────────────
// Guard de coherencia numérica
//
// El guard de forma (largo, voseo, markdown) valida CÓMO está escrito el
// párrafo, no si dice la verdad. En el primer lote se colaron errores de
// unidad que ninguna regla de forma podía ver:
//   · Macul: "una brecha de UF 174.210 mensuales" — ese número existe, pero en
//     PESOS. En UF serían ~7.000 millones al mes.
//   · Cerrillos: dos precios de equilibrio distintos para el mismo 2D en el
//     mismo párrafo ("sobre UF 2.851" y "supera UF 2.814"). Uno estaba mal.
//
// La defensa es la misma idea del test de propiedad del helper: atar la salida
// a la fuente en vez de confiar en que salga bien. Toda cifra en pesos, UF o
// porcentaje que aparezca en la prosa tiene que EXISTIR en los datos que se le
// pasaron al modelo, con SU unidad. Si un valor existe pero en otra unidad, el
// error lo dice — es el caso Macul y el más fácil de cometer.
// ─────────────────────────────────────────────────────────────────────────

/** Las cifras que el prompt entrega, agrupadas por unidad. */
export interface CifrasCitables {
  clp: Set<number>;
  uf: Set<number>;
  pct: Set<number>;
  /** Conteos y años: no se validan como magnitud, pero sirven al prompt. */
  enteros: Set<number>;
}

/**
 * Qué puede citar la prosa. Se construye de las MISMAS stats que alimentan el
 * prompt, así que si el prompt cambia lo que muestra, esto lo sigue.
 */
export function cifrasCitables(stats: ComunaStats): CifrasCitables {
  const clp = new Set<number>();
  const uf = new Set<number>();
  const pct = new Set<number>();
  const enteros = new Set<number>();

  for (const t of stats.tipologias) {
    clp.add(t.arriendoCLP);
    clp.add(t.dividendoCLP);
    clp.add(Math.abs(t.brechaCLP));
    uf.add(t.ventaUF);
    uf.add(t.precioCuotaUF);
    pct.add(t.rentabilidadBruta);
    pct.add(Math.abs(Math.round(t.deltaPct * 10) / 10));
    if (t.pieNecesarioPct !== null) pct.add(t.pieNecesarioPct);
    enteros.add(t.nArriendos);
    enteros.add(t.nVentas);
    enteros.add(t.dorms);
  }
  pct.add(stats.supuestos.piePct);
  pct.add(stats.supuestos.tasaAnual);

  // Plusvalía: el prompt la entrega cuando la comuna tiene trayectoria, así que
  // el modelo la cita con razón. Sin esto el guard rechazaba párrafos correctos
  // — el conjunto permitido tiene que cubrir TODO lo que el prompt muestra.
  const cob = coberturaPlusvaliaDe(stats.nombre);
  const pv = PLUSVALIA_ESTIMADO[stats.nombre];
  if (pv && (cob === "trayectoria_gfk" || cob === "nivel_mas_ac" || cob === "solo_ac")) {
    pct.add(pv.plusvalia10a);
    pct.add(pv.anualizada);
    uf.add(pv.precioInicio);
    uf.add(pv.precioFin);
    for (const anio of pv.rangoHist.split("-")) enteros.add(Number(anio));
  }
  enteros.add(stats.supuestos.plazoAnos);
  enteros.add(stats.tipologias.length);
  enteros.add(stats.tipologias.filter((t) => t.cubre).length);
  enteros.add(stats.procedencia.enCalculo);
  enteros.add(stats.procedencia.activosTotales);

  return { clp, uf, pct, enteros };
}

/** "1.234.567" → 1234567 · "3,5" → 3.5 */
function aNumero(bruto: string): number {
  return parseFloat(bruto.replace(/\./g, "").replace(",", "."));
}

/** Un porcentaje calza si coincide al decimal, con o sin el ",0". */
function calzaPct(valor: number, permitidos: Set<number>): boolean {
  for (const p of Array.from(permitidos)) {
    if (Math.abs(p - valor) < 0.05) return true;
  }
  return false;
}

/**
 * Toda cifra en $, UF o % del párrafo tiene que existir en los datos con su
 * unidad. Devuelve la lista de problemas; vacía = coherente.
 */
export function validarCoherenciaNumerica(texto: string, stats: ComunaStats): string[] {
  const c = cifrasCitables(stats);
  const errores: string[] = [];

  // Pesos: $1.234.567
  for (const m of Array.from(texto.matchAll(/\$\s?([\d.]+)/g))) {
    const v = aNumero(m[1]);
    if (c.clp.has(v)) continue;
    errores.push(
      c.uf.has(v)
        ? `"$${m[1]}" no existe en pesos — ese valor está en UF (unidad cambiada)`
        : `"$${m[1]}" no está en los datos`
    );
  }

  // UF: UF 1.234 (y "UF 1.234,5" por si acaso)
  for (const m of Array.from(texto.matchAll(/UF\s?([\d.,]+)/gi))) {
    const v = aNumero(m[1].replace(/[.,]$/, ""));
    if (!Number.isFinite(v)) continue;
    if (c.uf.has(v)) continue;
    errores.push(
      c.clp.has(v)
        ? `"UF ${m[1]}" no existe en UF — ese valor está en pesos (unidad cambiada)`
        : `"UF ${m[1]}" no está en los datos`
    );
  }

  // Porcentajes: 3,5% · 33%
  for (const m of Array.from(texto.matchAll(/([\d]+(?:[.,]\d+)?)\s?%/g))) {
    const v = aNumero(m[1]);
    if (calzaPct(v, c.pct)) continue;
    errores.push(`"${m[1]}%" no está en los datos`);
  }

  return errores;
}

// ─────────────────────────────────────────────────────────────────────────
// Guard de ROLES
//
// El guard de coherencia verifica que cada cifra EXISTA con su unidad. No ve
// si está en el papel correcto. Pudahuel pasó los dos guards anteriores con
// esto: "un margen de UF 2.883 antes de dejar de ser autosustentable, un 57,1%
// sobre la mediana". Las dos cifras existen y con su unidad correcta — pero
// UF 2.883 es el PRECIO DE EQUILIBRIO, no el margen; el margen es el 57,1%.
// Número correcto, rol equivocado: el error de Macul en otra forma.
//
// ALCANCE — a propósito estrecho. Esto NO es un verificador semántico: caza la
// confusión concreta que ocurrió (un sustantivo de porcentaje introduciendo un
// precio, y al revés), con una ventana corta para no castigar frases legítimas
// como "margen de 22,5% hasta el precio de equilibrio en UF 2.498". Verificado
// sobre el corpus de 24 párrafos: cero falsos positivos. Los errores de rol que
// esta regla no cubre viven en el prompt y en la revisión humana, no acá.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Un sustantivo de PORCENTAJE al que se le ATRIBUYE un precio en UF.
 * El conector importa: "margen DE UF 2.883" dice que el margen ES ese precio y
 * está mal; "margen HASTA UF 1.787" dice hasta qué precio llega la holgura y es
 * correcto. Por eso solo se aceptan los conectores atributivos.
 */
const MARGEN_CON_PRECIO = /(margen|colch[óo]n|holgura)\s+(de|del|es|:)\s*UF\s?[\d.]+/i;
/** El precio de equilibrio expresado como monto mensual o como porcentaje. */
const EQUILIBRIO_SIN_PRECIO = /precio de equilibrio[^.;]{0,15}?(\$\s?[\d.]+|[\d]+(?:[.,]\d+)?\s?%)/i;

export function validarRolesDeCifras(texto: string): string[] {
  const errores: string[] = [];
  const m1 = texto.match(MARGEN_CON_PRECIO);
  if (m1) {
    errores.push(
      `rol equivocado: "${m1[0].trim()}" — el margen es un porcentaje, no un precio en UF`
    );
  }
  const m2 = texto.match(EQUILIBRIO_SIN_PRECIO);
  if (m2) {
    errores.push(
      `rol equivocado: "${m2[0].trim()}" — el precio de equilibrio es un precio en UF`
    );
  }
  return errores;
}
