// ─────────────────────────────────────────────────────────────────────────────
// PUNTO 2 DEL STOP 2 · EL UNIVERSO COMPLETO DE NUEVOS. Las unidades activas que NO están en avisos_evaluados (5.362
// reactivadas por el cruce y las viejas nunca cruzadas) pasan por la MISMA función de la pasada nocturna, `evaluarAviso`
// (sugerencias de arriendo y venta por radio, mediana comunal y cap en vivo, runAnalysis), con la base de referencia:
// m² legible con dos decimales (DEC.superficie = 2 durante toda la corrida, en memoria), premio 3 % parejo (el de la
// función), UF y tasa de hoy. Solo lectura: evaluarAviso no escribe; acá tampoco. Concurrencia acotada y pausa, como la
// carga inicial. Reanudable: el JSON de salida es el punto de control.
//   TOPE=60 … para medir el tiempo; CONC=3 por defecto.
// Salida: out/6-universo-completo.json (por fila: la evaluación entera, para que la FASE 4 la reutilice).
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { paginar, leerConfig, fmt, pct, tablaMd, evaluarConMotor, type FilaUniverso } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { evaluarAviso, type FilaEvaluacion } from "../../../src/lib/avisos/evaluar-aviso";
import { avisosEvaluables, type FilaAviso } from "../../../src/lib/avisos/depurar";
import { evalGate1Brazos } from "../../../src/lib/analysis";
import { DEC } from "../../../src/components/formulario-v4/wizardV4Nodes";

const TOPE = Number(process.env.TOPE ?? Infinity);
const CONC = Number(process.env.CONC ?? 3);
const PAUSA_MS = 150;
const SALIDA = "scripts/analisis/motor-nuevos/out/6-universo-completo.json";
const LOG = "scripts/analisis/motor-nuevos/out/6-universo-completo.log";
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };
const log = (s: string) => { console.log(s); appendFileSync(LOG, s + "\n"); };

export interface FilaCompleta {
  id: string; comuna: string; grupo: "reactivada" | "vieja sin cruce"; entrega: "inmediata" | "futura" | "sin dato"; dorms: number; m2: number; precioUF: number;
  evaluacion: Omit<FilaEvaluacion, "mediana_comuna"> & { mediana_comuna: unknown };
  sp: FilaUniverso["sp"];
  gate1: { cocSevero: boolean; breakEvenImposible: boolean; sobreprecioComunalConFlujo: boolean; flujoSevero: boolean };
  control: boolean;
}

async function main() {
  (DEC as unknown as { superficie: number }).superficie = 2;
  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  const sb = createServiceClient();
  const cfg = await leerConfig(sb);
  const previas: FilaCompleta[] = existsSync(SALIDA) ? (JSON.parse(readFileSync(SALIDA, "utf8")) as { filas: FilaCompleta[] }).filas : [];
  const hechas = new Set(previas.map((f) => f.id));
  log(`config: UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} % · ya hechas ${fmt(hechas.size)}`);

  type Cruda = FilaAviso & { url: string | null; titulo: string | null; source_id: string | null; gastos_comunes: number | null; antiguedad: string | null; created_at: string | null; precio_estimado_uf: number | string | null };
  const activos = await paginar<Cruda>((a, b) => sb.from("scraped_properties")
    .select("id, comuna, lat, lng, precio, moneda, superficie_m2, dormitorios, banos, condicion, direccion, fecha_entrega, scraped_at, seen_pass_id, url, titulo, source_id, gastos_comunes, antiguedad, created_at, precio_estimado_uf")
    .eq("type", "venta").eq("is_active", true).eq("condicion", "nuevo").order("id").range(a, b));
  const evaluadas = new Set((await paginar<{ aviso_id: string }>((a, b) => sb.from("avisos_evaluados").select("aviso_id").eq("condicion", "nuevo").order("aviso_id").range(a, b))).map((r) => r.aviso_id));
  const candidatas = activos.filter((r) => !evaluadas.has(r.id));
  const evaluables = avisosEvaluables(candidatas, cfg.uf);
  const porId = new Map(candidatas.map((r) => [r.id, r]));
  log(`nuevos activos ${fmt(activos.length)} · sin evaluación ${fmt(candidatas.length)} · evaluables (completos, plausibles, sin duplicado ni «fuera») ${fmt(evaluables.length)}`);
  const cola = evaluables.filter((a) => !hechas.has(a.id)).slice(0, TOPE);
  log(`a evaluar ahora: ${fmt(cola.length)} con concurrencia ${CONC}`);

  const filas: FilaCompleta[] = [...previas];
  const t0 = Date.now();
  let i = 0, fallas = 0;
  const guardar = () => writeFileSync(SALIDA, JSON.stringify({ cfg, calculadoAt: new Date().toISOString(), filas }));
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (i < cola.length) {
      const a = cola[i++];
      const cruda = porId.get(a.id)!;
      try {
        const { sug, ...ev } = await evaluarAviso(sb, a, cfg, { segmentar: false });
        void sug;
        const grupo: FilaCompleta["grupo"] = cruda.seen_pass_id?.startsWith("unidades@") ? "reactivada" : "vieja sin cruce";
        const sp: FilaUniverso["sp"] = { id: cruda.id, comuna: cruda.comuna, lat: cruda.lat, lng: cruda.lng, precio: cruda.precio, moneda: cruda.moneda, superficie_m2: cruda.superficie_m2, dormitorios: cruda.dormitorios, banos: cruda.banos, condicion: cruda.condicion, direccion: cruda.direccion, fecha_entrega: cruda.fecha_entrega ?? null, titulo: cruda.titulo, url: cruda.url, source_id: cruda.source_id, gastos_comunes: cruda.gastos_comunes, antiguedad: cruda.antiguedad, scraped_at: cruda.scraped_at, created_at: cruda.created_at, precio_estimado_uf: cruda.precio_estimado_uf };
        // El mismo resultado por la cadena de la fila (contextoDeFila), para tener los brazos del GATE 1 y verificar que calza.
        const fu: FilaUniverso = { ...(ev as unknown as FilaUniverso), aviso_id: a.id, precio_uf: ev.precio_uf, sp };
        const r = evaluarConMotor(fu, cfg, 20, { asOf: new Date(ev.evaluado_at) });
        const gate1 = r ? evalGate1Brazos(r.resultado.metrics, r.resultado.breakEvenTasa) : { cocSevero: false, breakEvenImposible: false, sobreprecioComunalConFlujo: false, flujoSevero: false };
        const entrega = !ev.entrega ? "sin dato" : ev.entrega.inmediata ? "inmediata" : ev.entrega.anio != null ? "futura" : "sin dato";
        filas.push({ id: a.id, comuna: a.comuna, grupo, entrega, dorms: a.dormitorios, m2: a.m2, precioUF: a.precioUF, evaluacion: ev as FilaCompleta["evaluacion"], sp, gate1, control: !!r && r.veredicto === ev.veredicto_20 && r.score === ev.score_20 && r.flujo === ev.flujo_20 });
      } catch (e) {
        fallas++;
        log(`falló ${a.id}: ${String(e).slice(0, 140)}`);
      }
      const hechasAhora = filas.length - previas.length;
      if (hechasAhora % 100 === 0 && hechasAhora > 0) {
        const seg = (Date.now() - t0) / 1000;
        log(`${fmt(hechasAhora)} / ${fmt(cola.length)} · ${(seg / hechasAhora).toFixed(2)} s/aviso · faltan ~${((cola.length - hechasAhora) * seg / hechasAhora / 60).toFixed(0)} min · fallas ${fallas}`);
        guardar();
      }
      await new Promise((res) => setTimeout(res, PAUSA_MS));
    }
  }));
  guardar();
  const seg = (Date.now() - t0) / 1000;
  log(`listo: ${fmt(filas.length - previas.length)} evaluadas en ${(seg / 60).toFixed(1)} min (${(seg / Math.max(1, cola.length)).toFixed(2)} s/aviso), fallas ${fallas}, control calza ${filas.filter((f) => f.control).length} de ${filas.length}`);

  // Resumen rápido.
  const conV = filas.filter((f) => f.evaluacion.veredicto_20 != null && !f.evaluacion.arriendo_sospechoso && !f.evaluacion.radio_degradado);
  const n = (v: string) => conV.filter((f) => f.evaluacion.veredicto_20 === v).length;
  console.log(tablaMd(["grupo", "evaluadas", "limpias", "Comprar", "Ajustar", "Buscar otra", "break-even imposible", "flujo severo"], (["reactivada", "vieja sin cruce"] as const).map((g) => {
    const xs = conV.filter((f) => f.grupo === g);
    return [g, filas.filter((f) => f.grupo === g).length, xs.length, `${xs.filter((f) => f.evaluacion.veredicto_20 === "COMPRAR").length} (${pct(xs.filter((f) => f.evaluacion.veredicto_20 === "COMPRAR").length, xs.length)})`, xs.filter((f) => f.evaluacion.veredicto_20 === "AJUSTA SUPUESTOS").length, xs.filter((f) => f.evaluacion.veredicto_20 === "BUSCAR OTRA").length, xs.filter((f) => f.gate1.breakEvenImposible).length, xs.filter((f) => f.gate1.flujoSevero).length];
  }).concat([["total", filas.length, conV.length, `${n("COMPRAR")} (${pct(n("COMPRAR"), conV.length)})`, n("AJUSTA SUPUESTOS"), n("BUSCAR OTRA"), conV.filter((f) => f.gate1.breakEvenImposible).length, conV.filter((f) => f.gate1.flujoSevero).length]])));
}

main().catch((e) => { console.error(e); process.exit(1); });
