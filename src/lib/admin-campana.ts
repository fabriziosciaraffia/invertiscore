// ─────────────────────────────────────────────────────────────────────────────
// EL PANEL DE LA CAMPAÑA (12-nov-2026, campaña de noviembre, fase 0; decisión de Fabrizio: la verdad de la campaña sale de
// nuestra base, no del panel de Meta). /admin/campana. Solo cuentas reales (fuera `test_accounts`).
//   · POR CONJUNTO (utm_content) Y POR SEMANA DE LLEGADA. La llegada es la hora del clic del anuncio que la cuenta guardó (el
//     `fbc`, `fb.1.<ms>.<fbclid>`: la cookie del origen o la de Meta); sin clic, la creación de la cuenta. La semana empieza el
//     lunes, hora de Chile.
//   · EL GASTO SE INGRESA A MANO por conjunto y semana (config `campana_gasto`, un JSON { "<conjunto>|<lunes>": pesos }).
//   · POR FILA: registros, costo por registro, el % que usa el regalo en 24 horas, el % que se inscribe en Invierte con Franco y
//     las compras; y lo mismo a 30 días de cada registro (la cohorte; «en curso» si su semana no cumplió 30 días).
//   · «USA EL REGALO»: su regalo de alta (credit_grants `regalo_alta`) ya se gastó y la cuenta tiene un análisis dentro de la
//     ventana desde que se registró. La base no guarda la hora en que se consume un crédito: es la medida más cercana.
//   · COMPRAS: pagos `paid` con monto mayor que cero.
// Lo fija el tier CAMPANA-FASE0.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";

export const CLAVE_GASTO = "campana_gasto";
export const SIN_CONJUNTO = "(sin conjunto)";
const DIA_MS = 24 * 60 * 60 * 1000;
export const VENTANA_24H_MS = DIA_MS;
export const VENTANA_30D_MS = 30 * DIA_MS;

export interface CuentaCampana {
  userId: string;
  creadaAt: string;
  utmSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  fbc: string | null;
}

export interface DatosCampana {
  cuentas: CuentaCampana[];
  prueba: ReadonlySet<string>;
  /** Cuentas cuyo regalo de alta ya se gastó. */
  regaloGastado: ReadonlySet<string>;
  /** Hora de cada análisis, por cuenta. */
  analisis: ReadonlyMap<string, number[]>;
  /** Hora de cada inscripción en Invierte con Franco, por cuenta. */
  inscripciones: ReadonlyMap<string, number[]>;
  /** Hora de cada compra pagada, por cuenta. */
  compras: ReadonlyMap<string, number[]>;
  gasto: Readonly<Record<string, number>>;
}

export interface Ventana { regalo: number; invierte: number; compras: number; regaloPct: number | null; invierte_pct: number | null }

export interface FilaCampana {
  conjunto: string;
  semana: string;
  clave: string;
  gasto: number | null;
  registros: number;
  costoPorRegistro: number | null;
  h24: Ventana;
  d30: Ventana;
  /** La semana no cumplió 30 días: la cohorte a 30 días está en curso. */
  enCurso: boolean;
}

/** La hora del clic que guardó la cuenta (`fb.1.<ms>.<fbclid>`), o null. */
export function horaDelClic(fbc: string | null | undefined): number | null {
  const m = /^fb\.\d\.(\d{10,14})\./.exec(fbc ?? "");
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : null;
}

/** El lunes (AAAA-MM-DD, hora de Chile) de la semana de esa hora. */
export function lunesDe(ms: number): string {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date(ms));
  const p = (t: string) => dia.find((x) => x.type === t)?.value ?? "";
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p("weekday"));
  const base = Date.UTC(Number(p("year")), Number(p("month")) - 1, Number(p("day")));
  return new Date(base - Math.max(0, dow) * DIA_MS).toISOString().slice(0, 10);
}

export const claveGasto = (conjunto: string, semana: string) => `${conjunto}|${semana}`;

const enVentana = (horas: number[] | undefined, desde: number, ventana: number) => (horas ?? []).some((t) => t >= desde && t - desde <= ventana);
const cuantas = (horas: number[] | undefined, desde: number, ventana: number) => (horas ?? []).filter((t) => t >= desde && t - desde <= ventana).length;
const pct = (n: number, de: number) => (de > 0 ? Math.round((n / de) * 1000) / 10 : null);

/** El panel: una fila por conjunto y semana de llegada, solo con cuentas reales. Ordenado por semana (nueva primero) y conjunto. */
export function armarPanelCampana(d: DatosCampana, ahora: number = Date.now()): FilaCampana[] {
  const grupos = new Map<string, { conjunto: string; semana: string; cuentas: CuentaCampana[] }>();
  for (const c of d.cuentas) {
    if (d.prueba.has(c.userId)) continue;
    const creada = Date.parse(c.creadaAt);
    if (!Number.isFinite(creada)) continue;
    const llegada = horaDelClic(c.fbc) ?? creada;
    const conjunto = c.utmContent?.trim() || SIN_CONJUNTO;
    const semana = lunesDe(llegada);
    const k = claveGasto(conjunto, semana);
    const g = grupos.get(k) ?? { conjunto, semana, cuentas: [] };
    g.cuentas.push(c);
    grupos.set(k, g);
  }
  const filas: FilaCampana[] = [];
  for (const [clave, g] of Array.from(grupos.entries())) {
    const ventana = (ms: number): Ventana => {
      let regalo = 0, invierte = 0, compras = 0;
      for (const c of g.cuentas) {
        const t0 = Date.parse(c.creadaAt);
        if (d.regaloGastado.has(c.userId) && enVentana(d.analisis.get(c.userId), t0, ms)) regalo++;
        if (enVentana(d.inscripciones.get(c.userId), t0, ms)) invierte++;
        compras += cuantas(d.compras.get(c.userId), t0, ms);
      }
      return { regalo, invierte, compras, regaloPct: pct(regalo, g.cuentas.length), invierte_pct: pct(invierte, g.cuentas.length) };
    };
    const gasto = typeof d.gasto[clave] === "number" && Number.isFinite(d.gasto[clave]) ? d.gasto[clave] : null;
    filas.push({
      conjunto: g.conjunto,
      semana: g.semana,
      clave,
      gasto,
      registros: g.cuentas.length,
      costoPorRegistro: gasto != null && g.cuentas.length > 0 ? Math.round(gasto / g.cuentas.length) : null,
      h24: ventana(VENTANA_24H_MS),
      d30: ventana(VENTANA_30D_MS),
      enCurso: Date.parse(`${g.semana}T00:00:00-03:00`) + 7 * DIA_MS + VENTANA_30D_MS > ahora,
    });
  }
  return filas.sort((a, b) => (a.semana === b.semana ? a.conjunto.localeCompare(b.conjunto) : b.semana.localeCompare(a.semana)));
}

/** El gasto guardado, saneado: solo montos enteros y no negativos. */
export function leerGasto(raw: string | null | undefined): Record<string, number> {
  try {
    const x = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(x ?? {})) if (typeof v === "number" && Number.isFinite(v) && v >= 0 && k.includes("|")) out[k] = Math.round(v);
    return out;
  } catch {
    return {};
  }
}

// ── LA LECTURA (service role; todo paginado de a mil por PostgREST) ──────────
async function todas<T>(q: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await q(desde, desde + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

const porCuenta = (filas: Array<{ user_id: string; t: string }>): Map<string, number[]> => {
  const m = new Map<string, number[]>();
  for (const f of filas) {
    const t = Date.parse(f.t);
    if (!Number.isFinite(t)) continue;
    m.set(f.user_id, [...(m.get(f.user_id) ?? []), t]);
  }
  return m;
};

/** Las cuentas creadas desde `desde` (ISO) con su origen, y todo lo que el panel cruza. */
export async function leerDatosCampana(sb: SupabaseClient, desde: string): Promise<DatosCampana> {
  const usuarios: Array<{ id: string; created_at: string }> = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) if (u.created_at && u.created_at >= desde) usuarios.push({ id: u.id, created_at: u.created_at });
    if (data.users.length < 1000) break;
  }
  const [atrib, prueba, regalos, analisis, inscripciones, pagos, gasto] = await Promise.all([
    todas<{ user_id: string; utm_source: string | null; utm_campaign: string | null; utm_content: string | null; fbc: string | null }>((a, b) => sb.from("user_attribution").select("user_id, utm_source, utm_campaign, utm_content, fbc").order("user_id").range(a, b)),
    todas<{ user_id: string }>((a, b) => sb.from("test_accounts").select("user_id").order("user_id").range(a, b)),
    todas<{ user_id: string; amount: number; remaining: number; consumed: boolean | null }>((a, b) => sb.from("credit_grants").select("user_id, amount, remaining, consumed").eq("source", "regalo_alta").order("id").range(a, b)),
    todas<{ user_id: string; t: string }>((a, b) => sb.from("analisis").select("user_id, t:created_at").gte("created_at", desde).not("user_id", "is", null).order("id").range(a, b)),
    todas<{ user_id: string; t: string }>((a, b) => sb.from("invierte_inscripciones").select("user_id, t:created_at").gte("created_at", desde).order("id").range(a, b)),
    todas<{ user_id: string; t: string }>((a, b) => sb.from("payments").select("user_id, t:created_at").eq("status", "paid").gt("amount", 0).gte("created_at", desde).order("id").range(a, b)),
    sb.from("config").select("value").eq("key", CLAVE_GASTO).maybeSingle(),
  ]);
  const a = new Map(atrib.map((f) => [f.user_id, f]));
  return {
    cuentas: usuarios.map((u) => {
      const f = a.get(u.id);
      return { userId: u.id, creadaAt: u.created_at, utmSource: f?.utm_source ?? null, utmCampaign: f?.utm_campaign ?? null, utmContent: f?.utm_content ?? null, fbc: f?.fbc ?? null };
    }),
    prueba: new Set(prueba.map((f) => f.user_id)),
    regaloGastado: new Set(regalos.filter((g) => g.consumed === true || g.remaining < g.amount).map((g) => g.user_id)),
    analisis: porCuenta(analisis),
    inscripciones: porCuenta(inscripciones),
    compras: porCuenta(pagos),
    gasto: leerGasto((gasto.data as { value?: string } | null)?.value),
  };
}

/** Guarda el gasto de un conjunto y una semana (pesos enteros; null lo borra). */
export async function guardarGasto(sb: SupabaseClient, clave: string, monto: number | null): Promise<boolean> {
  if (!/^.{1,200}\|\d{4}-\d{2}-\d{2}$/.test(clave)) return false;
  const { data } = await sb.from("config").select("value").eq("key", CLAVE_GASTO).maybeSingle();
  const g = leerGasto((data as { value?: string } | null)?.value);
  if (monto == null) delete g[clave];
  else if (Number.isFinite(monto) && monto >= 0) g[clave] = Math.round(monto);
  else return false;
  const ahora = new Date().toISOString();
  const { error } = await sb.from("config").upsert({ key: CLAVE_GASTO, value: JSON.stringify(g), updated_at: ahora.replace("Z", "") }, { onConflict: "key" });
  return !error;
}
