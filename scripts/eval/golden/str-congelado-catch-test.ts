// ============================================================================
// GOLDEN · CONGELADO STR — catch-test. 0 tokens, read-only (lee tres filas; no persiste nada).
// ============================================================================
// Tres filas reales del parque, recomputadas EN MEMORIA con la UF de su día:
//   · eb7b3a66 (Sta. Rosa) · 18f29784 (Providencia, estructural) · 2ff73320 (Santiago, mes negativo).
//
// ACTA 27-sep-2026 — DE CIFRAS A REGLAS. Nació el 04-sep como el mockup «CONGELADO» del STR celda por
// celda: las seis cifras, el desglose, el día 1, la planilla, las fronteras, las dos matrices, las
// vías y seis cierres, todos PINEADOS a los valores de eb7b. Ese mockup dejó de ser el contrato hace
// rato (los cierres II y IV se retiraron, el informe se mudó a pop-ups) y la fila quedó justo en la
// frontera entre dos veredictos: cada decisión de producto que movía el motor la ponía en rojo, y el
// 22-sep ya se había re-pineado con actas. El 27-sep estaba en rojo en master con 11 fallas, fuera del
// runner, sin que nadie lo viera. Es el caso de CLAUDE.md § Testing: «un catch-test fija la REGLA,
// no la cifra».
//
// Salen los pins (las cifras de eb7b, los textos exactos de los cierres). Quedan, para las TRES filas,
// las reglas que esas cifras ilustraban —y que ningún otro tier mide sobre filas reales—:
//   1 · el Fall cuadra (ingreso − comisiones − costos − cuotas = lo que sale de tu bolsillo);
//   2 · el reparto del capítulo II sale del Fall (la cuota del reparto es la del Fall, con la del pie);
//   3 · el día 1 cierra y el escenario de salida parte de la misma inversión;
//   4 · la planilla de cada año cuadra con su flujo;
//   5 · las fronteras van en la dirección que dicen (hacia arriba mejora, hacia abajo empeora; en
//       COMPRAR no hay frontera hacia arriba ni en BUSCAR OTRA hacia abajo);
//   6 · LAS MATRICES HABLAN DEL MISMO VEREDICTO QUE EL INFORME: la celda «hoy» es el caso (su flujo y
//       su veredicto), y «cruza» / «cae» se leen contra ese veredicto;
//   7 · las palancas son exactamente las vías que cruzan, en el orden de siempre;
//   8 · los textos no traen palabras de motor;
//   9 · TODA sonda lee el veredicto como el informe (27-sep-2026, la lectura prudente): las fronteras
//       y las matrices salen de `lectorDeVeredicto`, la entrada de producción
//       (`simularStrDesdePersistido`) recibe el veredicto del informe y el render se lo pasa.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/str-congelado-catch-test.ts
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { buildStrRecomputeCtx } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import { calcShortTerm } from "../../../src/lib/engines/short-term-engine";
import { calcFrancoScoreSTR } from "../../../src/lib/engines/short-term-score";
import { buildStrHallazgos, mergeHallazgosStr } from "../../../src/lib/str-hallazgos";
import { getComunaMedianaVentaUF, resolverCondicionMercado } from "../../../src/lib/comuna-stats";
import { fronteraPrecioStr, fronterasIngresoStr, lectorDeVeredicto, simularStr, simularStrDesdePersistido } from "../../../src/lib/analysis/simular-str";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cierresStr, textoCierre } from "../../../src/lib/cierres-str-ensamblador";
import { avisoDia1 } from "../../../src/lib/plata-dia1";
import type { HallazgoDistanciaVeredicto } from "../../../src/lib/types";

const PROHIBIDO = /\brevenue\b|\boverride\b|\bfallback\b|\bllen(a|as|ar|an)\b/i;
const RANK: Record<string, number> = { "BUSCAR OTRA": 0, "AJUSTA SUPUESTOS": 1, COMPRAR: 2 };

const FILAS = [
  { id: "eb7b3a66-5769-4c57-92dc-a7c40229d6f9", tag: "eb7b" },
  { id: "18f29784-7203-45eb-806b-326d2a4fe112", tag: "18f2" },
  { id: "2ff73320-a4c9-4152-850e-5dc8b518f1c1", tag: "2ff7" },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cargar(sb: any, id: string) {
  const { data, error } = await sb.from("analisis").select("id, comuna, input_data, results, created_at").eq("id", id).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  if (error || !row) throw new Error(`${id.slice(0, 8)} · fila no cargó: ${error?.message}`);
  const d = row.input_data as Record<string, number | string>;
  const uf = (d.precioCompra as number) / (d.precioCompraUF as number);
  const ctx = buildStrRecomputeCtx(row.input_data, row.results, uf);
  if (!ctx) throw new Error(`${id.slice(0, 8)} · sin contexto`);
  const asOf = new Date(row.created_at as string);
  const result = calcShortTerm(ctx.inputs, asOf);
  const francoScore = calcFrancoScoreSTR({ ...ctx.scoreExtras, results: result, precioCompra: ctx.inputs.precioCompra });
  let mediana: { mediana: number | null; n: number } = { mediana: null, n: 0 };
  try {
    mediana = await getComunaMedianaVentaUF(sb, row.comuna as string, d.superficieUtil as number, (d.dormitorios as number) ?? null, uf,
      resolverCondicionMercado({ esNuevo: d.tipoPropiedad === "nuevo", antiguedad: d.antiguedad as number | undefined }));
  } catch { /* sin mediana */ }
  const veredictoCtx = { inputs: ctx.inputs, scoreExtras: ctx.scoreExtras, asOf };
  // `buildStrHallazgos` escribe el veredicto FINAL en `francoScore.veredicto` (el filtro «Ajustar sin
  // camino» corre ahí, después de la distancia). Todo lo que sigue se mide contra ESE veredicto.
  const hallazgos = mergeHallazgosStr(result.hallazgos, buildStrHallazgos({
    result, francoScore, comuna: row.comuna as string, precioUF: d.precioCompraUF as number, superficieM2: d.superficieUtil as number,
    piePct: d.piePct as number, tasaPct: d.tasaInteres as number, plazoAnios: d.plazoCredito as number, mediana, valorUF: uf, incluyeCorretaje: false, veredictoCtx,
  }));
  const pc = ctx.inputs.airbnbData.percentiles;
  const sim = simularStr(veredictoCtx, {
    veredicto: francoScore.veredicto, adr: result.ejesAplicados?.adrFinal ?? result.escenarios.base.adrReferencia,
    ocupacion: result.ejesAplicados?.ocupacionFinal ?? result.escenarios.base.ocupacionReferencia, precioCLP: ctx.inputs.precioCompra, precioUF: d.precioCompraUF as number,
  }, { adr: { p25: pc.average_daily_rate.p25, p75: pc.average_daily_rate.p75, p90: pc.average_daily_rate.p90 }, ocupacion: { p25: pc.occupancy.p25, p75: pc.occupancy.p75, p90: pc.occupancy.p90 } });
  const cierres = cierresStr({ result, francoScore, hallazgos, simulacion: sim, comuna: row.comuna as string, ufValue: uf, modoGestion: "auto" });
  return { d, result, francoScore, hallazgos, sim, cierres, row, uf, asOf, veredictoCtx };
}

export async function runStrCongeladoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER STR-CONGELADO (tres filas reales: las reglas del STR, no sus cifras · lee la base) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    F("sin credenciales de Supabase en el entorno: el tier no midió (correr con --env-file=.env.local)");
  } else {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    for (const { id, tag } of FILAS) {
      let c;
      try { c = await cargar(sb, id); } catch (e) { F(`${tag} · ${(e as Error).message}`); continue; }
      const { d: inp, result: r, francoScore, hallazgos, sim, cierres, row, uf, asOf, veredictoCtx } = c;
      const m = r.metrics;
      if (!m) { F(`${tag} · sin metrics`); continue; }
      const veredicto = francoScore.veredicto;
      const rank = RANK[veredicto];

      // 1 · el Fall cuadra
      const d = m.desgloseFall;
      const salidas = d.comisionPlataforma + d.administrador + d.costosDirectos + d.gastosComunesMantencion + d.contribucionesMensuales + d.cuota + (d.cuotaCreditoPie ?? 0);
      if (d.ingreso - salidas !== d.saleDeTuBolsillo) F(`${tag} · 1 · el Fall no cuadra: ${d.ingreso} − ${salidas} ≠ ${d.saleDeTuBolsillo}`);
      if (d.saleDeTuBolsillo !== m.flujoMensual) F(`${tag} · 1 · lo que sale de tu bolsillo (${d.saleDeTuBolsillo}) no es el flujo del mes (${m.flujoMensual})`);

      // 2 · el reparto sale del Fall
      const rep = m.repartoIngreso;
      if (!rep) F(`${tag} · 2 · sin reparto`);
      else {
        if (rep.cuota !== d.cuota + (d.cuotaCreditoPie ?? 0)) F(`${tag} · 2 · la cuota del reparto (${rep.cuota}) no es la del Fall`);
        if (rep.exceso !== Math.max(0, -m.flujoMensual) || rep.libre !== Math.max(0, m.flujoMensual)) F(`${tag} · 2 · exceso/libre no salen del flujo`);
        if (rep.cuotaPor100 !== Math.round((rep.cuota / d.ingreso) * 100)) F(`${tag} · 2 · el % de la cuota no es la cuota sobre el ingreso`);
        if (rep.forma !== (rep.cuota <= d.ingreso ? "cabe" : "supera")) F(`${tag} · 2 · la forma no sigue al corte «la cuota cabe»`);
      }

      // 3 · el día 1 cierra
      if (avisoDia1(m.dia1) !== null) F(`${tag} · 3 · el día 1 no cierra: ${avisoDia1(m.dia1)}`);
      if (r.exitScenario && r.exitScenario.inversionInicial !== m.dia1.inversionInicial) F(`${tag} · 3 · la salida parte de ${r.exitScenario.inversionInicial} y el día 1 de ${m.dia1.inversionInicial}`);

      // 4 · la planilla cuadra
      if (!r.projections?.length) F(`${tag} · 4 · sin planilla`);
      for (const p of r.projections ?? []) {
        const fl = p.ingresoNetoAnual! - p.cuotaAnual! - p.estabilizacionAnual! - p.amoblamientoAnual!;
        if (Math.abs(fl - p.flujoOperacionalAnual) > 2) { F(`${tag} · 4 · planilla año ${p.year}: ${fl} ≠ ${p.flujoOperacionalAnual}`); break; }
      }

      // 5 · las fronteras van en la dirección que dicen
      const fi = sim.fronterasIngreso;
      if (fi.arriba && (!(RANK[fi.arriba.veredicto] > rank) || !(fi.arriba.factor > 1) || !(fi.tarifa.arriba! > fi.tarifa.actual))) F(`${tag} · 5 · la frontera hacia arriba no mejora: ${JSON.stringify(fi.arriba)}`);
      if (fi.abajo && (!(RANK[fi.abajo.veredicto] < rank) || !(fi.abajo.factor < 1) || !(fi.tarifa.abajo! < fi.tarifa.actual))) F(`${tag} · 5 · la frontera hacia abajo no empeora: ${JSON.stringify(fi.abajo)}`);
      if (veredicto === "COMPRAR" && fi.arriba) F(`${tag} · 5 · en COMPRAR hay frontera hacia arriba`);
      if (veredicto === "BUSCAR OTRA" && fi.abajo) F(`${tag} · 5 · en BUSCAR OTRA hay frontera hacia abajo`);
      const fp = sim.fronteraPrecio;
      if (fp.subeA && (!(RANK[fp.subeA.veredicto] > rank) || !(fp.subeA.precioUF < (inp.precioCompraUF as number)))) F(`${tag} · 5 · bajar el precio no mejora: ${JSON.stringify(fp.subeA)}`);
      if (fp.caeA && (!(RANK[fp.caeA.veredicto] < rank) || !(fp.caeA.precioUF > (inp.precioCompraUF as number)))) F(`${tag} · 5 · subir el precio no empeora: ${JSON.stringify(fp.caeA)}`);

      // 6 · las matrices hablan del mismo veredicto que el informe
      const mt = sim.matrizTarifaOcupacion;
      const hoyT = mt.celdas.filter((x) => x.esActual);
      if (mt.celdas.length !== 16 || hoyT.length !== 1) F(`${tag} · 6 · tarifa × ocupación: ${mt.celdas.length} celdas, ${hoyT.length} «hoy»`);
      else {
        if (hoyT[0].flujoMensual !== m.flujoMensual) F(`${tag} · 6 · la celda «hoy» de tarifa × ocupación tiene flujo ${hoyT[0].flujoMensual}; el informe, ${m.flujoMensual}`);
        if (hoyT[0].veredicto !== veredicto) F(`${tag} · 6 · la celda «hoy» de tarifa × ocupación dice ${hoyT[0].veredicto} y el informe ${veredicto}`);
      }
      for (const x of mt.celdas) {
        if (x.cruza !== (RANK[x.veredicto] > rank) || x.cae !== (RANK[x.veredicto] < rank)) { F(`${tag} · 6 · una celda de tarifa × ocupación marca cruza/cae contra otro veredicto que el del informe`); break; }
      }
      const mp = sim.matrizPiePlazo;
      const hoyP = mp.celdas.filter((x) => x.esActual);
      if (mp.celdas.length !== 16 || hoyP.length !== 1) F(`${tag} · 6 · pie × plazo: ${mp.celdas.length} celdas, ${hoyP.length} «hoy»`);
      else {
        if (hoyP[0].piePct !== Number(inp.piePct) || hoyP[0].plazoAnios !== Number(inp.plazoCredito) || hoyP[0].flujoMensual !== m.flujoMensual) F(`${tag} · 6 · la celda «hoy» de pie × plazo no es el caso: ${JSON.stringify(hoyP[0])}`);
        if (hoyP[0].veredicto !== veredicto) F(`${tag} · 6 · la celda «hoy» de pie × plazo dice ${hoyP[0].veredicto} y el informe ${veredicto}`);
      }
      if (mp.celdas.some((x) => x.cruza !== (RANK[x.veredicto] > rank))) F(`${tag} · 6 · una celda de pie × plazo marca «cruza» contra otro veredicto que el del informe`);

      // 7 · las palancas son las vías que cruzan
      const dv = hallazgos.find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined;
      const vias = dv?.valor.vias ?? [];
      if (vias.map((v) => v.palanca).join() !== "precio,adr,plazo,pie,gestion") F(`${tag} · 7 · orden de las vías: ${vias.map((v) => v.palanca).join()}`);
      const cruzan = vias.filter((v) => v.estado === "cruza").map((v) => v.palanca).sort().join();
      const palancas = (dv?.valor.palancas ?? []).map((p) => p.palanca).sort().join();
      if (cruzan !== palancas) F(`${tag} · 7 · palancas (${palancas}) ≠ vías que cruzan (${cruzan})`);
      if (dv?.valor.esEstructural && cruzan) F(`${tag} · 7 · es estructural y hay vías que cruzan (${cruzan})`);

      // 8 · los textos, limpios
      const textos = [textoCierre(cierres.renta), textoCierre(cierres.noches), textoCierre(cierres.gestion), textoCierre(cierres.resultado)]
        .concat(hallazgos.map((h) => h.fraseCanonica));
      for (const t of textos) { const w = PROHIBIDO.exec(t ?? ""); if (w) { F(`${tag} · 8 · palabra de motor «${w[0]}» en: ${t.slice(0, 90)}`); break; } }

      // 9 · toda sonda lee el veredicto como el informe
      const leer = lectorDeVeredicto(veredictoCtx, veredicto);
      const baseSim = { veredicto, adr: r.ejesAplicados?.adrFinal ?? r.escenarios.base.adrReferencia, ocupacion: r.ejesAplicados?.ocupacionFinal ?? r.escenarios.base.ocupacionReferencia, precioCLP: veredictoCtx.inputs.precioCompra, precioUF: inp.precioCompraUF as number };
      if (JSON.stringify(sim.fronterasIngreso) !== JSON.stringify(fronterasIngresoStr(veredictoCtx, baseSim, leer))) F(`${tag} · 9 · la frontera del ingreso no lee el veredicto como el informe`);
      if (JSON.stringify(sim.fronteraPrecio) !== JSON.stringify(fronteraPrecioStr(veredictoCtx, baseSim, leer))) F(`${tag} · 9 · la frontera del precio no lee el veredicto como el informe`);
      const prod = simularStrDesdePersistido(row.input_data, row.results, uf, asOf, undefined, veredicto);
      if (!prod) F(`${tag} · 9 · la entrada de producción no simuló: el tier no midió`);
      else {
        const hoyProd = [...prod.matrizTarifaOcupacion.celdas, ...prod.matrizPiePlazo.celdas].filter((x) => x.esActual);
        if (hoyProd.length !== 2 || hoyProd.some((x) => x.veredicto !== veredicto)) F(`${tag} · 9 · en producción la celda «hoy» dice ${hoyProd.map((x) => x.veredicto).join(" / ")} y el informe ${veredicto}`);
        if (JSON.stringify(prod.fronterasIngreso) !== JSON.stringify(sim.fronterasIngreso)) F(`${tag} · 9 · en producción las fronteras no son las del informe`);
      }

      console.log(`  ${tag} · ${veredicto} (${francoScore.score}) · flujo ${m.flujoMensual}`);
    }
  }
  // 9 · el render le pasa a la simulación el veredicto del informe
  const informe = readFileSync(join(__dirname, "..", "..", "..", "src/app/analisis/renta-corta/[id]/informe-str.tsx"), "utf8").replace(/\r\n/g, "\n");
  if (!/return simularStrDesdePersistido\([^\n]*, medianaStr, veredictoInforme\);/.test(informe)) F("9 · el informe STR simula sin el veredicto del informe");

  if (fallas.length) {
    console.log(`  ✗ STR-CONGELADO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — en las tres filas: el Fall y la planilla cuadran, el reparto sale del Fall, el día 1 cierra, las fronteras van donde dicen, las matrices hablan del veredicto del informe, las palancas son las vías que cruzan y los textos están limpios");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runStrCongeladoTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}

// ACTAS DE MUTACIÓN (27-sep-2026) — cada una aplicada, corrida contra este tier y restaurada.
// De las reglas (antes de la lectura prudente, sobre el motor): M6 las matrices marcan «cruza» con
// empate · M7 la celda «hoy» se recomputa redondeada — las dos en ROJO con su propia falla.
// De la lectura prudente, las 8 en ROJO; restauradas, VERDE: P1 el lector no baja nada · P2 tarifa ×
// ocupación sin el lector · P3 pie × plazo sin el lector · P4 la frontera del ingreso sin el lector ·
// P5 la del precio sin el lector · P6 producción ignora el veredicto del informe · P7 el render no lo
// pasa · P8 el lector sube en vez de bajar.
