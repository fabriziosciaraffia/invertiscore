// ============================================================================
// GOLDEN · AVISOS (30-sep-2026) — catch-test
// ============================================================================
//   Los avisos evaluados con el motor, FASE 1:
//   1 · EL SCRAPER GUARDA LA ENTREGA: el GraphQL de obra nueva pasa fechaEntrega a cada unidad y
//       propertyToRow la escribe en fecha_entrega; la migración crea la columna.
//   2 · LA ENTREGA SE LEE BIEN: «Inmediata», «Disponible», semestres, trimestres, meses; lo que ya pasó
//       es inmediato; lo vacío no inventa fecha.
//   3 · EL ARRIENDO DEL SEGMENTO: un bloque barato toma los arriendos baratos del radio; sin muestra, nada.
//   4 · LA EVALUACIÓN ES LA DEL WIZARD: buildLtrPayload desde un módulo sin "use client"; 25 años para el
//       usado sin año; pie 20% y 30%, 30 años, tasa de mercado; la entrega real de lo nuevo.
//   5 · QUÉ SE EVALÚA: completos, plausibles, sin duplicados, vistos en 3 días; primero los nunca
//       evaluados; se reevalúa por precio, por antigüedad (7 días) o por versión del motor.
//   6 · EL CRON: con CRON_SECRET, corta por presupuesto antes del maxDuration, escribe SOLO en
//       avisos_evaluados (dry no escribe), registrado en vercel.json y en el heartbeat; la tabla con RLS.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/avisos-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsearFechaEntrega } from "../../../src/lib/avisos/fecha-entrega";
import { arriendoSegmentado } from "../../../src/lib/avisos/arriendo-segmentado";
import { ANIOS_ANTIGUEDAD_SUPUESTA, ANTIGUEDAD_SUPUESTA, PERFILES_ESTANDAR, PLAZO_ESTANDAR, respuestasDeAviso, type AvisoParaEvaluar } from "../../../src/lib/avisos/evaluar-aviso";
import { avisosEvaluables, avisosPendientes, VENTANA_VISTOS_DIAS, REEVALUAR_DIAS } from "../../../src/lib/avisos/depurar";
import { propertyToRow } from "../../../src/lib/services/scraper/property-row";
import { antiguedadToNumber } from "../../../src/components/formulario-v4/helpers-wizard";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

export function runAvisosTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER AVISOS (avisos evaluados con el motor · 0 tokens) ───");

  // ── 1 · el scraper ──
  const uni = sinComentarios(leer("src/lib/services/scraper/toctoc-unidades.ts"));
  if (!/condicion: "nuevo",\s*fechaEntrega: \(p\.fechaEntrega \?\? ""\)\.trim\(\) \|\| undefined,/.test(uni)) F("1 · el GraphQL de obra nueva no pasa la fecha de entrega a cada unidad");
  const base = { source: "toctoc", sourceId: "x#1", type: "venta" as const, comuna: "Ñuñoa", precio: 3000, moneda: "UF" as const };
  if (propertyToRow({ ...base, fechaEntrega: "2° Semestre 2026" }).fecha_entrega !== "2° Semestre 2026" || propertyToRow(base).fecha_entrega !== null) F("1 · propertyToRow no escribe fecha_entrega (o inventa una)");
  const mig = leer("supabase/migrations/20260930_avisos_evaluados.sql");
  if (!/alter table public\.scraped_properties\s+add column if not exists fecha_entrega text null;/.test(mig)) F("1 · la migración no crea scraped_properties.fecha_entrega");

  // ── 2 · la entrega ──
  const hoy = new Date("2026-09-30T12:00:00Z");
  const e = (t: string | null) => JSON.stringify(parsearFechaEntrega(t, hoy));
  const casos: Array<[string | null, string]> = [
    ["Inmediata", '{"inmediata":true,"anio":null,"mes":null}'],
    ["Disponible", '{"inmediata":true,"anio":null,"mes":null}'],
    ["2° Semestre 2026", '{"inmediata":false,"anio":2026,"mes":12}'],
    ["2do Semestre 2027", '{"inmediata":false,"anio":2027,"mes":12}'],
    ["4to Trimestre 2028", '{"inmediata":false,"anio":2028,"mes":12}'],
    ["1° Trimestre 2027", '{"inmediata":false,"anio":2027,"mes":3}'],
    ["Marzo 2027", '{"inmediata":false,"anio":2027,"mes":3}'],
    ["1° Semestre  2025", '{"inmediata":true,"anio":2025,"mes":6}'],
    ["", "null"],
    [null, "null"],
    ["Pronto", "null"],
  ];
  for (const [t, esperado] of casos) if (e(t) !== esperado) F(`2 · «${t}» se lee ${e(t)}, no ${esperado}`);

  // ── 3 · el arriendo del segmento ──
  {
    const uf = 40000;
    const ventas = Array.from({ length: 20 }, (_, i) => ({ precio: (30 + i * 3) * 50 * uf, superficie_m2: 50 })); // UF 30..87 /m²
    const arriendos = Array.from({ length: 20 }, (_, i) => ({ precio: 300000 + i * 20000, superficie_m2: 50 }));
    const barato = arriendoSegmentado(arriendos, ventas, 31, uf);
    const caro = arriendoSegmentado(arriendos, ventas, 86, uf);
    if (!barato || !caro || !(barato.monto < 400000) || !(caro.monto > 600000) || barato.percentil > 0.1) F(`3 · el segmento no sigue al precio del aviso (barato ${barato?.monto}, caro ${caro?.monto})`);
    if (arriendoSegmentado(arriendos, ventas.slice(0, 9), 31, uf) !== null) F("3 · con menos de 10 ventas cerca igual segmenta");
    if (arriendoSegmentado(arriendos.slice(0, 5), ventas, 31, uf) !== null) F("3 · con menos de 6 arriendos igual segmenta");
  }

  // ── 4 · la evaluación ──
  const ev = sinComentarios(leer("src/lib/avisos/evaluar-aviso.ts"));
  if (!/import \{ buildLtrPayload, type SubmitContext \} from "@\/components\/formulario-v4\/wizardV4Payload";/.test(ev)) F("4 · la evaluación no arma el payload con el módulo puro del wizard");
  const payload = leer("src/components/formulario-v4/wizardV4Payload.ts");
  if (/^"use client"/m.test(payload) || /from "\.\/NumericInput"/.test(leer("src/components/formulario-v4/derive.ts"))) F("4 · el armado del payload vuelve a depender de un módulo \"use client\" (no se puede llamar desde el cron)");
  if (!/export \{ buildLtrPayload, datosDfl2, type SubmitContext \} from "\.\/wizardV4Payload";/.test(leer("src/components/formulario-v4/wizardV4Submit.ts"))) F("4 · el wizard ya no usa el mismo buildLtrPayload que el cron");
  if (ANTIGUEDAD_SUPUESTA !== "20+" || antiguedadToNumber(ANTIGUEDAD_SUPUESTA) !== ANIOS_ANTIGUEDAD_SUPUESTA || ANIOS_ANTIGUEDAD_SUPUESTA !== 25) F("4 · la antigüedad supuesta no es 25 años");
  if (JSON.stringify(PERFILES_ESTANDAR) !== "[20,30]" || PLAZO_ESTANDAR !== 30) F("4 · el perfil estándar no es pie 20% y 30%, 30 años");
  const aviso: AvisoParaEvaluar = { id: "a", comuna: "Ñuñoa", lat: -33.45, lng: -70.6, precioUF: 3000, m2: 50, dormitorios: 2, banos: 1, condicion: "usado", direccion: null, fechaEntrega: null, antiguedadAnios: null };
  const u = respuestasDeAviso(aviso, 20, 4.04, 500000);
  if (u.antiguedad !== "20+" || u.tipoPropiedad !== "usado" || u.plazoCredito !== "30" || u.pieMonto !== "20" || u.pieUnidad !== "pct" || u.tasaInteres !== "4,04" || u.arriendo !== "500000") F("4 · un usado sin año no se evalúa con 25 años, pie, 30 años y tasa de mercado");
  if (respuestasDeAviso({ ...aviso, antiguedadAnios: 8 }, 20, 4.04, 1).antiguedad !== "6-10") F("4 · con año de la ficha no usa el real");
  const n = respuestasDeAviso({ ...aviso, condicion: "nuevo", fechaEntrega: "2do Semestre 2027" }, 30, 4.04, 1);
  if (n.tipoPropiedad !== "nuevo" || n.estadoVenta !== "futura" || n.fechaEntregaMes !== "12" || n.fechaEntregaAnio !== "2027" || n.antiguedad !== undefined) F("4 · la obra nueva no se evalúa con su entrega real");
  if (respuestasDeAviso({ ...aviso, condicion: "nuevo", fechaEntrega: "Inmediata" }, 20, 4.04, 1).estadoVenta !== "inmediata") F("4 · la entrega inmediata no se lee como inmediata");
  if (!/for \(const pie of PERFILES_ESTANDAR\)/.test(ev) || !/runAnalysis\(body as never, cfg\.uf, mediana as never, new Date\(\)\)/.test(ev) || !/prefetchMedianaComunaVenta\(sb as never, body as never, cfg\.uf\)/.test(ev)) F("4 · la evaluación no corre el motor con la mediana comunal para los dos pies");

  // ── 5 · qué se evalúa ──
  const ahora = new Date("2026-09-30T12:00:00Z");
  const fila = (id: string, extra: Record<string, unknown> = {}) => ({ id, comuna: "Ñuñoa", lat: -33.45, lng: -70.6, precio: 120000000, moneda: "CLP", superficie_m2: 50, dormitorios: 2, banos: 1, condicion: "usado", direccion: null, scraped_at: "2026-09-29T12:00:00Z", ...extra });
  const ev1 = avisosEvaluables([fila("a"), fila("b", { lat: -33.4501 }), fila("c", { lat: -33.47 }), fila("d", { precio: 1000 }), fila("e", { superficie_m2: null }), fila("f", { scraped_at: "2026-09-26T00:00:00Z", lat: -33.49 })], 40000);
  if (ev1.map((x) => x.id).join(",") !== "a,c,f") F(`5 · la depuración no saca duplicados, implausibles e incompletos (${ev1.map((x) => x.id).join(",")})`);
  const g = (id: string, precio: number, dias: number, v = "v3") => ({ aviso_id: id, precio_uf: precio, evaluado_at: new Date(ahora.getTime() - dias * 864e5).toISOString(), motor_version: v });
  const ev2 = avisosEvaluables([fila("a"), fila("c", { lat: -33.47 }), fila("f", { scraped_at: "2026-09-26T00:00:00Z", lat: -33.49 }), fila("h", { lat: -33.5 }), fila("k", { lat: -33.51 }), fila("m", { lat: -33.52 })], 40000);
  const pend = avisosPendientes(ev2, [g("a", 3000, 1), g("c", 2000, 1), g("h", 3000, 8), g("k", 3000, 1, "v2")], "v3", ahora).map((x) => x.id);
  if (pend.join(",") !== "m,c,h,k") F(`5 · los pendientes no son los que tocan, en su orden (${pend.join(",")})`);
  if (VENTANA_VISTOS_DIAS !== 3 || REEVALUAR_DIAS !== 7) F("5 · la ventana no es de 3 días vistos y 7 de reevaluación");

  // ── 6 · el cron ──
  const cron = sinComentarios(leer("src/app/api/cron/evaluar-avisos/route.ts"));
  if (!/if \(request\.headers\.get\("authorization"\) !== `Bearer \$\{cronSecret\}`\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);/.test(cron)) F("6 · el cron no exige CRON_SECRET");
  const maxD = Number((cron.match(/export const maxDuration = (\d+);/) ?? [])[1]);
  const pres = Number(((cron.match(/const PRESUPUESTO_MS = ([\d_]+);/) ?? [])[1] ?? "").replace(/_/g, ""));
  if (!(maxD > 0 && pres > 0 && pres <= maxD * 1000 - 90_000) || !/while \(i < cola\.length && Date\.now\(\) - t0 < PRESUPUESTO_MS\)/.test(cron)) F(`6 · el cron no corta por presupuesto con holgura antes del maxDuration (${pres} ms de ${maxD} s)`);
  for (const f of ["src/app/api/cron/evaluar-avisos/route.ts", "src/lib/avisos/evaluar-aviso.ts", "src/lib/avisos/depurar.ts"]) {
    const s = sinComentarios(leer(f));
    const escrituras = s.match(/\.from\("([a-z_]+)"\)[\s\S]{0,80}?\.(upsert|insert|update|delete)\(/g) ?? [];
    for (const w of escrituras) if (!/\.from\("avisos_evaluados"\)/.test(w)) F(`6 · ${f} escribe fuera de avisos_evaluados: ${w.slice(0, 60)}`);
  }
  if (!/if \(dry\) \{ muestraDry\.push\(fila\); exitosos\+\+; continue; \}\s*const \{ error \} = await sb\.from\("avisos_evaluados"\)\.upsert\(fila, \{ onConflict: "aviso_id" \}\);/.test(cron)) F("6 · el modo dry escribe (o el upsert no es idempotente por aviso)");
  if (!/await evaluarAviso\(sb, a, cfg, \{ segmentar: false \}\)/.test(cron)) F("6 · el cron evalúa con el arriendo del segmento, que el censo del 29-sep descartó");
  if (!/\.gte\("scraped_at", desde\)/.test(cron) || !/VENTANA_VISTOS_DIAS \* 864e5/.test(cron)) F("6 · el cron no lee solo los avisos vistos en la ventana");
  const vj = JSON.parse(leer("vercel.json")) as { crons: { path: string; schedule: string }[] };
  const c = vj.crons.find((x) => x.path === "/api/cron/evaluar-avisos");
  if (!c || !/^\d+ \* \* \* 2$/.test(c.schedule)) F("6 · el cron no está en vercel.json corriendo cada hora los martes");
  if (!/\{ nombre: "evaluar-avisos", label: "[^"]+", intervaloHoras: 1[67]\d[ ,}]/.test(leer("src/lib/cron-heartbeat.ts"))) F("6 · el cron no está vigilado en el heartbeat (semanal)");
  if (!/create table if not exists public\.avisos_evaluados/.test(mig) || !/alter table public\.avisos_evaluados enable row level security;/.test(mig) || /create policy/i.test(mig)) F("6 · la tabla no existe en la migración, o no tiene RLS, o abre políticas");

  if (fallas.length) {
    console.log(`  ✗ AVISOS · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la entrega se guarda y se lee; el arriendo del segmento sigue al precio; la evaluación es la del wizard con 25 años y el perfil estándar; los pendientes y el cron escriben solo en avisos_evaluados, cortan a tiempo y están vigilados");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES ─────────────────────────────────────────────────────────
// 29-sep-2026, scratchpad mutar.py: 21/21 en rojo, restauradas byte a byte.
//   M1  la unidad de obra nueva sin fechaEntrega ............ 1 · el GraphQL no pasa la fecha
//   M2  propertyToRow sin fecha_entrega ...................... 1 · propertyToRow no escribe
//   M3  la migración crea otra columna ....................... 1 · la migración no crea la columna
//   M4  una entrega pasada no se lee inmediata ............... 2 · «1° Semestre 2025»
//   M5  el segmento con 5 ventas ............................. 3 · con menos de 10 ventas igual segmenta
//   M6  antigüedad supuesta «3-5» ............................ 4 · la antigüedad supuesta no es 25 años
//   M6b ANIOS_ANTIGUEDAD_SUPUESTA = 5 ........................ 4 · ídem
//   M7  "use client" en wizardV4Payload ...................... 4 · vuelve a depender de un módulo de cliente
//   M8  un solo perfil (pie 20%) ............................. 4 · el perfil estándar no es 20% y 30%
//   M9  ventana de 7 días .................................... 5 · los pendientes (f,m,c,h,k)
//   M10 no reevalúa por versión del motor .................... 5 · los pendientes (m,c,h)
//   M11 los ya evaluados primero ............................. 5 · los pendientes (c,h,k,m)
//   M12 sin dedup ............................................ 5 · la depuración (a,b,c,f)
//   M13 cron sin CRON_SECRET ................................. 6 · no exige CRON_SECRET
//   M14 presupuesto 790 s de 800 ............................. 6 · no corta con holgura
//   M15 el dry sigue al upsert ............................... 6 · el modo dry escribe
//   M16 el cron además actualiza scraped_properties .......... 6 · escribe fuera de avisos_evaluados
//   M17 ruta cambiada en vercel.json ......................... 6 · no está en vercel.json
//   M18 heartbeat con otro nombre ............................ 6 · no está vigilado
//   M19 la migración sin RLS ................................. 6 · sin RLS
//   M20 la obra nueva siempre inmediata ...................... 4 · sin su entrega real
//   M21 el cron con segmentar: true .......................... 6 · el arriendo del segmento, descartado

if (require.main === module) {
  const { hard } = runAvisosTier();
  process.exit(hard ? 1 : 0);
}
