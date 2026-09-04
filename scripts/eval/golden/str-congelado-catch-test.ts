// ============================================================================
// GOLDEN · CONGELADO STR (T0 · 04-sep-2026) — catch-test. 0 tokens, read-only.
// ============================================================================
// Tres filas reales del parque, recomputadas EN MEMORIA con la UF congelada del corto:
//   · eb7b3a66 (Sta. Rosa, AJUSTA): las cifras del mockup CONGELADO celda por celda —
//     metrics, desglose del Fall y tramos, día 1, planilla, fronteras, las dos matrices,
//     vias y los seis cierres deterministas.
//   · 18f29784 (Providencia, BUSCAR OTRA): estructural — las cinco vías sin cruzar, la
//     frase leída de `vias`, los cierres no prometen ajuste.
//   · 2ff73320 (Santiago, COMPRAR con mes negativo): cruza aunque el mes quede en rojo;
//     el cierre I no ofrece subir, el II pide el bolsillo, la matriz no marca "cruza".
// Nada se persiste.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/str-congelado-catch-test.ts
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { buildStrRecomputeCtx } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import { calcShortTerm } from "../../../src/lib/engines/short-term-engine";
import { calcFrancoScoreSTR } from "../../../src/lib/engines/short-term-score";
import { buildStrHallazgos, mergeHallazgosStr } from "../../../src/lib/str-hallazgos";
import { getComunaMedianaVentaUF, resolverCondicionMercado } from "../../../src/lib/comuna-stats";
import { simularStr } from "../../../src/lib/analysis/simular-str";
import { cierresStr, textoCierre } from "../../../src/lib/cierres-str-ensamblador";
import { avisoDia1 } from "../../../src/lib/plata-dia1";
import type { HallazgoDistanciaVeredicto } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const cerca = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const PROHIBIDO = /\brevenue\b|\boverride\b|\bfallback\b|\bllen(a|as|ar|an)\b/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cargar(sb: any, id: string, modo: "auto" | "administrador") {
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
  const hallazgos = mergeHallazgosStr(result.hallazgos, buildStrHallazgos({
    result, francoScore, comuna: row.comuna as string, precioUF: d.precioCompraUF as number, superficieM2: d.superficieUtil as number,
    piePct: d.piePct as number, tasaPct: d.tasaInteres as number, plazoAnios: d.plazoCredito as number, mediana, valorUF: uf, incluyeCorretaje: false, veredictoCtx,
  }));
  const pc = ctx.inputs.airbnbData.percentiles;
  const sim = simularStr(veredictoCtx, {
    veredicto: francoScore.veredicto, adr: result.ejesAplicados?.adrFinal ?? result.escenarios.base.adrReferencia,
    ocupacion: result.ejesAplicados?.ocupacionFinal ?? result.escenarios.base.ocupacionReferencia, precioCLP: ctx.inputs.precioCompra, precioUF: d.precioCompraUF as number,
  }, { adr: { p25: pc.average_daily_rate.p25, p75: pc.average_daily_rate.p75, p90: pc.average_daily_rate.p90 }, ocupacion: { p25: pc.occupancy.p25, p75: pc.occupancy.p75, p90: pc.occupancy.p90 } });
  const cierres = cierresStr({ result, francoScore, hallazgos, simulacion: sim, comuna: row.comuna as string, ufValue: uf, modoGestion: modo });
  return { row, d, uf, result, francoScore, hallazgos, sim, cierres };
}

function textoLimpio(tag: string, textos: string[]) {
  for (const t of textos) { const m = PROHIBIDO.exec(t); if (m) F(`${tag} · palabra prohibida "${m[0]}" en: ${t.slice(0, 90)}`); }
}

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");

  // ── 1 · Sta. Rosa: el CONGELADO celda por celda ──
  {
    const { result: r, francoScore, hallazgos, sim, cierres } = await cargar(sb, "eb7b3a66-5769-4c57-92dc-a7c40229d6f9", "auto");
    const m = r.metrics!;
    if (francoScore.veredicto !== "AJUSTA SUPUESTOS") F(`eb7b · veredicto ${francoScore.veredicto}`);
    if (!m) F("eb7b · sin metrics");
    // seis cifras
    if (m.ingresoEstabilizadoMensual !== 592012) F(`eb7b · ingreso ${m.ingresoEstabilizadoMensual} ≠ 592.012`);
    if (m.flujoMensual !== -84407) F(`eb7b · flujo ${m.flujoMensual} ≠ −84.407`);
    if (!cerca(m.capRatePct, 4.15, 0.01)) F(`eb7b · cap ${m.capRatePct}`);
    if (!cerca(m.tirPct ?? 0, 9.31, 0.01)) F(`eb7b · TIR ${m.tirPct}`);
    if (m.tarifaNoche !== 45552) F(`eb7b · tarifa ${m.tarifaNoche}`);
    if (!cerca(m.ocupacion, 0.4273, 0.0005)) F(`eb7b · ocupación ${m.ocupacion}`);
    // Fall + tramos
    const d = m.desgloseFall;
    if (d.comisionPlataforma !== 17760 || d.administrador !== 0) F(`eb7b · comisión ${d.comisionPlataforma}/${d.administrador}`);
    if (d.costosDirectos !== 85000 || d.gastosComunesMantencion !== 92000 || d.contribucionesMensuales !== 15734 || d.cuota !== 465925) F(`eb7b · desglose ${JSON.stringify(d)}`);
    if (d.ingreso - d.comisionPlataforma - d.administrador - d.costosDirectos - d.gastosComunesMantencion - d.contribucionesMensuales - d.cuota !== d.saleDeTuBolsillo) F("eb7b · el Fall no cuadra");
    if (m.tramosBarra.exceso !== 84407 || m.tramosBarra.libre !== 0 || m.tramosBarra.costosOperar !== 210494) F(`eb7b · tramos ${JSON.stringify(m.tramosBarra)}`);
    // día 1
    const d1 = m.dia1;
    if (d1.pieCLP !== 22067640 || d1.gastosCompraCLP !== 2206764 || d1.amoblamientoCLP !== 2500000 || d1.capexCLP !== 0 || d1.inversionInicial !== 26774404) F(`eb7b · día 1 ${JSON.stringify(d1)}`);
    if (avisoDia1(d1) !== null) F(`eb7b · día 1 no cierra: ${avisoDia1(d1)}`);
    if (r.exitScenario?.inversionInicial !== 26774404) F(`eb7b · exit.inversionInicial ${r.exitScenario?.inversionInicial}`);
    // planilla
    const p1 = r.projections![0];
    if (p1.ingresoAnual !== 7104142 || (p1.comisionAnual! + p1.costosAnual!) !== 2525932 || p1.ingresoNetoAnual !== 4578210 || p1.cuotaAnual !== 5591100 || p1.estabilizacionAnual !== 888018) F(`eb7b · planilla año 1 ${JSON.stringify(p1)}`);
    for (const p of r.projections!) {
      const fl = p.ingresoNetoAnual! - p.cuotaAnual! - p.estabilizacionAnual! - p.amoblamientoAnual!;
      if (Math.abs(fl - p.flujoOperacionalAnual) > 2) F(`eb7b · planilla año ${p.year}: ${fl} ≠ ${p.flujoOperacionalAnual}`);
    }
    // fronteras
    const fi = sim.fronterasIngreso;
    if (!fi.abajo || !cerca(fi.abajo.factor, 0.882, 0.003) || fi.abajo.veredicto !== "BUSCAR OTRA") F(`eb7b · frontera abajo ${JSON.stringify(fi.abajo)}`);
    if (!fi.arriba || !cerca(fi.arriba.factor, 1.043, 0.003) || fi.arriba.veredicto !== "COMPRAR") F(`eb7b · frontera arriba ${JSON.stringify(fi.arriba)}`);
    if (fi.tarifa.arriba == null || !cerca(fi.tarifa.arriba, 47510, 30) || fi.ocupacion.arriba == null || !cerca(fi.ocupacion.arriba, 0.446, 0.002)) F(`eb7b · fronteras en unidades ${JSON.stringify(fi.tarifa)} ${JSON.stringify(fi.ocupacion)}`);
    const fp = sim.fronteraPrecio;
    if (!fp.subeA || !cerca(fp.subeA.precioUF, 2536, 2) || !fp.caeA || !cerca(fp.caeA.precioUF, 3210, 4)) F(`eb7b · frontera precio ${JSON.stringify(fp)}`);
    // matriz tarifa × ocupación
    const mt = sim.matrizTarifaOcupacion;
    if (mt.celdas.length !== 16) F(`eb7b · matriz T×O ${mt.celdas.length} celdas`);
    if (mt.celdas.filter((c) => c.cruza).length !== 11) F(`eb7b · cruzan ${mt.celdas.filter((c) => c.cruza).length}, esperado 11`);
    const hoy = mt.celdas.find((c) => c.esActual);
    if (!hoy || hoy.flujoMensual !== -84407 || hoy.veredicto !== "AJUSTA SUPUESTOS") F(`eb7b · celda hoy ${JSON.stringify(hoy)}`);
    const negCruza = mt.celdas.find((c) => c.cruza && c.flujoMensual < 0);
    if (!negCruza || negCruza.tarifaCLP !== 75061 || Math.round(negCruza.ocupacion * 100) !== 30) F(`eb7b · cruza con mes negativo ${JSON.stringify(negCruza)}`);
    // matriz pie × plazo
    const mp = sim.matrizPiePlazo;
    if (mp.celdas.length !== 16 || mp.pies.join() !== "15,20,25,30") F(`eb7b · matriz P×P ${mp.pies.join()} · ${mp.celdas.length}`);
    const c3030 = mp.celdas.find((c) => c.piePct === 30 && c.plazoAnios === 30);
    if (!c3030 || c3030.flujoMensual !== 12778 || !c3030.cruza || mp.celdas.filter((c) => c.cruza).length !== 1) F(`eb7b · 30×30 ${JSON.stringify(c3030)}`);
    const cHoy = mp.celdas.find((c) => c.esActual);
    if (!cHoy || cHoy.piePct !== 20 || cHoy.plazoAnios !== 25 || cHoy.flujoMensual !== -84407 || !cerca(cHoy.tirPct ?? 0, 9.31, 0.01)) F(`eb7b · P×P hoy ${JSON.stringify(cHoy)}`);
    // vias
    const dv = hallazgos.find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined;
    const vias = dv?.valor.vias ?? [];
    const estado = (p: string) => vias.find((v) => v.palanca === p)?.estado;
    if (vias.map((v) => v.palanca).join() !== "precio,adr,plazo,pie,gestion") F(`eb7b · orden de vias ${vias.map((v) => v.palanca).join()}`);
    if (estado("precio") !== "cruza" || estado("adr") !== "cruza" || estado("plazo") !== "noCruza" || estado("pie") !== "noCruza" || estado("gestion") !== "noCruza") F(`eb7b · estados ${vias.map((v) => `${v.palanca}:${v.estado}`).join(",")}`);
    const vPie = vias.find((v) => v.palanca === "pie");
    if (vPie?.estado === "noCruza" && vPie.topeExplorado !== 30) F("eb7b · el pie debía explorarse hasta 30%");
    if ((dv?.valor.palancas ?? []).map((p) => p.palanca).join() !== "adr,precio") F(`eb7b · palancas ${(dv?.valor.palancas ?? []).map((p) => p.palanca).join()}`);
    if (dv?.valor.palancas.length !== vias.filter((v) => v.estado === "cruza").length) F("eb7b · palancas ≠ vias.filter(cruza)");
    // flujo_str
    const fs = hallazgos.find((h) => h.id === "flujo_str");
    if (!fs || !/ocupación estimada para tu depto/.test(fs.fraseCanonica)) F(`eb7b · flujo_str: ${fs?.fraseCanonica.slice(0, 80)}`);
    // cierres
    const T = { renta: textoCierre(cierres.renta), flujo: textoCierre(cierres.flujo), noches: textoCierre(cierres.noches), pagas: textoCierre(cierres.pagas), gestion: textoCierre(cierres.gestion), resultado: textoCierre(cierres.resultado) };
    if (!/sube a COMPRAR/.test(T.renta) || !/\$47\.5\d\d por noche/.test(T.renta) || !/cruza a COMPRAR aunque el mes quede en −\$919/.test(T.renta)) F(`eb7b · cierre I: ${T.renta}`);
    if (!/\$84\.407/.test(T.flujo) || !/\$888\.018/.test(T.flujo) || !/un tercio/.test(T.flujo) || !/\$185\.049/.test(T.flujo)) F(`eb7b · cierre II: ${T.flujo}`);
    if (!/156 noches/.test(T.noches) || !/sube con 163/.test(T.noches) || !/menos de dos puntos/.test(T.noches) || !/un solo mes en verde/.test(T.noches)) F(`eb7b · cierre III: ${T.noches}`);
    if (!/Bajo UF 2\.536/.test(T.pagas) || !/25,0% bajo la mediana de 181/.test(T.pagas) || !/solo 30% de pie a 30 años llega a COMPRAR/.test(T.pagas) || !/\$47\.510 por noche/.test(T.pagas)) F(`eb7b · cierre IV: ${T.pagas}`);
    if (!/\$150\.102/.test(T.gestion) || !/\$49\.460/.test(T.gestion) || !/dos tercios/.test(T.gestion) || !/\$185\.049/.test(T.gestion)) F(`eb7b · cierre V: ${T.gestion}`);
    if (!/×2,20/.test(T.resultado) && !/9,3/.test(T.resultado)) F(`eb7b · cierre VI: ${T.resultado}`);
    textoLimpio("eb7b", Object.values(T).concat(hallazgos.map((h) => h.fraseCanonica)));
    console.log("  eb7b3a66 · Sta. Rosa · " + francoScore.veredicto + "\n    I  " + T.renta + "\n    II " + T.flujo + "\n    III " + T.noches + "\n    IV " + T.pagas + "\n    V  " + T.gestion + "\n    VI " + T.resultado);
  }

  // ── 2 · Estructural ──
  {
    const { francoScore, hallazgos, sim, cierres } = await cargar(sb, "18f29784-7203-45eb-806b-326d2a4fe112", "auto");
    const dv = hallazgos.find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined;
    if (!dv?.valor.esEstructural) F("18f2 · debía ser estructural");
    if ((dv?.valor.vias ?? []).some((v) => v.estado === "cruza")) F("18f2 · ninguna vía debía cruzar");
    if (!/Ni a 30 años, ni con pie 30% ni con administrador cambia\./.test(dv?.fraseCanonica ?? "")) F(`18f2 · frase estructural: ${dv?.fraseCanonica}`);
    if (sim.matrizPiePlazo.celdas.some((c) => c.cruza)) F("18f2 · la matriz pie × plazo no debía cruzar");
    const T = { renta: textoCierre(cierres.renta), pagas: textoCierre(cierres.pagas), noches: textoCierre(cierres.noches) };
    if (/negociación y no otro departamento/.test(T.pagas)) F(`18f2 · cierre IV promete precio: ${T.pagas}`);
    if (!/ninguna cambia el veredicto/.test(T.pagas)) F(`18f2 · cierre IV debía decir que ninguna combinación cambia: ${T.pagas}`);
    textoLimpio("18f2", Object.values(T));
    console.log(`  18f29784 · estructural · ${francoScore.veredicto}\n    I  ${T.renta}\n    IV ${T.pagas}`);
  }

  // ── 3 · COMPRAR con mes negativo ──
  {
    const { result: r, francoScore, sim, cierres } = await cargar(sb, "2ff73320-a4c9-4152-850e-5dc8b518f1c1", "auto");
    if (francoScore.veredicto !== "COMPRAR" || !(r.metrics!.flujoMensual < 0)) F(`2ff7 · ${francoScore.veredicto} / ${r.metrics?.flujoMensual}`);
    if (sim.fronterasIngreso.arriba !== null || sim.fronteraPrecio.subeA !== null) F("2ff7 · en COMPRAR no hay frontera hacia arriba");
    if (sim.matrizTarifaOcupacion.celdas.some((c) => c.cruza) || sim.matrizPiePlazo.celdas.some((c) => c.cruza)) F("2ff7 · en COMPRAR ninguna celda cruza");
    if (r.metrics!.tramosBarra.exceso <= 0 || r.metrics!.tramosBarra.libre !== 0) F(`2ff7 · tramos ${JSON.stringify(r.metrics!.tramosBarra)}`);
    const T = { renta: textoCierre(cierres.renta), flujo: textoCierre(cierres.flujo), noches: textoCierre(cierres.noches), pagas: textoCierre(cierres.pagas) };
    if (/sube a/.test(T.renta)) F(`2ff7 · cierre I ofrece subir en COMPRAR: ${T.renta}`);
    if (!/antes de caer a/.test(T.renta) && !/firme/.test(T.renta)) F(`2ff7 · cierre I sin colchón: ${T.renta}`);
    if (!/¿Tienes \$/.test(T.flujo)) F(`2ff7 · cierre II debía pedir el bolsillo: ${T.flujo}`);
    if (!/ya no necesita más/.test(T.noches)) F(`2ff7 · cierre III: ${T.noches}`);
    textoLimpio("2ff7", Object.values(T));
    console.log(`  2ff73320 · COMPRAR con mes negativo (${r.metrics!.flujoMensual})\n    I  ${T.renta}\n    II ${T.flujo}\n    III ${T.noches}`);
  }

  console.log("\nCONGELADO STR · catch-test\n");
  if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
  console.log("✓ VERDE");
}
main().catch((e) => { console.error(e); process.exit(1); });
