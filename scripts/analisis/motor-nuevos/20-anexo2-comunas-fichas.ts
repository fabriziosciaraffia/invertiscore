// ─────────────────────────────────────────────────────────────────────────────
// ANEXO 2 · UNA TABLA Y OCHO FICHAS MÁS (09-nov-2026), sobre los vectores de la salida por ingreso ya calculados
// (out/18-salida-ingreso.json, out/18-golden.json). Solo lectura: nada se escribe en la base.
//   1 · Tabla por comuna, escenario base (g 3 %, cap de hoy), nuevos y usados por separado, ordenada por avisos nuevos.
//   2 · Ocho fichas de casos reales, cada una el aviso más cercano a la mediana de su grupo (nunca el mejor ni el peor). La
//       selección y las seis TIR salen de los vectores guardados; el desglose de la ficha (pie y costos, cuotas, saldo, lo
//       que recibes, suma de flujos, ganancia, múltiplo) no quedó guardado, así que para esos ocho se corre la MISMA cadena
//       de la corrida 18 (misma UF, misma tasa, mismo «hoy» congelado en el instante de esa corrida) y se exige que las seis
//       TIR calcen con las guardadas.
// Salida: out/20-fichas.json.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { conHoyCongelado, conSuperficieDosDecimales, evaluarConMotor, fmt, mediana, cuantil, pct, tablaMd, universoActivo, type Config, type FilaUniverso, type ResultadoMotor } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { evalGate1Brazos, runAnalysis } from "../../../src/lib/analysis";
import { readVeredicto } from "../../../src/lib/results-helpers";
import { medianaDesdeSnapshot } from "../../../src/lib/analysis/mediana-snapshot";
import { ufDelDia } from "./uf-historica";
import { ESCENARIOS, ROTULO, exitValorMercado, proyeccionConG, salidasPorIngreso, type Cap, type Escenario, type FilaIngreso } from "./18-salida-ingreso";
import type { FilaBase } from "./1-base-corregida";
import type { FilaCompleta } from "./6-universo-completo";
import type { FilaFase4 } from "./11-fase4";
import type { AnalisisInput } from "../../../src/lib/types";

const DIR = "scripts/analisis/motor-nuevos/out";
const HORIZONTE = 10;
const VARA = -0.05;
const TOL = -200000;
const GOLDEN_ID = "17b4e10d-2afd-4554-b914-fe731ee2c9a0";
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };

const med = (xs: (number | null | undefined)[]) => mediana(xs.filter((x): x is number => x != null && Number.isFinite(x)));
const pf = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? "—" : fmt(x * 100, d) + " %");
const tirTxt = (x: number | null | undefined) => (x == null ? "—" : fmt(x, 1) + " %");
/** Las métricas del exit vienen como número crudo o como `{ tipo: "valor", valor }`. */
const valorMetrica = (t: unknown): number | null => (typeof t === "number" ? t : t && typeof t === "object" && (t as { tipo?: string }).tipo === "valor" ? Number((t as { valor: number }).valor) : null);
/** En una ficha el cap existe: una TIR nula es una TIR sin raíz (la venta no devuelve lo puesto). */
const tirFicha = (x: number | null | undefined) => (x == null ? "no calculable (la venta no devuelve lo puesto)" : fmt(x, 1) + " %");
/** Flujo en % del arriendo (ingreso mensual del motor). */
const relFlujo = (f: FilaIngreso) => (f.flujo != null && f.ingreso != null && f.ingreso > 0 ? f.flujo / f.ingreso : null);
const enVara = (f: FilaIngreso) => { const r = relFlujo(f); return r != null && r >= VARA; };
const enBanda = (f: FilaIngreso) => { const r = relFlujo(f); return r != null && r < VARA && f.flujo! >= TOL; };
const tir5 = (f: FilaIngreso) => (f.tir.g3h ?? -Infinity) >= 5;
const premioPct = (f: FilaIngreso) => (f.valorIngresoHoyUF != null ? (f.precioUF - f.valorIngresoHoyUF) / f.precioUF : null);
const premioUF = (f: FilaIngreso) => (f.valorIngresoHoyUF != null ? f.precioUF - f.valorIngresoHoyUF : null);

/** El aviso más cercano a la mediana de `x` dentro del grupo (empate: el id menor). */
function masCercanoAMediana(grupo: FilaIngreso[], x: (f: FilaIngreso) => number | null | undefined): { fila: FilaIngreso; mediana: number; n: number } | null {
  const con = grupo.filter((f) => { const v = x(f); return v != null && Number.isFinite(v); });
  if (!con.length) return null;
  const m = med(con.map(x))!;
  const fila = [...con].sort((p, q) => Math.abs(x(p)! - m) - Math.abs(x(q)! - m) || p.id.localeCompare(q.id))[0];
  return { fila, mediana: m, n: con.length };
}

function camino(v: string | null, score: number | null, m: ResultadoMotor["resultado"]["metrics"], breakEven: number): string {
  const s = score ?? 0;
  const g3 = m.flujoNetoMensual >= 0 && m.rentabilidadNeta >= 4 && (m.plusvaliaInmediataFrancoPct ?? 0) >= 0;
  if (v === "COMPRAR") return s >= 70 ? (g3 ? "por puntaje (≥ 70), y además se paga sola" : "por puntaje (≥ 70), sin pagarse sola") : "se paga sola (gate 3: flujo ≥ 0, neta ≥ 4 %, sin sobreprecio), con puntaje bajo 70";
  if (v === "AJUSTA SUPUESTOS") return s >= 70 ? "el puntaje daba Comprar y el gate 2 lo bajó" : "por puntaje (45 a 69)";
  const b = evalGate1Brazos(m, breakEven);
  const brazos = [b.cocSevero && "CoC severo", b.breakEvenImposible && "break-even imposible", b.sobreprecioComunalConFlujo && "sobreprecio con flujo negativo", b.flujoSevero && "flujo severo"].filter(Boolean).join(", ");
  return brazos ? `gate 1 (${brazos})` : "por puntaje (bajo 45)";
}

interface Ficha {
  letra: string; titulo: string; criterio: string; grupoN: number; medianaGrupo: string;
  id: string; comuna: string; condicion: string; dorms: number; banos: number | null; m2: number; precioUF: number; uf: number;
  arriendoCLP: number; flujoCLP: number; flujoPct: number | null;
  pieCLP: number; costosCLP: number; inversionInicialCLP: number;
  cuotas: { n: number; montoCLP: number; mesesAntes: number; alFirmarCLP: number } | null;
  v: string | null; score: number | null; camino: string;
  capEntrada: number; cap: Cap;
  salidaIngresoCLP: number | null; salidaMotorCLP: number; saldoCLP: number; recibesCLP: number; sumaFlujosCLP: number; cuotasPieCLP: number;
  gananciaCLP: number; multiplo: number | null; tirMotor: number | null;
  tir: Partial<Record<Escenario, number | null>>; control: string;
}

function ficha(letra: string, titulo: string, criterio: string, sel: { n: number; mediana: string }, r: ResultadoMotor, cfg: Config, asOf: Date, cap: Cap, guardadas: Partial<Record<Escenario, number | null>>, extra: { id: string; comuna: string; condicion: string; dorms: number; banos: number | null; m2: number }): Ficha {
  const input = r.body as unknown as AnalisisInput;
  const m = r.resultado.metrics;
  const s = salidasPorIngreso(r, cfg, asOf, cap.cap);
  const dif = ESCENARIOS.map((e) => (s.tir[e] == null && guardadas[e] == null ? 0 : Math.abs((s.tir[e] ?? NaN) - (guardadas[e] ?? NaN))));
  const control = dif.every((d) => d < 0.011) ? "las seis TIR calzan con las guardadas" : `NO CALZA: diferencias ${dif.map((d) => fmt(d, 2)).join(" / ")}`;
  const proj = proyeccionConG(input, r, cfg, asOf, 0.03);
  const valor = cap.cap != null ? (proj[HORIZONTE].arriendoMensual * 12) / (cap.cap / 100) : null;
  const e = valor != null ? exitValorMercado(input, r, proj, valor) : r.resultado.exitScenario;
  const pc = m.pieEnCuotas;
  const cuotas = pc && pc.cuotas > 1 ? { n: pc.cuotas, montoCLP: Math.round(pc.montoCuotaCLP), mesesAntes: pc.mesesAntesEntrega ?? 0, alFirmarCLP: Math.round(e.inversionInicial - m.pieCLP + pc.montoCuotaCLP) } : null;
  const sumaFlujos = proj.slice(0, HORIZONTE).reduce((a, p) => a + p.flujoAnual, 0);
  const uf = cfg.uf;
  return {
    letra, titulo, criterio, grupoN: sel.n, medianaGrupo: sel.mediana, ...extra, precioUF: input.precio, uf,
    arriendoCLP: Math.round(m.ingresoMensual), flujoCLP: Math.round(m.flujoNetoMensual), flujoPct: m.ingresoMensual > 0 ? m.flujoNetoMensual / m.ingresoMensual : null,
    pieCLP: Math.round(m.pieCLP), costosCLP: Math.round(e.inversionInicial - m.pieCLP), inversionInicialCLP: Math.round(e.inversionInicial), cuotas,
    v: r.veredicto, score: r.score, camino: camino(r.veredicto, r.score, m, r.resultado.breakEvenTasa),
    capEntrada: m.rentabilidadBruta, cap,
    salidaIngresoCLP: valor != null ? Math.round(valor) : null, salidaMotorCLP: Math.round(r.resultado.exitScenario.precioVentaEsperado),
    saldoCLP: Math.round(e.saldoCredito), recibesCLP: Math.round(e.equityCLP), sumaFlujosCLP: Math.round(sumaFlujos), cuotasPieCLP: cuotas ? Math.round(m.pieCLP) : 0,
    gananciaCLP: Math.round(e.gananciaSobreTotal), multiplo: valorMetrica(e.multiplicadorCapital), tirMotor: valorMetrica(r.resultado.exitScenario.tir),
    tir: s.tir, control,
  };
}

const pesosUF = (clp: number, uf: number) => `$${fmt(clp)} · UF ${fmt(clp / uf, clp / uf < 100 ? 1 : 0)}`;
function fichaMd(f: Ficha): string {
  const uf = f.uf;
  const filas: (string | number)[][] = [
    ["aviso", `${f.id.slice(0, 8)} · ${f.comuna} · ${f.condicion}`],
    ["tipología y superficie", `${f.dorms}D${f.banos ? ` ${f.banos}B` : ""} · ${fmt(f.m2, f.m2 % 1 ? 1 : 0)} m²`],
    ["precio", `UF ${fmt(f.precioUF)} · $${fmt(f.precioUF * uf)} · UF ${fmt(f.precioUF / f.m2, 1)}/m² · $${fmt((f.precioUF * uf) / f.m2)}/m²`],
    ["arriendo estimado (mensual)", pesosUF(f.arriendoCLP, uf)],
    ["flujo mensual", `${pesosUF(f.flujoCLP, uf)} · ${pf(f.flujoPct)} del arriendo`],
    ["lo que pones hoy (pie + costos)", `${pesosUF(f.inversionInicialCLP, uf)} (pie ${pesosUF(f.pieCLP, uf)} + costos ${pesosUF(f.costosCLP, uf)})`],
    ...(f.cuotas ? [["pie en cuotas (entrega futura)", `al firmar ${pesosUF(f.cuotas.alFirmarCLP, uf)} (costos + primera cuota); ${f.cuotas.n} cuotas de ${pesosUF(f.cuotas.montoCLP, uf)} al mes; ${f.cuotas.mesesAntes} meses hasta la entrega`]] : []),
    ["veredicto de hoy", `${f.v} · score ${f.score} · ${f.camino}`],
    ["cap de entrada (arriendo bruto anual ÷ precio)", pf(f.capEntrada / 100, 2)],
    ["cap de salida (celda, usado)", `${fmt(f.cap.cap, 2)} % (${f.cap.nivel === "comuna" ? "respaldo de la comuna" : "comuna × dormitorios"}; ${f.cap.nArr} arriendos / ${f.cap.nVenta} ventas)`],
    ["valor de salida al año 10", `por ingreso (g 3 %, cap de hoy) ${f.salidaIngresoCLP != null ? pesosUF(f.salidaIngresoCLP, uf) : "—"} · el que supone el motor ${pesosUF(f.salidaMotorCLP, uf)}`],
    ["saldo del crédito al año 10", pesosUF(f.saldoCLP, uf)],
    ["lo que recibes al vender (venta − comisión − saldo)", pesosUF(f.recibesCLP, uf)],
    ["suma de los flujos de los 10 años (g 3 %)", `${pesosUF(f.sumaFlujosCLP, uf)}${f.cuotas ? ` (aparte, las cuotas del pie: ${pesosUF(f.cuotasPieCLP, uf)})` : ""}`],
    ["ganancia total y múltiplo (definición del informe)", `${pesosUF(f.gananciaCLP, uf)} · múltiplo ${fmt(f.multiplo, 2)}×`],
    ["TIR del motor (salida del motor)", tirFicha(f.tirMotor)],
    ...ESCENARIOS.map((e) => [`TIR por ingreso, ${ROTULO[e]}`, tirFicha(f.tir[e])]),
  ];
  return `**(${f.letra}) ${f.titulo}** — ${f.criterio} (grupo de ${fmt(f.grupoN)}; mediana del grupo ${f.medianaGrupo}). Control: ${f.control}.\n\n${tablaMd(["dato", "valor"], filas)}`;
}

async function main() {
  const { filas, cfg } = JSON.parse(readFileSync(`${DIR}/18-salida-ingreso.json`, "utf8")) as { cfg: Config; filas: FilaIngreso[] };
  const nuevos = filas.filter((f) => f.cond === "nuevo"), usados = filas.filter((f) => f.cond === "usado");
  const nNuevos = (c: string) => nuevos.filter((f) => f.comuna === c).length;
  const comunas = [...new Set(filas.map((f) => f.comuna))].sort((p, q) => nNuevos(q) - nNuevos(p) || usados.filter((f) => f.comuna === q).length - usados.filter((f) => f.comuna === p).length);

  // 1 · La tabla por comuna.
  for (const [u, xs] of [["nuevos", nuevos], ["usados", usados]] as Array<[string, FilaIngreso[]]>) {
    const grupos: Array<[string, FilaIngreso[]]> = [["Gran Santiago", xs], ...comunas.map((c) => [c, xs.filter((f) => f.comuna === c)] as [string, FilaIngreso[]]).filter(([, g]) => g.length > 0)];
    console.log(`\n1 · Por comuna, ${u}, escenario base (g 3 %, cap de hoy), ordenada por avisos nuevos:`);
    console.log(tablaMd(["comuna", "avisos", "Comprar de hoy (con flujo < 0)", "cap de salida (mediana)", "premio de estreno % (mediana)", "premio UF (mediana)", "flujo mensual mediano", "flujo % del arriendo (mediana)", "TIR por ingreso (mediana)", "TIR del motor (mediana)", "TIR ≥ 5 % dentro de la vara", "TIR ≥ 5 % entre −5 % y −$200.000"], grupos.map(([c, g]) => {
      const comp = g.filter((f) => f.v === "COMPRAR");
      return [c, fmt(g.length), `${fmt(comp.length)} (${fmt(comp.filter((f) => f.flujo != null && f.flujo < 0).length)})`, fmt(med(g.map((f) => f.cap.cap)), 2), pf(med(g.map(premioPct))), fmt(med(g.map(premioUF))), `$${fmt(med(g.map((f) => f.flujo)))}`, pf(med(g.map(relFlujo))), tirTxt(med(g.map((f) => f.tir.g3h))), tirTxt(med(g.map((f) => f.tirMotor))), pct(g.filter((f) => tir5(f) && enVara(f)).length, g.length), pct(g.filter((f) => tir5(f) && enBanda(f)).length, g.length)];
    })));
  }

  // 2 · Los grupos y el elegido de cada uno.
  const f4 = new Map((JSON.parse(readFileSync(`${DIR}/11-fase4.json`, "utf8")) as { filas: FilaFase4[] }).filas.map((f) => [f.id, f]));
  const conTir = (f: FilaIngreso) => f.tir.g3h != null && f.cap.cap != null;
  const uCompNeg = usados.filter((f) => conTir(f) && f.v === "COMPRAR" && f.flujo != null && f.flujo < 0);
  const p10 = cuantil(uCompNeg.map((f) => f.flujo!), 0.1)!;
  const dTipo = (f: FilaIngreso) => conTir(f) && f.cond === "nuevo" && f.comuna === "Santiago" && tir5(f) && enBanda(f);
  const conCuotas = (f: FilaIngreso) => !!f4.get(f.id)?.base.cuotas;
  const eSantiago = nuevos.filter((f) => dTipo(f) && f.entrega === "futura" && conCuotas(f));
  const eGrupo = eSantiago.length >= 5 ? eSantiago : nuevos.filter((f) => conTir(f) && tir5(f) && enBanda(f) && f.entrega === "futura" && conCuotas(f));
  const medUsados = med(usados.map((f) => f.tir.g3h))!;
  const defs: Array<{ letra: string; titulo: string; criterio: string; grupo: FilaIngreso[]; x: (f: FilaIngreso) => number | null | undefined; fmtMed: (m: number) => string }> = [
    { letra: "a", titulo: "Usado Comprar de hoy con flujo negativo típico", criterio: "usados Comprar de hoy con flujo < 0, el más cercano a la mediana del flujo", grupo: uCompNeg, x: (f) => f.flujo, fmtMed: (m) => `flujo $${fmt(m)}` },
    { letra: "b", titulo: "Usado Comprar de hoy con el flujo negativo más grande", criterio: `usados Comprar de hoy en el decil de flujo más negativo (flujo ≤ $${fmt(p10)}), el más cercano a la mediana de ese decil`, grupo: uCompNeg.filter((f) => f.flujo! <= p10), x: (f) => f.flujo, fmtMed: (m) => `flujo $${fmt(m)}` },
    { letra: "c", titulo: "Nuevo Comprar de hoy con flujo negativo", criterio: "nuevos Comprar de hoy con flujo < 0, el más cercano a la mediana del flujo", grupo: nuevos.filter((f) => conTir(f) && f.v === "COMPRAR" && f.flujo != null && f.flujo < 0), x: (f) => f.flujo, fmtMed: (m) => `flujo $${fmt(m)}` },
    { letra: "d", titulo: "Nuevo de Santiago centro, entrega inmediata, con TIR ≥ 5 % y flujo entre −5 % del arriendo y −$200.000", criterio: "nuevos de la comuna de Santiago, entrega inmediata, TIR base ≥ 5 % y flujo en esa banda, el más cercano a la mediana de la TIR base", grupo: nuevos.filter((f) => dTipo(f) && f.entrega === "inmediata"), x: (f) => f.tir.g3h, fmtMed: (m) => `TIR ${fmt(m, 1)} %` },
    { letra: "e", titulo: `El mismo tipo con entrega futura y pie en cuotas${eGrupo === eSantiago ? ", Santiago centro" : " (Gran Santiago: Santiago centro tiene " + eSantiago.length + ")"}`, criterio: `nuevos ${eGrupo === eSantiago ? "de la comuna de Santiago" : "de todas las comunas"}, entrega futura con pie en cuotas, TIR base ≥ 5 % y flujo en la banda, el más cercano a la mediana de la TIR base`, grupo: eGrupo, x: (f) => f.tir.g3h, fmtMed: (m) => `TIR ${fmt(m, 1)} %` },
    { letra: "f", titulo: "Nuevo típico de Santiago centro", criterio: "nuevos de la comuna de Santiago, el más cercano a la mediana de la TIR base de Santiago", grupo: nuevos.filter((f) => conTir(f) && f.comuna === "Santiago"), x: (f) => f.tir.g3h, fmtMed: (m) => `TIR ${fmt(m, 1)} %` },
    { letra: "g", titulo: "Usado comprado bajo su valor por ingreso", criterio: `usados con precio bajo su valor por ingreso de hoy y TIR base sobre la mediana de los usados (${fmt(medUsados, 1)} %), el más cercano a la mediana de la TIR de ese grupo`, grupo: usados.filter((f) => conTir(f) && f.valorIngresoHoyUF != null && f.valorIngresoHoyUF > f.precioUF && f.tir.g3h! > medUsados), x: (f) => f.tir.g3h, fmtMed: (m) => `TIR ${fmt(m, 1)} %` },
  ];
  const elegidos = defs.map((d) => ({ d, sel: masCercanoAMediana(d.grupo, d.x) }));
  for (const { d, sel } of elegidos) console.log(`(${d.letra}) grupo ${d.grupo.length} · ${sel ? `${sel.fila.id.slice(0, 8)} ${sel.fila.comuna} · ${d.fmtMed(sel.mediana)} · valor del elegido ${fmt(d.x(sel.fila), 1)}` : "sin candidatos"}`);
  const santiagoTir = nuevos.filter((f) => conTir(f) && f.comuna === "Santiago").map((f) => f.tir.g3h!).sort((a, b) => a - b);
  console.log(`(f) nota: la TIR base de 1,2 % es la mediana de los nuevos de Gran Santiago; en la comuna de Santiago queda en el percentil ${fmt((santiagoTir.filter((t) => t < 1.2).length / santiagoTir.length) * 100, 0)} (mediana de Santiago ${fmt(med(santiagoTir), 1)} %).`);

  // 3 · La misma cadena de la corrida 18 para los elegidos.
  const sb = createServiceClient();
  const asOfRun = new Date(readFileSync(`${DIR}/18-salida-ingreso.log`, "utf8").split("\n")[0].split("· ").pop()!.trim());
  const ids = elegidos.filter((e) => e.sel).map((e) => e.sel!.fila.id);
  const activas = await universoActivo(sb, { ids });
  const completo = JSON.parse(readFileSync(`${DIR}/6-universo-completo.json`, "utf8")) as { filas: FilaCompleta[] };
  const reactivadas: FilaUniverso[] = completo.filas.filter((f) => ids.includes(f.id)).map((f) => ({ ...(f.evaluacion as unknown as FilaUniverso), aviso_id: f.id, precio_uf: f.evaluacion.precio_uf, sp: f.sp }));
  const porId = new Map([...activas, ...reactivadas].map((f) => [f.aviso_id, f]));
  const base = new Map((JSON.parse(readFileSync(`${DIR}/1-base-corregida.json`, "utf8")) as { filas: FilaBase[] }).filas.map((f) => [f.id, f]));
  const celdas = JSON.parse(readFileSync(`${DIR}/1-medianas-celda.json`, "utf8")) as Record<string, unknown>;
  const fichas: Ficha[] = [];
  for (const { d, sel } of elegidos) {
    if (!sel) continue;
    const g = sel.fila, f = porId.get(g.id);
    if (!f) { console.log(`(${d.letra}) ${g.id}: no se pudo leer la fila (¿dejó de estar activa?)`); continue; }
    const b = base.get(f.aviso_id);
    const clave = `${f.comuna}|${f.condicion}|${Number(f.sp.dormitorios)}|${Number(f.sp.superficie_m2)}`;
    const opts = b?.sup0 ? { ctxPatch: { ggccSugerido: null }, medianaComuna: celdas[clave] ?? null } : {};
    const fi = conHoyCongelado(asOfRun, () => {
      const r = conSuperficieDosDecimales(() => evaluarConMotor(f, cfg, 20, opts));
      if (!r) return null;
      const cond = f.condicion === "nuevo" ? `nuevo, entrega ${g.entrega}${f.sp.fecha_entrega ? ` (${f.sp.fecha_entrega})` : ""}` : `usado, ${f.antiguedad_anios} años (${f.antiguedad_origen === "ficha" ? "según la ficha" : "supuestos"})`;
      return ficha(d.letra, d.titulo, d.criterio, { n: d.grupo.length, mediana: d.fmtMed(sel.mediana) }, r, cfg, asOfRun, g.cap, g.tir, { id: g.id, comuna: g.comuna, condicion: cond, dorms: g.dorms, banos: f.sp.banos, m2: g.m2 });
    });
    if (fi) fichas.push(fi);
  }

  // 4 · (h) El nuevo de Ñuñoa del golden, con su input guardado y la UF del día en que se creó (como en la corrida 18).
  const golden = JSON.parse(readFileSync(`${DIR}/18-golden.json`, "utf8")) as Record<string, { cap: Cap; tir: Partial<Record<Escenario, number | null>> }>;
  const { data } = await sb.from("analisis").select("id, comuna, created_at, input_data, mediana_comuna_snapshot, capref_comuna_snapshot").eq("id", GOLDEN_ID).single();
  if (data) {
    const input = data.input_data as AnalisisInput & { esNuevo?: boolean; dormitorios: number; banos?: number };
    const creado = new Date(data.created_at as string);
    const uf = Math.round(await ufDelDia(creado.toISOString().slice(0, 10)));
    const mediana = data.mediana_comuna_snapshot ? medianaDesdeSnapshot(data.mediana_comuna_snapshot as never, { capRefComuna: (data.capref_comuna_snapshot as never) ?? null }) : undefined;
    const res = runAnalysis(input, uf, mediana as never, creado);
    const r: ResultadoMotor = { veredicto: readVeredicto(res as never) ?? null, score: Math.round(res.score), flujo: Math.round(res.metrics.flujoNetoMensual), resultado: res, body: input as unknown as Record<string, unknown> };
    const gk = golden[GOLDEN_ID.slice(0, 8)];
    fichas.push(ficha("h", "El nuevo de Ñuñoa del Golden Set", "el análisis 17b4e10d tal como se creó (su input, su mediana guardada y la UF de ese día)", { n: 1, mediana: "—" }, r, { uf, tasa: Number(input.tasaMercado) || Number(input.tasaInteres) }, creado, gk.cap, gk.tir, { id: GOLDEN_ID, comuna: data.comuna as string, condicion: `nuevo (análisis del ${creado.toISOString().slice(0, 10)})`, dorms: input.dormitorios, banos: input.banos ?? null, m2: input.superficie }));
  }

  console.log("\n2 · Las fichas");
  for (const f of fichas) console.log(`\n${fichaMd(f)}`);
  mkdirSync(DIR, { recursive: true });
  writeFileSync(`${DIR}/20-fichas.json`, JSON.stringify({ asOfRun: asOfRun.toISOString(), fichas }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
