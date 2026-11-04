// ─────────────────────────────────────────────────────────────────────────────
// LA BASE PRIMERO (04-nov-2026, goal de Fabrizio después de la caída del 04-nov, 13:44 a 14:04 UTC): producción estuvo 20 minutos
// sin base mientras el QA recalculaba las 25 comunas con una tasa nueva. Desde entonces un recálculo de comuna (lo que Explorar
// calcula en el momento con otra tasa, otro pie u otro plazo) pasa por dos resguardos que valen para TODO el sitio:
//   · EL TOPE: nunca más de dos recálculos de comuna a la vez, vengan de quien vengan. Dos turnos, dos filas de `config`
//     (`explorar_turno_1` y `_2`), tomados con una escritura condicionada —se cambia el valor solo si sigue siendo el que se leyó—,
//     así dos funciones no toman el mismo. Un turno dura TURNO_MS si nadie lo suelta (una función cortada lo deja libre solo). El
//     tercero recibe «ocupado» y el navegador espera y reintenta (cola-recalculo.ts), con el pop-up diciéndolo.
//   · EL FUSIBLE: si la base respondió lento (más de 2 s) o con error (5xx, corte, sin respuesta) en los últimos 30 segundos,
//     los recálculos nuevos se pausan («pausado») y el pop-up ofrece ver el mapa con la tasa del mes. Lo abre cualquier lectura o
//     escritura de un recálculo, y la lectura de los turnos misma; queda en la memoria de la instancia y en `explorar_fusible`
//     para las demás.
// La landing, el login y los correos no pasan por acá: no esperan turno ni se pausan. Su prioridad es que lo pesado no pueda
// ocupar la base: dos recálculos como mucho, y ninguno mientras la base está lenta.
// Sin migración: las filas viven en `config`, que todos leen por clave.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";

/** Recálculos de comuna a la vez, en todo el sitio. */
export const TOPE_RECALCULOS = 2;
/** Las filas de los turnos (una por turno: tantas como el tope). */
export const CLAVES_TURNO: readonly string[] = Array.from({ length: TOPE_RECALCULOS }, (_, i) => `explorar_turno_${i + 1}`);
export const CLAVE_FUSIBLE = "explorar_fusible";
/** Un turno que nadie soltó se libera solo: más que los 60 s que puede durar una ruta de Explorar (maxDuration). */
export const TURNO_MS = 75_000;
/** Una respuesta de la base que tarda más que esto abre el fusible. */
export const LENTO_MS = 2_000;
/** Cuánto queda abierto el fusible desde la última respuesta mala. */
export const FUSIBLE_MS = 30_000;

export type EsperaRecalculo = "ocupado" | "pausado";

/** Lo que la ruta convierte en un 503 con `{ error: "ocupado" | "pausado" }`. */
export class RecalculoEnEspera extends Error {
  readonly motivo: EsperaRecalculo;
  constructor(motivo: EsperaRecalculo) {
    super(`recalculo-${motivo}`);
    this.name = "RecalculoEnEspera";
    this.motivo = motivo;
  }
}
export const esRecalculoEnEspera = (e: unknown): e is RecalculoEnEspera => e instanceof RecalculoEnEspera || (e as { name?: unknown } | null)?.name === "RecalculoEnEspera";

/** Dónde viven los turnos y el fusible (en producción, `config`; en las pruebas, un objeto). */
export interface AlmacenTurnos {
  /** Las filas pedidas que existen, clave → valor. Lanza si la base falla. */
  leer(claves: readonly string[]): Promise<Record<string, string | null>>;
  /** Escribe `a` solo si la fila sigue valiendo `de`. true si la cambió. */
  cambiar(clave: string, de: string, a: string): Promise<boolean>;
  /** Crea la fila si no existe (si existe, no la toca). */
  crear(clave: string, valor: string): Promise<void>;
  /** Escribe la fila, exista o no. */
  escribir(clave: string, valor: string): Promise<void>;
}

/** Un turno tomado: su fila y el valor exacto que se escribió (para soltarlo sin pisar a otro). */
export interface Turno { clave: string; valor: string }

/** El fusible que ve esta instancia (hasta cuándo, en ms). Las demás lo ven por `explorar_fusible`. */
export interface EstadoFusible { hasta: number }
export const fusibleDeLaInstancia: EstadoFusible = { hasta: 0 };

type Valor = { q: string | null; h: number };
export const TURNO_LIBRE = JSON.stringify({ q: null, h: 0 });
function valorDe(v: string | null | undefined): Valor {
  try {
    const x = JSON.parse(v ?? "") as { q?: unknown; h?: unknown } | null;
    if (x && typeof x.h === "number" && Number.isFinite(x.h)) return { q: typeof x.q === "string" ? x.q : null, h: x.h };
  } catch { /* una fila ilegible cuenta como libre */ }
  return { q: null, h: 0 };
}

/** Una respuesta de la base que abre el fusible: más de 2 s o con error. */
export const esRespuestaMala = (ms: number, error: unknown): boolean => ms > LENTO_MS || error != null;

/** Una promesa con tope: si no llega en `ms`, falla (y la base cuenta como lenta). */
export function conTope<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((ok, mal) => {
    const t = setTimeout(() => mal(new Error(`sin respuesta en ${ms} ms`)), ms);
    Promise.resolve(p).then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); mal(e); });
  });
}

export class TurnosRecalculo {
  constructor(
    private readonly almacen: AlmacenTurnos,
    private readonly fusible: EstadoFusible = fusibleDeLaInstancia,
    private readonly reloj: () => number = Date.now,
    private readonly azar: () => string = () => Math.random().toString(36).slice(2, 10),
  ) {}

  /** ¿Pausados? (lo que vio esta instancia) */
  abierto(): boolean { return this.fusible.hasta > this.reloj(); }

  /** Abre el fusible por 30 s: en esta instancia y, de paso, para las demás (si la base no contesta, queda en esta). */
  async abrir(motivo: "lento" | "error"): Promise<void> {
    const hasta = this.reloj() + FUSIBLE_MS;
    this.fusible.hasta = Math.max(this.fusible.hasta, hasta);
    try { await conTope(this.almacen.escribir(CLAVE_FUSIBLE, JSON.stringify({ q: motivo, h: hasta })), LENTO_MS); } catch { /* queda en la instancia */ }
  }

  /** Cada lectura o escritura de un recálculo pasa por acá: si fue mala, se abre el fusible. */
  notar(ms: number, error: unknown): void {
    if (esRespuestaMala(ms, error)) void this.abrir(error != null ? "error" : "lento");
  }

  /** Un turno, o por qué no: «ocupado» (los dos están tomados) o «pausado» (el fusible está abierto o la base no contestó bien). */
  async pedir(quien: string): Promise<Turno | EsperaRecalculo> {
    if (this.abierto()) return "pausado";
    const t0 = this.reloj();
    let filas: Record<string, string | null>;
    try {
      filas = await conTope(this.almacen.leer([...CLAVES_TURNO, CLAVE_FUSIBLE]), LENTO_MS + 500);
    } catch {
      await this.abrir("error");
      return "pausado";
    }
    if (this.reloj() - t0 > LENTO_MS) { await this.abrir("lento"); return "pausado"; }
    const fus = valorDe(filas[CLAVE_FUSIBLE]);
    if (fus.h > this.reloj()) { this.fusible.hasta = Math.max(this.fusible.hasta, fus.h); return "pausado"; }
    for (const clave of CLAVES_TURNO) {
      let actual = filas[clave];
      if (actual == null) {
        try { await conTope(this.almacen.crear(clave, TURNO_LIBRE), LENTO_MS); } catch { await this.abrir("error"); return "pausado"; }
        actual = TURNO_LIBRE;
      } else if (valorDe(actual).h > this.reloj()) continue;
      const valor = JSON.stringify({ q: `${quien}:${this.azar()}`, h: this.reloj() + TURNO_MS });
      try {
        if (await conTope(this.almacen.cambiar(clave, actual, valor), LENTO_MS + 500)) return { clave, valor };
      } catch {
        await this.abrir("error");
        return "pausado";
      }
    }
    return "ocupado";
  }

  /** Suelta el turno (solo si sigue siendo suyo: uno vencido que tomó otro no se toca). */
  async soltar(t: Turno): Promise<void> {
    try { await conTope(this.almacen.cambiar(t.clave, t.valor, TURNO_LIBRE), LENTO_MS + 500); } catch { /* vence solo en TURNO_MS */ }
  }
}

/** Los turnos y el fusible en `config` (clave → valor de texto). */
export function almacenDeConfig(admin: SupabaseClient): AlmacenTurnos {
  const senal = () => AbortSignal.timeout(LENTO_MS + 500);
  const ahora = () => new Date().toISOString().replace("Z", "");
  return {
    async leer(claves) {
      const { data, error } = await admin.from("config").select("key, value").in("key", [...claves]).abortSignal(senal());
      if (error) throw new Error(`turnos: ${error.message}`);
      return Object.fromEntries(((data ?? []) as Array<{ key: string; value: string | null }>).map((r) => [r.key, r.value]));
    },
    async cambiar(clave, de, a) {
      const { data, error } = await admin.from("config").update({ value: a, updated_at: ahora() }).eq("key", clave).eq("value", de).select("key").abortSignal(senal());
      if (error) throw new Error(`turnos: ${error.message}`);
      return (data?.length ?? 0) === 1;
    },
    async crear(clave, valor) {
      const { error } = await admin.from("config").upsert({ key: clave, value: valor, updated_at: ahora() }, { onConflict: "key", ignoreDuplicates: true }).abortSignal(senal());
      if (error) throw new Error(`turnos: ${error.message}`);
    },
    async escribir(clave, valor) {
      const { error } = await admin.from("config").upsert({ key: clave, value: valor, updated_at: ahora() }, { onConflict: "key" }).abortSignal(senal());
      if (error) throw new Error(`turnos: ${error.message}`);
    },
  };
}
