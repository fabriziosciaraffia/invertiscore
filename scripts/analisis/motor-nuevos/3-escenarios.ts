// ─────────────────────────────────────────────────────────────────────────────
// FASE 1 · LOS ESCENARIOS SOBRE LA LÍNEA BASE CORREGIDA (decisiones de Fabrizio, 05-nov-2026). Lee out/1-base-corregida.json
// (todas las filas: guardado, 0a = UF y tasa de hoy, 0b = superficie corregida con mediana en vivo), out/1-medianas-celda.json
// (las medianas resueltas por celda) y out/2-premio.json (el premio medido por comuna). Para los NUEVOS vuelve a correr el
// motor real con:
//   1.2a  el premio medido de su comuna (n ≥ 15; si no, el de Gran Santiago) en vez del 3 %, sin tope;
//   1.2b  lo mismo con tope: entre 0 % y 5 % (el tope vigente);
//   juntas = 1.2b sobre 0b (1.1 no cambia ninguna fila y 1.3 ya es la regla del motor: la mediana del universo nuevo).
// 1.1: cuántas filas siguen con gastos comunes 0 después de corregir el m². 1.3: celdas con n suficiente, el brazo de
// sobreprecio del GATE 1 y qué pasa con la celda vacía. Cap de referencia: cuántos nuevos seguirían en bdo con la celda
// combinada usado + nuevo (solo para el hallazgo, sin recalcular veredictos). Solo lectura. Salida: out/3-escenarios.json.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cliente, universoActivo, evaluarConMotor, conSuperficieDosDecimales, fmt, pct, tablaMd, paginar, type Config } from "./comun";
import type { FilaBase, Cuenta } from "./1-base-corregida";
import { CASCADA_CAPREF, construirCeldaCapRef, evaluarPeldanoCapRef, capRefSinAvisos, type CeldaCapRef, type MuestraCapRef } from "../../../src/lib/capref-comuna";
import { filtrarTipologiaObraNueva, PAGINA_POSTGREST } from "../../../src/lib/comuna-stats";

const PREMIO_HOY = 0.03;
const TOPE = 0.05;
const MIN_N_COMUNA = 15;
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };

type Escenario = "guardado" | "a" | "b" | "premio" | "premioTope";
const NOMBRES: Record<Escenario, string> = {
  guardado: "Línea base de hoy (lo guardado: UF y tasa del día en que se evaluó)",
  a: "0a · lo guardado con la UF y la tasa de hoy",
  b: "0b · superficie corregida (nueva línea base)",
  premio: "1.2a · premio medido por comuna, sin tope",
  premioTope: "1.2b / juntas · premio medido con tope 0–5 %",
};

async function main() {
  const base = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/1-base-corregida.json", "utf8")) as { cfg: Config; filas: FilaBase[] };
  const celdas = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/1-medianas-celda.json", "utf8")) as Record<string, unknown>;
  const premio = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/2-premio.json", "utf8")) as { premioGranSantiago: number; porComuna: Array<{ comuna: string; nCelda: number; premioCelda: number | null }> };
  const cfg = base.cfg;
  const porId = new Map(base.filas.map((f) => [f.id, f]));
  console.log(`base: ${fmt(base.filas.length)} filas · UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} % · celdas en vivo ${fmt(Object.keys(celdas).length)}`);

  // «Limpio» = sin sospechosos ni degradados y con arriendo (la regla 5 y el universo de Explorar).
  const limpio = (f: FilaBase) => !f.sospechoso && !f.degradado && f.arriendo > 0;
  const nuevos = base.filas.filter((f) => f.cond === "nuevo" && limpio(f));
  const usados = base.filas.filter((f) => f.cond === "usado" && limpio(f));

  // ── 1.1 · gastos comunes que siguen en 0 tras corregir el m² ──
  const gastos0 = base.filas.filter((f) => f.gastosB === 0 && f.b.v != null);
  console.log(`\n1.1 · filas con gastos comunes 0 después de corregir el m²: ${gastos0.length} (nuevos ${gastos0.filter((f) => f.cond === "nuevo").length}, usados ${gastos0.filter((f) => f.cond === "usado").length})`);

  // ── 1.2 · el premio por comuna ──
  const premioDe = (comuna: string): number => {
    const c = premio.porComuna.find((p) => p.comuna === comuna);
    return c && c.nCelda >= MIN_N_COMUNA && c.premioCelda != null ? c.premioCelda : premio.premioGranSantiago;
  };
  const conTope = (p: number) => Math.max(0, Math.min(TOPE, p));

  // Las filas de los nuevos, para volver a correr el motor.
  const sb = cliente();
  const filasNuevos = await universoActivo(sb, { condicion: "nuevo" });
  const resultados = new Map<string, Record<Escenario, Cuenta>>();
  let i = 0;
  for (const f of filasNuevos) {
    const b = porId.get(f.aviso_id);
    if (!b || !f.arriendo) continue;
    const clave = `${f.comuna}|${f.condicion}|${Number(f.sp.dormitorios)}|${Number(f.sp.superficie_m2)}`;
    const opts = b.sup0 ? { ctxPatch: { ggccSugerido: null }, medianaComuna: celdas[clave] ?? null } : {};
    const correr = (arriendo: number): Cuenta => {
      const r = b.sup0 ? conSuperficieDosDecimales(() => evaluarConMotor(f, cfg, 20, { ...opts, arriendo })) : evaluarConMotor(f, cfg, 20, { ...opts, arriendo });
      return r ? { v: r.veredicto, s: r.score, f: r.flujo } : { v: null, s: null, f: null };
    };
    const radio = f.arriendo.radioMonto;
    const p = premioDe(f.comuna);
    resultados.set(f.aviso_id, {
      guardado: b.guardado, a: b.a, b: b.b,
      premio: correr(Math.round(radio * (1 + p))),
      premioTope: correr(Math.round(radio * (1 + conTope(p)))),
    });
    if (++i % 500 === 0) console.log(`  nuevos ${fmt(i)} / ${fmt(filasNuevos.length)}`);
  }
  // Control: con el 3 % de hoy el motor da 0b (mismos insumos). Se verifica sobre 200 filas.
  let control = 0, controlOk = 0;
  for (const f of filasNuevos.slice(0, 200)) {
    const b = porId.get(f.aviso_id); if (!b || !f.arriendo) continue;
    const clave = `${f.comuna}|${f.condicion}|${Number(f.sp.dormitorios)}|${Number(f.sp.superficie_m2)}`;
    const opts = b.sup0 ? { ctxPatch: { ggccSugerido: null }, medianaComuna: celdas[clave] ?? null } : {};
    const arriendo = Math.round(f.arriendo.radioMonto * (1 + PREMIO_HOY));
    const r = b.sup0 ? conSuperficieDosDecimales(() => evaluarConMotor(f, cfg, 20, { ...opts, arriendo })) : evaluarConMotor(f, cfg, 20, { ...opts, arriendo });
    control++; if (r && r.veredicto === b.b.v && r.score === b.b.s && r.flujo === b.b.f) controlOk++;
  }
  console.log(`control: el 3 % de hoy reproduce 0b en ${controlOk} de ${control} nuevos`);

  // ── La tabla de salida de la fase ──
  const escenarios: Escenario[] = ["guardado", "a", "b", "premio", "premioTope"];
  const cuenta = (f: FilaBase, e: Escenario): Cuenta => (f.cond === "nuevo" ? resultados.get(f.id)?.[e] ?? f.b : e === "guardado" ? f.guardado : e === "a" ? f.a : f.b);
  const filasTabla = escenarios.map((e) => {
    const nC = nuevos.filter((f) => cuenta(f, e).v === "COMPRAR");
    const uC = usados.filter((f) => cuenta(f, e).v === "COMPRAR");
    const pierden = usados.filter((f) => f.b.v === "COMPRAR" && cuenta(f, e).v !== "COMPRAR").length;
    const ganan = usados.filter((f) => f.b.v !== "COMPRAR" && cuenta(f, e).v === "COMPRAR").length;
    const nPierden = nuevos.filter((f) => f.b.v === "COMPRAR" && cuenta(f, e).v !== "COMPRAR").length;
    const nGanan = nuevos.filter((f) => f.b.v !== "COMPRAR" && cuenta(f, e).v === "COMPRAR").length;
    return [NOMBRES[e], `${nC.length} (${pct(nC.length, nuevos.length)})`, nC.filter((f) => f.entrega === "inmediata").length, nC.filter((f) => f.entrega === "futura").length,
      nuevos.filter((f) => cuenta(f, e).v === "AJUSTA SUPUESTOS").length, `${uC.length} (${pct(uC.length, usados.length)})`, e === "b" ? "—" : `−${pierden} / +${ganan}`, e === "b" ? "—" : `−${nPierden} / +${nGanan}`];
  });
  console.log(`\nTabla de salida (pie 20 %, 30 años, universo limpio: nuevos ${fmt(nuevos.length)}, usados ${fmt(usados.length)}; pierden/ganan contra 0b)`);
  console.log(tablaMd(["escenario", "nuevos Comprar", "inmediata", "futura", "nuevos Ajustar", "usados Comprar", "usados −/+ Comprar", "nuevos −/+ Comprar"], filasTabla));

  // Cuántos cambian SOLO por la superficie (0a → 0b): los 36 nuevos y los usados Comprar de hoy.
  const nuevosGuardadoC = nuevos.filter((f) => f.guardado.v === "COMPRAR");
  const usadosGuardadoC = usados.filter((f) => f.guardado.v === "COMPRAR");
  console.log(`\nSolo por la superficie (0a → 0b): de los ${nuevosGuardadoC.length} nuevos Comprar de hoy, ${nuevosGuardadoC.filter((f) => f.a.v === "COMPRAR" && f.b.v !== "COMPRAR").length} dejan de ser Comprar en 0b (y ${nuevosGuardadoC.filter((f) => f.a.v !== "COMPRAR").length} ya lo dejan en 0a por UF/tasa); de los ${fmt(usadosGuardadoC.length)} usados Comprar, ${usadosGuardadoC.filter((f) => f.a.v === "COMPRAR" && f.b.v !== "COMPRAR").length} dejan de serlo en 0b y ${usados.filter((f) => f.a.v !== "COMPRAR" && f.b.v === "COMPRAR").length} entran.`);
  console.log(`UF y tasa de hoy (guardado → 0a): nuevos Comprar ${nuevosGuardadoC.length} → ${nuevos.filter((f) => f.a.v === "COMPRAR").length}; usados ${fmt(usadosGuardadoC.length)} → ${fmt(usados.filter((f) => f.a.v === "COMPRAR").length)}`);

  // Los 36 Comprar nuevos de hoy en «juntas».
  console.log(`\nLos ${nuevosGuardadoC.length} nuevos Comprar de hoy en juntas (1.2b):`);
  console.log(tablaMd(["aviso", "comuna", "entrega", "m²", "sup. 0", "guardado", "0a", "0b", "juntas"], nuevosGuardadoC.map((f) => {
    const r = resultados.get(f.id);
    return [f.id.slice(0, 8), f.comuna, f.entrega, f.m2, f.sup0 ? "sí" : "no", `${f.guardado.s}`, `${f.a.v} ${f.a.s}`, `${f.b.v} ${f.b.s}`, `${r?.premioTope.v} ${r?.premioTope.s}`];
  })));

  // Juntas por comuna.
  const comunas = [...new Set(nuevos.map((f) => f.comuna))].sort((p, q) => nuevos.filter((f) => f.comuna === q).length - nuevos.filter((f) => f.comuna === p).length);
  console.log("\nJuntas (1.2b) por comuna, nuevos:");
  console.log(tablaMd(["comuna", "nuevos", "Comprar hoy", "Comprar 0b", "Comprar juntas", "% juntas", "premio usado"], comunas.map((c) => {
    const xs = nuevos.filter((f) => f.comuna === c);
    const j = xs.filter((f) => cuenta(f, "premioTope").v === "COMPRAR").length;
    return [c, xs.length, xs.filter((f) => f.guardado.v === "COMPRAR").length, xs.filter((f) => f.b.v === "COMPRAR").length, j, pct(j, xs.length), fmt(conTope(premioDe(c)) * 100, 1) + " %"];
  })));

  // ── 1.3 · la mediana comunal del universo nuevo, después de corregir el m² ──
  const conCelda = nuevos.filter((f) => f.mediana.n >= 15 && f.mediana.mediana != null);
  const brazoPrecio = nuevos.filter((f) => f.gate1.sobreprecioComunalConFlujo);
  const sobre10 = nuevos.filter((f) => f.desvPct != null && f.desvPct > 10);
  console.log(`\n1.3 · nuevos con mediana comunal de universo nuevo (n ≥ 15): ${conCelda.length} de ${nuevos.length} (sin celda: ${nuevos.length - conCelda.length}; universo guardado «nuevo»: ${nuevos.filter((f) => f.mediana.universo === "nuevo").length})`);
  console.log(`      sobre la mediana en más de 10 %: ${sobre10.length}; de ellos con flujo negativo (brazo de sobreprecio del GATE 1 activo): ${brazoPrecio.length}; Buscar otra en 0b con ese brazo como único brazo del GATE 1: ${nuevos.filter((f) => f.gate1.sobreprecioComunalConFlujo && !f.gate1.cocSevero && !f.gate1.breakEvenImposible && !f.gate1.flujoSevero).length}`);
  console.log(`      GATE 1 por otros brazos en 0b: CoC severo ${nuevos.filter((f) => f.gate1.cocSevero).length} · break-even imposible ${nuevos.filter((f) => f.gate1.breakEvenImposible).length} · flujo severo ${nuevos.filter((f) => f.gate1.flujoSevero).length}`);
  const desv = nuevos.filter((f) => f.desvPct != null).map((f) => f.desvPct!).sort((p, q) => p - q);
  console.log(`      desviación sobre la mediana (nuevos con celda): mediana ${fmt(desv[Math.floor(desv.length / 2)] ?? NaN, 1)} % · p25 ${fmt(desv[Math.floor(desv.length * 0.25)] ?? NaN, 1)} % · p75 ${fmt(desv[Math.floor(desv.length * 0.75)] ?? NaN, 1)} %`);
  const nivelB = (f: FilaBase) => f.mediana.nivelCap ?? "—";
  const niveles = ["celda", "comuna", "bdo", "nacional"];
  console.log(`      cap de referencia en 0b (nuevos): ${niveles.map((n) => `${n} ${nuevos.filter((f) => nivelB(f) === n).length}`).join(" · ")}`);

  // ── Cap de referencia con la celda combinada usado + nuevo, solo para los que siguen en bdo/nacional ──
  const restantes = nuevos.filter((f) => nivelB(f) === "bdo" || nivelB(f) === "nacional");
  const celdasRest = new Map<string, FilaBase[]>();
  for (const f of restantes) { const k = `${f.comuna}|${f.dorms}|${f.m2}`; celdasRest.set(k, [...(celdasRest.get(k) ?? []), f]); }
  console.log(`\nCap de referencia · nuevos que siguen en bdo/nacional en 0b: ${restantes.length} (${celdasRest.size} celdas). Con la celda combinada usado + nuevo (mismas ventanas y mínimos, capref-comuna.ts):`);
  let siguenBdo = 0, pasanCelda = 0, pasanComuna = 0;
  for (const [, xs] of celdasRest) {
    const f = xs[0];
    const celda: CeldaCapRef = construirCeldaCapRef({ comuna: f.comuna, superficie: f.m2, dormitorios: f.dorms, esNuevo: true });
    const muestras: Record<string, MuestraCapRef> = {};
    for (const paso of CASCADA_CAPREF) muestras[`${paso.nivel}-${paso.ventana}`] = await muestraCombinada(sb, celda, paso, cfg.uf);
    let nArr = 0, nVta = 0, r = null as ReturnType<typeof evaluarPeldanoCapRef>;
    for (const paso of CASCADA_CAPREF) {
      const m = muestras[`${paso.nivel}-${paso.ventana}`];
      nArr = Math.max(nArr, m.arriendoUFm2Mes.length); nVta = Math.max(nVta, m.ventaUFm2.length);
      r = evaluarPeldanoCapRef(paso, m, celda, new Date().toISOString());
      if (r) break;
    }
    const nivel = (r ?? capRefSinAvisos(celda, new Date().toISOString(), { nArriendo: nArr, nVenta: nVta })).nivel;
    if (nivel === "celda") pasanCelda += xs.length; else if (nivel === "comuna") pasanComuna += xs.length; else siguenBdo += xs.length;
    await new Promise((res) => setTimeout(res, 100));
  }
  console.log(`      pasan a celda ${pasanCelda} · pasan a comuna ${pasanComuna} · siguen en bdo/nacional ${siguenBdo}`);

  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  writeFileSync("scripts/analisis/motor-nuevos/out/3-escenarios.json", JSON.stringify({ cfg, calculadoAt: new Date().toISOString(), premioPorComuna: Object.fromEntries(comunas.map((c) => [c, premioDe(c)])), resultados: Object.fromEntries(resultados) }));
}

/** La muestra de un peldaño con el universo de VENTA combinado (usado + nuevo); el arriendo igual que hoy (usado). Es la
 *  misma consulta de capref-comuna-query.ts › traer, con la condición de venta abierta. */
async function muestraCombinada(sb: ReturnType<typeof cliente>, celda: CeldaCapRef, paso: { nivel: "celda" | "comuna"; ventana: number }, uf: number): Promise<MuestraCapRef> {
  const desde = new Date(Date.now() - paso.ventana * 864e5).toISOString();
  type Fila = { precio: unknown; moneda: unknown; superficie_m2: unknown; dormitorios: unknown; condicion: unknown; source_id: unknown };
  const traer = async (lado: "venta" | "arriendo"): Promise<Fila[]> => paginar<Fila>((a, b) => {
    let q = sb.from("scraped_properties").select("precio, moneda, superficie_m2, dormitorios, condicion, source_id")
      .eq("comuna", celda.comuna).eq("type", lado).eq("is_active", true).gte("scraped_at", desde).gt("precio", 0)
      .gte("superficie_m2", celda.supMin).lte("superficie_m2", celda.supMax).order("id", { ascending: true }).range(a, b);
    if (lado === "arriendo") q = q.or("condicion.is.null,condicion.eq.usado");
    if (paso.nivel === "celda" && celda.dormitorios !== null && lado === "arriendo") q = q.eq("dormitorios", celda.dormitorios);
    return q;
  });
  const [arr, vta] = await Promise.all([traer("arriendo"), traer("venta")]);
  // En la venta combinada: los usados con dormitorios exactos en el peldaño celda; las unidades nuevas por tipología de fila.
  const vtaFiltrada = paso.nivel === "celda" && celda.dormitorios !== null
    ? filtrarTipologiaObraNueva(vta.filter((r) => r.condicion === "nuevo"), celda.dormitorios).concat(vta.filter((r) => r.condicion !== "nuevo" && Number(r.dormitorios) === celda.dormitorios))
    : vta;
  const aUF = (rs: Fila[]) => rs.map((r) => { const s = Number(r.superficie_m2), p = Number(r.precio); return s > 0 && p > 0 ? (r.moneda === "UF" ? p : p / uf) / s : NaN; }).filter(Number.isFinite);
  return { arriendoUFm2Mes: aUF(arr), ventaUFm2: aUF(vtaFiltrada) };
}
void PAGINA_POSTGREST;

main().catch((e) => { console.error(e); process.exit(1); });
