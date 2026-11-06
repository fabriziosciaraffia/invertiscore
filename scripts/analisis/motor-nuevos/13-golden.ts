// ─────────────────────────────────────────────────────────────────────────────
// FASE 4.5 · SANIDAD CON EL GOLDEN SET, sin correr gates de código: tres análisis reales de renta larga con su
// `input_data` y su mediana guardada, por `runAnalysis` (la misma cadena del informe), con la UF del día en que se crearon y
// las mismas versiones y la regla de la celda central que el resto de la fase (corridaDe de 11-fase4.ts).
//   7710a017 (Ajustar, Providencia) · 17b4e10d (Comprar, Ñuñoa, nuevo) · f3522eac (Buscar otra, Santiago, usado de 15 años:
//   reemplaza a 5dc42a82, que es de renta corta; decisión de Fabrizio al OK del STOP 4a).
// Solo lectura. Salida: out/13-golden.json
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync } from "node:fs";
import { fmt, tablaMd } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { ufDelDia } from "./uf-historica";
import { corridaDe, type Corrida } from "./11-fase4";
import { runAnalysis } from "../../../src/lib/analysis";
import { readVeredicto } from "../../../src/lib/results-helpers";
import { medianaDesdeSnapshot } from "../../../src/lib/analysis/mediana-snapshot";
import { getComunaMedianaVentaUF } from "../../../src/lib/comuna-stats";
import type { AnalisisInput } from "../../../src/lib/types";

const IDS = ["7710a017-8066-47a6-8b3e-8fc64143e256", "17b4e10d-2afd-4554-b914-fe731ee2c9a0", "f3522eac-dd28-4a83-bee1-1cd2d35a2e43"];
const CENTRAL = { tir: 5, tol: -200000 };
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };

const gate1Grilla = (c: Corrida) => c.gate1.cocSevero || c.gate1.sobreprecioComunalConFlujo;
const regla = (c: Corrida, tir: number | null) => (gate1Grilla(c) ? "BUSCAR OTRA" : c.flujo != null && c.flujo >= CENTRAL.tol && tir != null && tir >= CENTRAL.tir ? "COMPRAR" : "AJUSTA SUPUESTOS");

async function main() {
  const sb = createServiceClient();
  const filas: (string | number)[][] = [];
  const salida: Record<string, unknown> = {};
  for (const pref of IDS) {
    const { data, error } = await sb.from("analisis").select("id, comuna, created_at, input_data, results, mediana_comuna_snapshot, capref_comuna_snapshot").eq("id", pref).single();
    if (error || !data) { console.log(`${pref}: no se encontró (${error?.message})`); continue; }
    const input = data.input_data as AnalisisInput & { esNuevo?: boolean; superficie: number; dormitorios: number; precio: number; antiguedad?: number };
    const creado = new Date(data.created_at as string);
    const uf = Math.round(await ufDelDia(creado.toISOString().slice(0, 10)));
    const mediana = data.mediana_comuna_snapshot ? medianaDesdeSnapshot(data.mediana_comuna_snapshot as never, { capRefComuna: (data.capref_comuna_snapshot as never) ?? null }) : undefined;
    const r = runAnalysis(input, uf, mediana as never, creado);
    const guardado = data.results as { veredicto?: string; score?: number; exitScenario?: { tir?: unknown }; metrics?: { flujoNetoMensual?: number } };
    const res = { veredicto: readVeredicto(r as never) ?? null, score: Math.round(r.score), flujo: Math.round(r.metrics.flujoNetoMensual), resultado: r, body: input as unknown as Record<string, unknown> };
    // La celda de usados para la salida a valor usado: la mediana guardada si el análisis es de usado; si es nuevo, la de usados de hoy.
    const medUsado = input.esNuevo ? (await getComunaMedianaVentaUF(sb as never, data.comuna as string, input.superficie, input.dormitorios, uf, "usado").catch(() => null))?.mediana ?? null : ((mediana as { mediana?: number | null } | undefined)?.mediana ?? null);
    const c = corridaDe(res, { uf, tasa: Number(input.tasaMercado) || Number(input.tasaInteres) }, creado, medUsado, input.superficie);
    const tirG = (guardado.exitScenario?.tir as { valor?: number } | number | undefined);
    const tirGuardada = typeof tirG === "number" ? tirG : tirG?.valor ?? null;
    salida[pref.slice(0, 8)] = { comuna: data.comuna, creado: data.created_at, uf, guardado: { v: guardado.veredicto, s: guardado.score, tir: tirGuardada, flujo: guardado.metrics?.flujoNetoMensual }, corrida: c };
    filas.push([
      `${pref.slice(0, 8)} · ${data.comuna} · ${input.esNuevo ? "nuevo" : `usado ${input.antiguedad ?? "?"} años`} · pie ${input.piePct} % · ${input.plazoCredito} años · ${input.tasaInteres} %`,
      `${guardado.veredicto} ${guardado.score} · TIR ${fmt(tirGuardada, 2)} · flujo ${fmt(guardado.metrics?.flujoNetoMensual)}`,
      `${res.veredicto} ${res.score} · TIR ${fmt(c.motor.tir, 2)} · flujo ${fmt(res.flujo)}`,
      `${fmt(c.g1.tir, 1)} / ${fmt(c.g0.tir, 1)} / ${c.usado0 ? fmt(c.usado0.tir, 1) : "—"} / ${fmt(c.edad.tir, 1)}`,
      `${regla(c, c.g0.tir)} (g 0) · ${regla(c, c.g1.tir)} (g 1) · ${regla(c, c.motor.tir)} (motor) · ${c.usado0 ? regla(c, c.usado0.tir) : "—"} (usado g 0)`,
      `salida motor UF ${fmt(c.salidaMotorUF)} · valor usado UF ${c.salidaUsadoUF != null ? fmt(c.salidaUsadoUF) : "—"} · ganancia UF ${fmt(c.motor.gananciaUF)} · múltiplo ${fmt(c.motor.multiplo, 2)}`,
    ]);
  }
  console.log(tablaMd(["análisis", "guardado", "reproducido hoy (motor)", "TIR g 1 % / g 0 % / valor usado g 0 % / edad", "regla central", "salida y ganancia (motor)"], filas));
  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  writeFileSync("scripts/analisis/motor-nuevos/out/13-golden.json", JSON.stringify(salida, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
