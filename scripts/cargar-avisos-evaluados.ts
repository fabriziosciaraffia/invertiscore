// ─────────────────────────────────────────────────────────────────────────────
// Carga de avisos_evaluados (30-sep-2026). Evalúa una sola vez, con el mismo código del cron
// (evaluar-aviso.ts), todo aviso de venta visto en los últimos 7 días que no tenga evaluación o cuyo
// precio cambió. Después el cron semanal solo sigue lo nuevo y lo que cambió de precio.
//
// Se vuelve a correr cuando cambia el motor (METHODOLOGY_VERSION_ACTUAL): el cron ya no reevalúa por
// versión. Con MOTOR=1 toma también las filas de otra versión del motor. Con REEVALUAR_ANTES=<fecha ISO>
// (y opcional CONDICION=nuevo|usado) vuelve a evaluar las filas evaluadas antes de esa fecha: así se
// rehicieron el 30-sep las obras nuevas que el cron evaluó con la venta por radio en UF (aPesos).
//
// Sin saturar la base: concurrencia acotada (CONC, 6 por defecto) y una pausa corta entre avisos. El
// punto de control es la tabla: si se corta, se vuelve a lanzar y sigue donde quedó.
//
//   node --env-file=.env.local --import tsx scripts/cargar-avisos-evaluados.ts
//   CONC=4 TOPE=500 …   (TOPE: cuántos como máximo en esta corrida)
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { evaluarAviso } from "../src/lib/avisos/evaluar-aviso";
import { avisosEvaluables, avisosPendientes, VENTANA_VISTOS_DIAS, type EvaluacionGuardada, type FilaAviso } from "../src/lib/avisos/depurar";
import { METHODOLOGY_VERSION_ACTUAL } from "../src/lib/modelo-costos";

const CONC = Number(process.env.CONC ?? 6);
const TOPE = Number(process.env.TOPE ?? Infinity);
const PAUSA_MS = 100;
const MOTOR = process.env.MOTOR === "1";
const REEVALUAR_ANTES = process.env.REEVALUAR_ANTES ? new Date(process.env.REEVALUAR_ANTES).getTime() : null;
const CONDICION = process.env.CONDICION ?? null;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function paginar<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await consulta(off, off + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function main() {
  const t0 = Date.now();
  const { data: cfgRows } = await sb.from("config").select("key, value").in("key", ["uf_value", "tasa_hipotecaria"]);
  const m = new Map((cfgRows ?? []).map((r: { key: string; value: unknown }) => [r.key, Number(r.value)]));
  const cfg = { uf: m.get("uf_value")!, tasa: m.get("tasa_hipotecaria")! };
  if (!(cfg.uf > 0) || !(cfg.tasa > 0)) throw new Error("config sin uf_value o tasa_hipotecaria");

  const desde = new Date(Date.now() - VENTANA_VISTOS_DIAS * 864e5).toISOString();
  const filas = await paginar<FilaAviso>((a, b) =>
    sb.from("scraped_properties")
      .select("id, comuna, lat, lng, precio, moneda, superficie_m2, dormitorios, banos, condicion, direccion, fecha_entrega, scraped_at")
      .eq("type", "venta").eq("is_active", true).gte("scraped_at", desde)
      .order("id", { ascending: true }).range(a, b),
  );
  const guardadas = await paginar<EvaluacionGuardada & { condicion: string }>((a, b) =>
    sb.from("avisos_evaluados").select("aviso_id, precio_uf, evaluado_at, motor_version, condicion").order("aviso_id", { ascending: true }).range(a, b),
  );
  const evaluables = avisosEvaluables(filas, cfg.uf);
  const vigentes = guardadas.filter((g) => {
    if (MOTOR && g.motor_version !== METHODOLOGY_VERSION_ACTUAL) return false;
    if (REEVALUAR_ANTES !== null && new Date(g.evaluado_at).getTime() < REEVALUAR_ANTES && (!CONDICION || g.condicion === CONDICION)) return false;
    return true;
  });
  const cola = avisosPendientes(evaluables, vigentes).slice(0, TOPE);
  console.log(`vistos en ${VENTANA_VISTOS_DIAS} días ${filas.length} · evaluables ${evaluables.length} · ya evaluados ${guardadas.length} · pendientes ${cola.length} · concurrencia ${CONC}`);

  let i = 0, ok = 0, fallidos = 0, sinArriendo = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (i < cola.length) {
      const a = cola[i++];
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { sug, ...fila } = await evaluarAviso(sb, a, cfg, { segmentar: false });
        if (!fila.arriendo) sinArriendo++;
        const { error } = await sb.from("avisos_evaluados").upsert(fila, { onConflict: "aviso_id" });
        if (error) { fallidos++; if (fallidos <= 5) console.error("upsert", a.id, error.message); } else ok++;
      } catch (e) {
        fallidos++;
        if (fallidos <= 5) console.error("evaluar", a.id, String(e).slice(0, 160));
      }
      const hechos = ok + fallidos;
      if (hechos % 500 === 0) {
        const s = (Date.now() - t0) / 1000;
        console.log(`  ${hechos}/${cola.length} · ${(hechos / s).toFixed(2)}/s · faltan ~${Math.round((cola.length - hechos) / (hechos / s) / 60)} min · fallidos ${fallidos}`);
      }
      await new Promise((r) => setTimeout(r, PAUSA_MS));
    }
  }));
  console.log(`listo · escritos ${ok} · fallidos ${fallidos} · sin arriendo ${sinArriendo} · ${Math.round((Date.now() - t0) / 60000)} min`);
  if (fallidos) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(1); });
