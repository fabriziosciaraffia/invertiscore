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

/** Versión del prompt. Un bump obliga a regenerar el parque completo. */
export const PROMPT_VERSION_COMUNA = 1;

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
