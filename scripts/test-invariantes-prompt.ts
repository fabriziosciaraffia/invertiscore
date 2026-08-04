/**
 * INVARIANTES DE LAS VARIABLES QUE ENTRAN AL PROMPT LTR.
 *
 * POR QUÉ EXISTE. El fix 2183141 dejó 8 invariantes verificando que el CHART y el
 * DRAWER cuenten igual la plata aportada — las dos del lado del motor. Pero el
 * prompt no es ninguno de los dos: computa sus propias variables a partir de
 * `projections`, y ahí vivía `flujoNegAcum10` = |projections[9].flujoAcumulado|,
 * que difería de `exitScenario.totalAportado` en dos ejes (excluía la inversión
 * inicial y neteaba los años buenos contra los malos). Divergía en el 100% de los
 * 587 análisis del parque y ninguna invariante lo cazó, porque ninguna miraba
 * hacia el prompt.
 *
 * Estas invariantes cierran ese hueco: verifican la ARITMÉTICA de las cifras que
 * el prompt narra, contra la fuente única del motor. Son puras (recomputan desde
 * input), así que corren sin red ni API.
 *
 *   node --env-file=.env.local --import tsx scripts/test-invariantes-prompt.ts
 *   (con --corpus barre la base; sin flag corre los casos sintéticos)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { runAnalysis } from "../src/lib/analysis";
import { calcInversionInicialCLP } from "../src/lib/inversion-inicial";
import type { AnalisisInput } from "../src/lib/types";

let pass = 0, fail = 0;
const fallidos: string[] = [];
function test(nombre: string, fn: () => void) {
  try { fn(); pass++; console.log(`  OK   ${nombre}`); }
  catch (err) {
    fail++; fallidos.push(nombre);
    console.log(`  FAIL ${nombre}`);
    console.log(`       ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
}

/**
 * Réplica EXACTA del cómputo del prompt (ai-generation.ts, bloque "APORTE").
 * Si el prompt cambia su fórmula, esta réplica deja de calzar y P1/P2 fallan —
 * que es justamente lo que queremos que pase.
 */
export function aportesDelPrompt(full: any, input: AnalisisInput) {
  const m = full.metrics;
  const exit = full.exitScenario;
  const projections = full.projections as Array<{ flujoAcumulado: number; flujoAnual: number }> | undefined;
  const gastosCierre = Math.round(m.precioCLP * 0.02);
  const inversionTotal = calcInversionInicialCLP({
    pieCLP: m.pieCLP,
    gastosCierreCLP: gastosCierre,
    capexPuestaAPuntoCLP: m.capexPuestaAPuntoCLP ?? 0,
    corretajeInicialCLP: m.corretajeInicialCLP ?? 0,
  });
  const suma = (hasta: number) => projections
    ? Math.round(projections.slice(0, hasta).filter((p) => p.flujoAnual < 0).reduce((s, p) => s + Math.abs(p.flujoAnual), 0))
    : m.flujoNetoMensual < 0 ? Math.round(Math.abs(m.flujoNetoMensual) * 12 * hasta) : 0;
  const aporteMensual10 = suma(10);
  const aporteTotal10 = typeof exit.totalAportado === "number" && exit.totalAportado > 0
    ? exit.totalAportado
    : inversionTotal + aporteMensual10;
  return { inversionTotal, aporteMensual10, aporteMensual5: suma(5), aporteTotal10, exit, m };
}

/** Las invariantes. Devuelve la lista de violaciones (vacía = sano). */
export function violacionesPrompt(full: any, input: AnalisisInput): string[] {
  const v: string[] = [];
  const a = aportesDelPrompt(full, input);
  const tol = 2; // redondeos

  // P1 · el TOTAL que narra el prompt == exitScenario.totalAportado (fuente única
  //      de card, chart, PDF y multiplicador). Es LA invariante que faltaba.
  if (Math.abs(a.aporteTotal10 - a.exit.totalAportado) > tol)
    v.push(`P1 total del prompt (${a.aporteTotal10}) != exit.totalAportado (${a.exit.totalAportado})`);

  // P2 · el desglose que el prompt narra SUMA el total. Si no, el usuario lee dos
  //      cifras que no cierran entre sí en la misma frase.
  if (Math.abs((a.inversionTotal + a.aporteMensual10) - a.aporteTotal10) > tol)
    v.push(`P2 inicial (${a.inversionTotal}) + mensual (${a.aporteMensual10}) != total (${a.aporteTotal10})`);

  // P3 · la parte mensual del prompt == la del motor (Σ|flujoAnual<0|, SIN netear).
  //      Cierra la regla que 2183141 declaró ganadora, ahora también en el prompt.
  if (Math.abs(a.aporteMensual10 - a.exit.flujoMensualAcumuladoNegativo) > tol)
    v.push(`P3 mensual del prompt (${a.aporteMensual10}) != exit.flujoMensualAcumuladoNegativo (${a.exit.flujoMensualAcumuladoNegativo})`);

  // P4 · la inversión inicial del prompt == la del exit. El prompt la recomputa
  //      con calcInversionInicialCLP en vez de leerla; si las dos derivan, el
  //      desglose miente aunque el total cuadre.
  if (Math.abs(a.inversionTotal - a.exit.inversionInicial) > tol)
    v.push(`P4 inversionInicial del prompt (${a.inversionTotal}) != exit.inversionInicial (${a.exit.inversionInicial})`);

  // P5 · el aporte a 5 años nunca supera al de 10 (misma serie, prefijo).
  if (a.aporteMensual5 > a.aporteMensual10 + tol)
    v.push(`P5 aporte 5a (${a.aporteMensual5}) > aporte 10a (${a.aporteMensual10})`);

  // P6 · con flujo mensual positivo en TODOS los años, la parte mensual es 0 pero
  //      el TOTAL nunca lo es (siempre está el desembolso del día 1). Es el caso
  //      que producía "pusiste $0 de tu bolsillo" — 88 análisis del parque.
  if (a.aporteMensual10 === 0 && a.aporteTotal10 <= 0 && a.exit.inversionInicial > 0)
    v.push(`P6 sin aportes mensuales el total quedó en 0 pese a inversión inicial ${a.exit.inversionInicial}`);

  return v;
}

// ── Casos sintéticos ────────────────────────────────────────────────────────
const base = {
  nombre: "T", comuna: "Santiago", ciudad: "Santiago", tipo: "Departamento",
  banos: 1, superficieTotal: 50, enConstruccion: false, piso: 0,
  estacionamiento: "no", precioEstacionamiento: 0, bodega: false,
  estadoVenta: "inmediata" as const, cuotasPie: 0, montoCuota: 0,
  plazoCredito: 25, tasaInteres: 4.5, provisionMantencion: 30000,
  tipoRenta: "larga" as const, arriendoEstacionamiento: 0, arriendoBodega: 0,
  vacanciaMeses: 0.6, dormitorios: 2, superficie: 50, antiguedad: 5,
} as unknown as AnalisisInput;

const UF = 40845;
const casos: Array<{ n: string; input: AnalisisInput }> = [
  { n: "flujo NEGATIVO (el caso típico)", input: { ...base, precio: 5000, arriendo: 500000, gastos: 90000, contribuciones: 100000, piePct: 20 } as AnalisisInput },
  { n: "flujo POSITIVO (el que decía '$0 de tu bolsillo')", input: { ...base, precio: 2500, arriendo: 900000, gastos: 50000, contribuciones: 40000, piePct: 40 } as AnalisisInput },
  { n: "pie 0 (financiamiento 100%)", input: { ...base, precio: 4000, arriendo: 600000, gastos: 80000, contribuciones: 90000, piePct: 0 } as AnalisisInput },
  { n: "usado con CapEx (inversión inicial gruesa)", input: { ...base, precio: 4500, arriendo: 550000, gastos: 85000, contribuciones: 95000, piePct: 20, antiguedad: 25, incluyeCorretajeInicial: true } as AnalisisInput },
  { n: "flujo MIXTO (años buenos y malos — el caso del neteo)", input: { ...base, precio: 3800, arriendo: 700000, gastos: 70000, contribuciones: 80000, piePct: 30 } as AnalisisInput },
];

async function main() {
  if (process.argv.includes("--corpus")) return correrCorpus();
  console.log("INVARIANTES DEL PROMPT · casos sintéticos\n");
  for (const c of casos) {
    const full = runAnalysis(c.input, UF, undefined, new Date("2026-08-04"));
    const a = aportesDelPrompt(full, c.input);
    console.log(`${c.n}`);
    console.log(`   flujo ${Math.round(a.m.flujoNetoMensual).toLocaleString("es-CL")}/mes · total ${Math.round(a.aporteTotal10).toLocaleString("es-CL")} = inicial ${Math.round(a.inversionTotal).toLocaleString("es-CL")} + mensual ${Math.round(a.aporteMensual10).toLocaleString("es-CL")}`);
    test(`   ${c.n}`, () => {
      const v = violacionesPrompt(full, c.input);
      assert.deepEqual(v, [], v.join(" | "));
    });
  }
  console.log(`\n${pass} OK · ${fail} FAIL`);
  if (fail) { console.log(`fallidos: ${fallidos.join(", ")}`); process.exit(1); }
}

async function correrCorpus() {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.from("analisis").select("id,nombre,created_at,input_data,results,tipo_analisis").limit(5000);
  let ok = 0, malos = 0, saltados = 0;
  const porRegla: Record<string, number> = {};
  for (const r of ((data ?? []) as any[])) {
    if (!(r.tipo_analisis === "long-term" || r.tipo_analisis == null)) continue;
    if (String(r.nombre ?? "").startsWith("GOLDEN::")) continue;
    const input = r.input_data as AnalisisInput | null;
    const res = r.results as any;
    if (!input?.precio || !input.superficie || !res?.metrics?.precioCLP) { saltados++; continue; }
    const uf = res.metrics.precioCLP / input.precio;
    const full = runAnalysis(input, uf, undefined, new Date(String(r.created_at)));
    const v = violacionesPrompt(full, input);
    if (v.length) { malos++; v.forEach((x) => { const k = x.slice(0, 2); porRegla[k] = (porRegla[k] ?? 0) + 1; }); if (malos <= 5) console.log(`  ${r.id.slice(0, 8)}: ${v.join(" | ")}`); }
    else ok++;
  }
  console.log(`\nCORPUS · sanos ${ok} · con violación ${malos} · saltados ${saltados}`);
  console.log(`  por regla: ${JSON.stringify(porRegla)}`);
  if (malos) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
