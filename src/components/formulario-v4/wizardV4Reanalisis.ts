// ─────────────────────────────────────────────────────────────────────────────
// EL INFORME DE VUELTA AL WIZARD (21-oct-2026, el re-análisis al precio recomendado, lib/reanalisis.ts). Del input
// guardado de un informe (`analisis.input_data`) a las respuestas del wizard, COMPLETAS —el depto y la persona—, para que
// el resumen muestre todo y la persona solo confirme. Es la inversa de `buildLtrPayload` / `buildStrPayload`
// (wizardV4Payload.ts): lo que el wizard estimó vuelve como estimado (el arriendo de la zona, las contribuciones del
// SII, los costos por defecto), para que se recalcule con el precio nuevo; lo que la persona escribió vuelve escrito.
// Después `conRecomendacion` pone el precio, el pie y el plazo de la recomendación.
// A diferencia de la precarga del pack (lib/lo-que-sigue/precarga.ts), acá el depto SÍ viaja: es el mismo depto.
// Puro y sin "use client": lo usa la ruta /api/analisis/reanalisis. Lo prueba el tier REANALISIS (ida y vuelta).
// ─────────────────────────────────────────────────────────────────────────────
import { getCostosDefault } from "@/lib/engines/short-term-engine";
import { origenConTasaSubsidio } from "@/lib/lo-que-sigue/precarga";
import { calcTasaConSubsidio } from "@/lib/constants/subsidio";
import type { PedidoReanalisis } from "@/lib/reanalisis";
import type { Antiguedad, NodeId, WizardV4Answers } from "./wizardV4Nodes";

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
/** Un número como lo escribe la persona en el wizard: coma decimal, con a lo más `dec` decimales. */
const coma = (n: number, dec = 2) => String(Number(n.toFixed(dec))).replace(".", ",");
const entero = (n: number) => String(Math.round(n));
const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** La inversa de `antiguedadToNumber` (helpers-wizard.ts): 1 → «0-2», 4 → «3-5», 8 → «6-10», 15 → «11-20», 25 → «20+». */
export function antiguedadDeAnios(n: number): Antiguedad {
  if (n <= 2) return "0-2";
  if (n <= 5) return "3-5";
  if (n <= 10) return "6-10";
  if (n <= 20) return "11-20";
  return "20+";
}

/** Las pantallas que el informe de origen ya respondió: el resumen las da por hechas. */
function completadas(a: WizardV4Answers): Partial<Record<NodeId, boolean>> {
  const c: Partial<Record<NodeId, boolean>> = { dir: true, tipo: true, tam: true, precio: true, pie: true, tasa: true, plazo: true, mod: true };
  if (a.tipoPropiedad === "nuevo") c.ent = true;
  else c.ant = true;
  if (a.modalidad === "str") c.adr = true;
  else c.arr = true;
  return c;
}

/** Del input guardado de un informe a las respuestas del wizard. `tipo` es `analisis.tipo_analisis`. */
export function respuestasDesdeInforme(input: Record<string, unknown> | null | undefined, tipo: "long-term" | "short-term" | string | null | undefined): { respuestas: WizardV4Answers; completadas: Partial<Record<NodeId, boolean>>; precioUF: number | null } {
  const i = input ?? {};
  const esStr = tipo === "short-term";
  const zona = (i.zonaRadio ?? {}) as Record<string, unknown>;
  const a: WizardV4Answers = { modalidad: esStr ? "str" : "ltr" };

  // ── El depto ──
  const dir = texto(i.direccion);
  if (dir) { a.direccion = dir; a.direccionConfirmada = dir; }
  const lat = num(esStr ? i.lat : zona.lat);
  const lng = num(esStr ? i.lng : zona.lng);
  if (lat !== null && lng !== null) { a.lat = lat; a.lng = lng; }
  if (i.ubicacionPrecision === "numero" || i.ubicacionPrecision === "calle" || i.ubicacionPrecision === "pin") a.ubicacionPrecision = i.ubicacionPrecision;
  a.comuna = texto(i.comuna);
  a.ciudad = texto(i.ciudad);
  const nuevo = esStr ? i.tipoPropiedad === "nuevo" : i.esNuevo === true;
  a.tipoPropiedad = nuevo ? "nuevo" : "usado";
  const ant = num(i.antiguedad);
  if (!nuevo) a.antiguedad = antiguedadDeAnios(ant ?? 5);
  if (nuevo) {
    a.estadoVenta = i.estadoVenta === "futura" ? "futura" : "inmediata";
    const fe = typeof i.fechaEntrega === "string" ? /^(\d{4})-(\d{1,2})$/.exec(i.fechaEntrega) : null;
    if (a.estadoVenta === "futura" && fe) { a.fechaEntregaAnio = fe[1]; a.fechaEntregaMes = fe[2].padStart(2, "0"); }
    const cuotas = num(i.cuotasPie);
    if (cuotas !== null && cuotas >= 1) a.cuotasPie = entero(cuotas);
  }
  const sup = num(esStr ? i.superficieUtil : i.superficie);
  if (sup !== null && sup > 0) a.superficieUtil = coma(sup, 1);
  const dorm = num(i.dormitorios);
  if (dorm !== null) { a.dormitorios = entero(dorm); a.esStudio = dorm === 0 || i.esStudio === true; }
  const banos = num(i.banos);
  if (banos !== null) a.banos = entero(banos);
  if (!esStr) {
    const est = num(i.cantidadEstacionamientos);
    if (est !== null) a.estacionamientos = entero(est);
    const bod = num(i.cantidadBodegas);
    if (bod !== null) a.bodegas = entero(bod);
  }
  const precio = num(esStr ? i.precioCompraUF : i.precio);
  if (precio !== null && precio > 0) a.precio = coma(precio, 2);

  // ── La persona (después la recomendación pone el pie y el plazo) ──
  const pie = num(i.piePct);
  if (pie !== null) { a.pieUnidad = "pct"; a.pieMonto = coma(pie, 2); }
  if (i.razonSinPie === "bono_pie" || i.razonSinPie === "otra_fuente" || i.razonSinPie === "no_declarada") a.pieRazon = i.razonSinPie;
  const plazo = num(i.plazoCredito);
  if (plazo === 20 || plazo === 25 || plazo === 30) a.plazoCredito = String(plazo) as WizardV4Answers["plazoCredito"];
  const tasa = num(i.tasaInteres);
  if (tasa !== null && tasa > 0) {
    a.tasaInteres = coma(tasa, 2);
    // Estimada si es la de mercado o la del subsidio (la del mismo depto: acá se conserva); si no, la que traía la persona.
    const mercado = num(i.tasaMercado);
    const cerca = (x: number | null) => x !== null && Math.abs(x - tasa) < 0.005;
    a.tasaModo = cerca(mercado) || (origenConTasaSubsidio(i, esStr ? "short-term" : "long-term") && mercado !== null && cerca(calcTasaConSubsidio(mercado))) ? "estimada" : "preaprobada";
  }

  // ── La renta ──
  const ggcc = num(esStr ? i.gastosComunes : i.gastos);
  if (ggcc !== null && ggcc > 0) a.gastosComunes = entero(ggcc);
  // Las contribuciones dependen del precio: si las estimó Franco, se vuelven a estimar.
  const contrib = num(i.contribuciones);
  if (i.contribucionesOrigen === "declarada" && contrib !== null && contrib > 0) a.contribuciones = entero(contrib);
  if (!esStr) {
    const arriendo = num(i.arriendo);
    if (arriendo !== null && arriendo > 0) {
      const promedio = num(zona.arriendoPromedio);
      a.arrModo = promedio !== null && Math.abs(promedio - arriendo) < 1 ? "estimacion" : "corregir";
      a.arriendo = entero(arriendo);
    }
    const vacMeses = num(i.vacanciaMeses);
    if (vacMeses !== null) {
      const pct = (vacMeses * 100) / 12;
      if (Math.abs(pct - 5) > 0.05) a.vacanciaPct = coma(pct, 1);
    }
    a.amoblado = i.amoblado === true ? "si" : "no";
    const com = num(i.comisionAdministrador);
    if (i.usaAdministrador === true && com !== null && com > 0) a.comisionAdminPct = coma(com, 1);
  } else {
    const hues = num(i.capacidadHuespedes);
    if (hues !== null && hues > 0) a.capacidadHuespedes = entero(hues);
    a.modoGestion = i.modoGestion === "administrador" ? "administrador" : "auto";
    const com = num(i.comisionAdministrador);
    if (a.modoGestion === "administrador" && com !== null && com > 0) a.comisionStrPct = coma(com * 100, 1);
    const adr = num(i.adrOverride);
    const occ = num(i.occOverride);
    if (adr !== null && adr > 0) {
      a.adrModo = "corregir";
      a.adrTarifa = entero(adr);
      if (occ !== null && occ > 0) a.adrOcupacion = coma(occ * 100, 1);
    } else {
      a.adrModo = "estimacion";
    }
    // Los costos que la persona cambió vuelven escritos; los de por defecto se vuelven a poner por defecto.
    const def = getCostosDefault(dorm ?? 1, "basico");
    const ops = ["costoElectricidad", "costoAgua", "costoWifi", "costoInsumos"].map((k) => num(i[k]));
    const total = ops.every((x) => x !== null) ? (ops as number[]).reduce((s, x) => s + x, 0) : null;
    const totalDef = def.costoElectricidad + def.costoAgua + def.costoWifi + def.costoInsumos;
    if (total !== null && Math.abs(total - totalDef) >= 1) a.costosOperativos = entero(total);
    const mant = num(i.mantencion);
    if (mant !== null && Math.abs(mant - def.mantencion) >= 1) a.mantencionStr = entero(mant);
    a.estaAmoblado = i.estaAmoblado === true;
    const amob = num(i.costoAmoblamiento);
    if (amob !== null && Math.abs(amob - def.costoAmoblamiento) >= 1) a.costoAmoblamiento = entero(amob);
  }
  return { respuestas: a, completadas: completadas(a), precioUF: precio };
}

/** El precio, el pie y el plazo de la recomendación de Franco, sobre las respuestas del informe de origen. Con pie cero,
 *  la razón del origen (o «no declarada»): el wizard no deja un pie cero sin ella. */
export function conRecomendacion(a: WizardV4Answers, p: Pick<PedidoReanalisis, "precioUF" | "piePct" | "plazoAnios">): WizardV4Answers {
  const r: WizardV4Answers = { ...a, precio: coma(p.precioUF, 2), pieUnidad: "pct", pieMonto: coma(p.piePct, 2), plazoCredito: String(p.plazoAnios) as WizardV4Answers["plazoCredito"] };
  if (p.piePct > 0) delete r.pieRazon;
  else r.pieRazon = a.pieRazon ?? "no_declarada";
  delete r.otraFuenteMonto;
  delete r.otraFuenteCredito;
  delete r.otraFuenteCuota;
  return r;
}
