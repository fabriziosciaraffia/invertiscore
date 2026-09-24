// ─────────────────────────────────────────────────────────────────────────────
// Ficha del depto evaluado — builder puro (forma A, 24-sep-2026).
//
// Contrato: mockup `docs/wireframes/rediseno-informe/ficha-depto.html`, forma A aprobada por
// Fabrizio. Lista agrupada de rótulo y valor, secciones cortas, SIN prosa y DE SOLO LECTURA: la
// ficha muestra tus datos y no ofrece editarlos (el «ajústalos» de la versión anterior era un
// link a una acción que no existe como producto).
//
// La procedencia va en una etiqueta de UNA palabra junto al valor:
//   · «sugerido» — el arriendo es la mediana que propuso el wizard y no se cambió
//     (`resolverProcedenciaArriendo`: igualdad exacta con la referencia);
//   · «declarado» — el arriendo lo escribió el usuario;
//   · «estimada» / «definida» — tarifa y ocupación STR, según haya override.
// Lo del mercado es una fila más de su sección, con la diferencia debajo y el tono de la card
// de zona (sobre = mal, bajo = bien en precio y arriendo).
//
// TODOS los montos respetan el toggle CLP/UF, incluidos cuotas del pie, amoblamiento y tarifa,
// que antes quedaban en pesos. El precio por m² va en UF en los dos modos.
// Campo sin dato se OMITE (nunca «No aplica»).
// ─────────────────────────────────────────────────────────────────────────────

import type { AnalisisInput, FullAnalysisResult } from "./types";
import {
  fmtRadioArriendo,
  resolverArriendoReferencia,
  resolverProcedenciaArriendo,
  respaldoArriendo,
} from "./arriendo-referencia";

export type EtiquetaProcedencia = "sugerido" | "declarado" | "estimada" | "definida";

export interface FilaFicha {
  k: string;
  v: string;
  /** Línea chica bajo el rótulo (la muestra detrás de una referencia). */
  sub?: string;
  /** Diferencia contra la referencia, con su tono. */
  dif?: { texto: string; tono: "mal" | "bien" | "neu" };
  etiqueta?: EtiquetaProcedencia;
}

export interface GrupoFicha {
  titulo: string;
  filas: FilaFicha[];
}

export interface FichaDepto {
  /** La dirección (sin comuna), o la comuna si no hay dirección. */
  titulo: string;
  /** La comuna, cuando el título es la dirección. */
  sub: string | null;
  grupos: GrupoFicha[];
  /** UF con que se convirtieron los montos (la del día del análisis). */
  ufValue: number;
}

const ES = (n: number, d = 0) => n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Monto de ficha: «$498 mil», «$171,8 MM»; en UF, «UF 4.205» o «UF 12,2». */
export function montoFicha(clp: number, ufValue: number, moneda: "CLP" | "UF"): string {
  if (!Number.isFinite(clp)) return "";
  if (moneda === "UF" && ufValue > 0) {
    const u = clp / ufValue;
    return Math.abs(u) >= 100 ? `UF ${ES(Math.round(u))}` : `UF ${ES(u, 1)}`;
  }
  if (Math.abs(clp) < 1_000_000) return `$${ES(Math.round(clp / 1000))} mil`;
  return `$${ES(clp / 1_000_000, 1)} MM`;
}
const ufM2 = (uf: number) => `UF ${ES(Math.round(uf * 10) / 10, 1)}`;
/** «4%», «3,4%», «4,11%»: los ceros sobran solo después de la coma (10% no es 1%). */
const pctTasa = (n: number) => `${n % 1 === 0 ? ES(n) : ES(n, 2).replace(/0+$/, "").replace(/,$/, "")}%`;

/** «3% sobre», «35% bajo», «en la mediana»: el tono de la card de zona. */
function diferencia(pct: number | null | undefined): FilaFicha["dif"] | undefined {
  if (pct == null || !Number.isFinite(pct)) return undefined;
  const a = Math.round(Math.abs(pct));
  if (a === 0) return { texto: "en la mediana", tono: "neu" };
  return { texto: `${a}% ${pct > 0 ? "sobre" : "bajo"}`, tono: pct > 0 ? "mal" : "bien" };
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function entregaFutura(fechaEntrega: string | undefined): string | null {
  if (!fechaEntrega) return null;
  const [a, m] = fechaEntrega.split("-").map(Number);
  if (!a || !m) return null;
  const mes = MESES_CORTOS[m - 1] ?? "";
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${a}`;
}

const antiguedadTxt = (anios: number) => (anios > 0 ? ` · ${anios} ${anios === 1 ? "año" : "años"}` : "");

/** Estacionamiento del input LTR: "no"/"" → nada; "si" → «Sí»; un número → ese número. */
function estacionamientoTxt(v: unknown): string | null {
  if (typeof v === "number") return v > 0 ? String(v) : null;
  const s = String(v ?? "").trim().toLowerCase();
  if (!s || s === "no" || s === "0") return null;
  if (s === "si" || s === "sí") return "Sí";
  return /^\d+$/.test(s) ? s : "Sí";
}

const tituloYSub = (direccion: string, comuna: string) =>
  direccion ? { titulo: direccion, sub: comuna || null } : { titulo: comuna || "El depto", sub: null };

export function buildFichaLtr(p: {
  input: AnalisisInput;
  results: FullAnalysisResult | null | undefined;
  /** Mediana comunal UF/m² con universo y n, si existe (hallazgoSobreprecio). */
  medianaUfM2: number | null;
  universoMediana?: "nuevo" | "usado" | null;
  nMediana?: number | null;
  /** Desviación del hallazgo de sobreprecio: la MISMA que pinta la card de zona. */
  desviacionMediana?: number | null;
  direccion: string;
  comuna: string;
  ufValue: number;
  moneda: "CLP" | "UF";
}): FichaDepto {
  const { input, ufValue, moneda } = p;
  const m = (clp: number) => montoFicha(clp, ufValue, moneda);
  const precioCLP = input.precio * ufValue;
  const esNuevo = input.esNuevo ?? (input.enConstruccion || input.estadoVenta === "futura");
  const futura = input.estadoVenta === "futura";

  const depto: FilaFicha[] = [
    { k: "Tipología", v: `${input.dormitorios}D · ${input.banos}B` },
    { k: "Superficie", v: `${ES(input.superficie)} m²` },
    { k: "Estado", v: esNuevo ? (futura ? "Nuevo · en verde" : "Nuevo") : `Usado${antiguedadTxt(Number(input.antiguedad) || 0)}` },
  ];
  const entrega = futura ? entregaFutura(input.fechaEntrega) : null;
  if (entrega) depto.push({ k: "Entrega", v: entrega });
  const est = estacionamientoTxt((input as { estacionamiento?: unknown }).estacionamiento);
  if (est) depto.push({ k: "Estacionamiento", v: est });
  if ((input as { bodega?: unknown }).bodega === true) depto.push({ k: "Bodega", v: "Sí" });

  const precio: FilaFicha[] = [
    { k: "Precio", v: moneda === "UF" ? `UF ${ES(input.precio)}` : m(precioCLP) },
    { k: "Precio por m²", v: input.superficie > 0 ? ufM2(input.precio / input.superficie) : "" },
  ].filter((f) => f.v);
  if (p.medianaUfM2 != null && p.medianaUfM2 > 0) {
    const universo = p.universoMediana === "nuevo" ? " nuevos" : p.universoMediana === "usado" ? " usados" : "";
    precio.push({
      k: "Mediana de la comuna",
      v: ufM2(p.medianaUfM2),
      sub: p.nMediana ? `${ES(p.nMediana)} deptos${universo}` : undefined,
      dif: diferencia(p.desviacionMediana),
    });
  }

  const arriendo: FilaFicha[] = [];
  if (input.arriendo > 0) {
    const ref = resolverArriendoReferencia(input);
    const procedencia = resolverProcedenciaArriendo(input.arriendo, ref);
    const sugerido = procedencia === "estimacion_franco";
    arriendo.push({ k: "Arriendo", v: `${m(input.arriendo)}/mes`, etiqueta: sugerido ? "sugerido" : "declarado" });
    if (ref) {
      const donde = ref.fuente === "radio" ? `a menos de ${fmtRadioArriendo(ref.radioMetros)}` : "de la comuna";
      if (sugerido) {
        if (ref.n > 0) arriendo.push({ k: "Muestra", v: `${ES(ref.n)} ${ref.n === 1 ? "aviso" : "avisos"}`, sub: donde });
      } else {
        const r = respaldoArriendo(input, input.arriendo);
        arriendo.push({
          k: ref.fuente === "comuna-m2" ? "Estimado de la comuna" : "Mediana de la zona",
          v: `${m(ref.valorCLP)}/mes`,
          sub: ref.n > 0 ? `${ES(ref.n)} ${donde}` : undefined,
          dif: diferencia(r.brechaPct),
        });
      }
    }
  }
  if (input.gastos > 0) arriendo.push({ k: "Gastos comunes", v: `${m(input.gastos)}/mes` });

  const credito: FilaFicha[] = [{ k: "Pie", v: `${ES(input.piePct)}% · ${m(precioCLP * (input.piePct / 100))}` }];
  if (futura && input.cuotasPie > 0 && input.montoCuota > 0) credito.push({ k: "Cuotas del pie", v: `${input.cuotasPie} × ${m(input.montoCuota)}` });
  if (input.piePct < 100) credito.push({ k: "Crédito", v: m(precioCLP * (1 - input.piePct / 100)) });
  if (input.tasaInteres > 0) credito.push({ k: "Tasa", v: pctTasa(input.tasaInteres) });
  if (input.plazoCredito > 0) credito.push({ k: "Plazo", v: `${input.plazoCredito} años` });

  return {
    ...tituloYSub(p.direccion, p.comuna),
    ufValue,
    grupos: [
      { titulo: "Depto", filas: depto },
      { titulo: "Precio", filas: precio },
      ...(arriendo.length ? [{ titulo: "Arriendo", filas: arriendo }] : []),
      { titulo: "Crédito", filas: credito },
    ],
  };
}

export function buildFichaStr(p: {
  /** input_data STR (Record — el payload STR no comparte el shape LTR). */
  input: Record<string, unknown> | null | undefined;
  /** Tarifa/noche CLP del escenario base y ocupación de referencia [0..1] del motor. */
  adrNoche: number | null;
  ocupacionZona: number | null;
  direccion: string;
  comuna: string;
  moneda: "CLP" | "UF";
}): FichaDepto {
  const inp = p.input ?? {};
  const num = (k: string): number => (typeof inp[k] === "number" && Number.isFinite(inp[k] as number) ? (inp[k] as number) : 0);
  const precioCLP = num("precioCompra");
  const precioUF = num("precioCompraUF");
  const ufValue = precioUF > 0 ? precioCLP / precioUF : 0;
  const moneda = ufValue > 0 ? p.moneda : "CLP";
  const m = (clp: number) => montoFicha(clp, ufValue, moneda);
  const superficie = num("superficieUtil") || num("superficie");
  const esNuevo = inp["tipoPropiedad"] === "nuevo";

  const depto: FilaFicha[] = [];
  const dorm = num("dormitorios");
  const banos = num("banos");
  if (dorm > 0 || banos > 0) depto.push({ k: "Tipología", v: `${dorm}D · ${banos}B` });
  if (superficie > 0) depto.push({ k: "Superficie", v: `${ES(superficie)} m²` });
  depto.push({ k: "Estado", v: esNuevo ? "Nuevo" : `Usado${antiguedadTxt(num("antiguedad"))}` });
  const huespedes = num("capacidadHuespedes");
  if (huespedes > 0) depto.push({ k: "Huéspedes", v: String(huespedes) });

  const precio: FilaFicha[] = [];
  if (precioCLP > 0) precio.push({ k: "Precio", v: moneda === "UF" && precioUF > 0 ? `UF ${ES(Math.round(precioUF))}` : m(precioCLP) });
  if (superficie > 0 && precioUF > 0) precio.push({ k: "Precio por m²", v: ufM2(precioUF / superficie) });

  const operacion: FilaFicha[] = [];
  const modo = inp["modoGestion"];
  if (modo === "auto") operacion.push({ k: "Gestión", v: "Autogestión" });
  else if (modo === "administrador") {
    const comision = typeof inp["comisionAdministrador"] === "number" ? (inp["comisionAdministrador"] as number) : null;
    operacion.push({ k: "Gestión", v: `Administrador${comision != null ? ` · ${Math.round(comision * 100)}%` : ""}` });
  }
  const amob = num("costoAmoblamiento");
  if (amob > 0) operacion.push({ k: "Amoblamiento", v: m(amob) });

  const estimado: FilaFicha[] = [];
  const adrDefinida = typeof inp["adrOverride"] === "number" && (inp["adrOverride"] as number) > 0;
  const occDefinida = typeof inp["occOverride"] === "number" && (inp["occOverride"] as number) > 0;
  if (p.adrNoche != null && p.adrNoche > 0) estimado.push({ k: "Tarifa por noche", v: m(p.adrNoche), etiqueta: adrDefinida ? "definida" : "estimada" });
  if (p.ocupacionZona != null && p.ocupacionZona > 0) {
    estimado.push({
      k: "Ocupación",
      v: `${Math.round(p.ocupacionZona * 100)}%`,
      sub: `${Math.round(p.ocupacionZona * 365)} noches al año`,
      etiqueta: occDefinida ? "definida" : "estimada",
    });
  }

  const credito: FilaFicha[] = [];
  const piePct = num("piePct");
  if (precioCLP > 0) credito.push({ k: "Pie", v: piePct > 0 ? `${ES(piePct)}% · ${m(precioCLP * (piePct / 100))}` : "0%" });
  if (precioCLP > 0 && piePct < 100) credito.push({ k: "Crédito", v: m(precioCLP * (1 - piePct / 100)) });
  const tasa = num("tasaInteres") || num("tasaCredito");
  if (tasa > 0) credito.push({ k: "Tasa", v: pctTasa(tasa) });
  const plazo = num("plazoCredito") || num("plazoAnios");
  if (plazo > 0) credito.push({ k: "Plazo", v: `${plazo} años` });

  return {
    ...tituloYSub(p.direccion, p.comuna),
    ufValue,
    grupos: [
      ...(depto.length ? [{ titulo: "Depto", filas: depto }] : []),
      ...(precio.length ? [{ titulo: "Precio", filas: precio }] : []),
      ...(operacion.length ? [{ titulo: "Operación", filas: operacion }] : []),
      ...(estimado.length ? [{ titulo: "Estimado para tu depto", filas: estimado }] : []),
      ...(credito.length ? [{ titulo: "Crédito", filas: credito }] : []),
    ],
  };
}
