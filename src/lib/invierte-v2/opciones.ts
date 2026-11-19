// ─────────────────────────────────────────────────────────────────────────────
// LAS OPCIONES DEL RESULTADO (Invierte con Franco, etapa 2, 18-nov-2026; láminas 3.2). Puro: lo usan el servidor, la pantalla
// y el tier. Todo por reglas, sin texto generado por IA:
//   · elegirOpciones: el depto con que entró, primero, más otros que convienen y le alcanzan en sus comunas, ordenados según
//     lo que busca. Como mucho MAX_OPCIONES en la pantalla.
//   · etiquetar: por qué está cada uno («El que elegiste», «El que más te deja al mes» o «El que menos te pide al mes», «Mejor precio frente a sus
//     parecidos», «El pie más bajo»).
//   · lecturaDeFranco: las frases de «La lectura de Franco», a partir de lo que respondió en el perfil.
//   · resultado: el suyo le alcanza / el suyo no pero otros sí (caso 1) / no le alcanza ninguno (caso 2), con el porqué
//     (falta pie, la renta limita el crédito, o las dos, primero la que más pesa).
// ─────────────────────────────────────────────────────────────────────────────
import type { Objetivo, Preocupacion, Tope } from "./perfil";
import { REGLA_TOPE } from "./perfil";
import { etiquetaVeredicto, signoVeredicto } from "@/lib/veredicto-etiqueta";

/** Máximo de deptos activos (elegidos) por persona (decisión de Fabrizio, 18-nov-2026). */
export const MAX_ACTIVOS = 6;
/** Cuántas opciones muestra el resultado, contando la de entrada. */
export const MAX_OPCIONES = 5; // la de entrada más cuatro: en el PC caben todas a la vista (lámina 3.2-resultado-pc)
/** Bajo esta muestra, «precio contra parecidos» no se muestra (decisión de Fabrizio). */
export const MIN_PARECIDOS = 30;

export interface OpcionDepto {
  avisoId: string;
  comuna: string;
  dormitorios: number | null;
  banos: number | null;
  m2: number | null;
  precioUF: number;
  veredicto: string | null;
  score: number | null;
  /** Flujo neto mensual con pie 20 % y 30 años (avisos_evaluados.flujo_20): negativo = lo que pone cada mes. */
  flujoCLP: number | null;
  arriendoCLP: number | null;
  /** Precio por m² contra el de sus parecidos, en % (negativo = más barato). Null con menos de MIN_PARECIDOS. */
  vsParecidosPct: number | null;
  metro: { estacion: string; metros: number } | null;
  esEntrada: boolean;
  alcanza: boolean;
}

export type Etiqueta = "el_que_elegiste" | "menos_al_mes" | "mejor_precio" | "pie_mas_bajo" | "mejor_puntaje" | "tambien_conviene";
export const ETIQUETAS: Record<Etiqueta, string> = {
  el_que_elegiste: "El que elegiste",
  menos_al_mes: "El que menos te pide al mes",
  mejor_precio: "Mejor precio frente a sus parecidos",
  pie_mas_bajo: "El pie más bajo",
  mejor_puntaje: "El mejor puntaje",
  tambien_conviene: "También conviene y te alcanza",
};

/** Lo que pone al mes (positivo) o 0 si el arriendo cubre todo. */
export const ponesAlMes = (o: Pick<OpcionDepto, "flujoCLP">): number | null => (o.flujoCLP == null ? null : Math.max(0, -o.flujoCLP));
/** ¿El depto deja plata cada mes, pagado todo? (el 89 % de los usados que convienen, medido el 18-nov-2026). */
export const dejaPlata = (o: Pick<OpcionDepto, "flujoCLP">) => o.flujoCLP != null && o.flujoCLP > 0;
/** La celda de «Al mes (con pie 20 %)» (decisión de Fabrizio, 18-nov-2026): «Te sobran $X» o «Pones $Y». `pones` = va en
 *  rojo (monto negativo). */
export function textoAlMes(o: Pick<OpcionDepto, "flujoCLP">): { t: string; pones: boolean } {
  if (o.flujoCLP == null) return { t: "—", pones: false };
  return dejaPlata(o) ? { t: `Te sobran ${fmtCLP(o.flujoCLP)}`, pones: false } : { t: `Pones ${fmtCLP(-o.flujoCLP)}`, pones: o.flujoCLP < 0 };
}
export const ETIQUETA_MAS_DEJA = "El que más te deja al mes";
/** El texto de una etiqueta: la del mejor flujo dice «El que más te deja al mes» si deja plata y «El que menos te pide al mes»
 *  si no (decisión de Fabrizio, 18-nov-2026). */
export function textoEtiqueta(et: Etiqueta, o: Pick<OpcionDepto, "flujoCLP">): string {
  return et === "menos_al_mes" && dejaPlata(o) ? ETIQUETA_MAS_DEJA : ETIQUETAS[et];
}
export const pieDe = (precioUF: number) => Math.round(precioUF * REGLA_TOPE.piePct / 100);

/** «Precio contra parecidos»: (precio/m²) / mediana de sus parecidos − 1, solo con una muestra suficiente. */
export function vsParecidos(precioUF: number, m2: number | null, venta: { precioM2UF?: number | null; n?: number | null } | null): number | null {
  if (!m2 || m2 <= 0 || !venta?.precioM2UF || venta.precioM2UF <= 0 || (venta.n ?? 0) < MIN_PARECIDOS) return null;
  return Math.round(((precioUF / m2) / venta.precioM2UF - 1) * 100);
}

/** «Estación Ñuñoa, a 450 m aprox.»: la estación más cercana en línea recta, redondeada a 50 m. Sin minutos inventados. */
export function textoMetro(m: OpcionDepto["metro"]): string {
  if (!m) return "—";
  const metros = Math.max(50, Math.round(m.metros / 50) * 50);
  const dist = metros >= 1000 ? `${(metros / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} km` : `${metros} m`;
  return `Estación ${m.estacion.replace(/^Estación\s+/i, "")}, a ${dist} aprox.`;
}

export function textoVsParecidos(pct: number | null): string {
  if (pct == null) return "—";
  if (pct === 0) return "En el precio";
  return pct < 0 ? `${Math.abs(pct)} % bajo` : `${pct} % sobre`;
}

/** Orden según lo que busca: arriendo o «poner plata» → menos al mes; plusvalía → mejor precio contra parecidos y puntaje. */
function claveOrden(objetivo: Objetivo, preocupaciones: readonly Preocupacion[]) {
  const porPlata = objetivo === "arriendo" || preocupaciones.includes("poner_plata") || preocupaciones.includes("no_arriende");
  return (a: OpcionDepto, b: OpcionDepto) => {
    if (porPlata) { const d = (b.flujoCLP ?? -Infinity) - (a.flujoCLP ?? -Infinity); if (d) return d; }
    if (objetivo === "plusvalia") { const d = (a.vsParecidosPct ?? Infinity) - (b.vsParecidosPct ?? Infinity); if (d) return d; }
    return (b.score ?? -1) - (a.score ?? -1) || a.precioUF - b.precioUF || a.avisoId.localeCompare(b.avisoId);
  };
}

/** El depto de entrada primero (aunque no le alcance: eso decide el caso 1), y después los que convienen y le alcanzan. */
export function elegirOpciones(entrada: OpcionDepto | null, candidatos: readonly OpcionDepto[], objetivo: Objetivo, preocupaciones: readonly Preocupacion[]): OpcionDepto[] {
  const otros = candidatos.filter((c) => c.alcanza && c.avisoId !== entrada?.avisoId).sort(claveOrden(objetivo, preocupaciones));
  return [...(entrada ? [entrada] : []), ...otros].slice(0, MAX_OPCIONES);
}

/** Una etiqueta por depto, sin repetir: la de entrada, y para los demás la regla que mejor gana cada uno. */
export function etiquetar(opciones: readonly OpcionDepto[]): Map<string, Etiqueta> {
  const out = new Map<string, Etiqueta>();
  const libres = () => opciones.filter((o) => !out.has(o.avisoId) && o.alcanza);
  for (const o of opciones) if (o.esEntrada) out.set(o.avisoId, "el_que_elegiste");
  // El ganador se mide contra TODAS las opciones que le alcanzan (no solo las libres): una etiqueta dice algo cierto. Si el
  // mejor ya tiene otra etiqueta, esta no se pone en un segundo («El mejor puntaje» en uno de 84 con uno de 88 al lado).
  const ganador = (val: (o: OpcionDepto) => number | null, menor: boolean) => {
    const c = opciones.filter((o) => o.alcanza && !o.esEntrada && val(o) != null);
    if (!c.length) return null;
    const g = c.reduce((a, b) => ((menor ? val(b)! < val(a)! : val(b)! > val(a)!) ? b : a));
    return libres().includes(g) ? g : null;
  };
  const reglas: [Etiqueta, (o: OpcionDepto) => number | null, boolean][] = [
    ["menos_al_mes", (o) => o.flujoCLP, false],
    ["mejor_precio", (o) => o.vsParecidosPct, true],
    ["pie_mas_bajo", (o) => o.precioUF, true],
    ["mejor_puntaje", (o) => o.score, false],
  ];
  for (const [et, val, menor] of reglas) { const g = ganador(val, menor); if (g) out.set(g.avisoId, et); }
  for (const o of opciones) if (!out.has(o.avisoId)) out.set(o.avisoId, "tambien_conviene");
  return out;
}

/** «el de Macul», o «el de Ñuñoa de 55 m²» cuando hay dos en la misma comuna. */
export function nombreCorto(o: OpcionDepto, todas: readonly OpcionDepto[]): string {
  const repetida = todas.filter((x) => x.comuna === o.comuna).length > 1;
  return repetida && o.m2 ? `el de ${o.comuna} de ${Math.round(o.m2)} m²` : `el de ${o.comuna}`;
}

const FRASE_OBJETIVO: Record<Objetivo, string> = { arriendo: "arriendo mes a mes", plusvalia: "plusvalía", ambas: "arriendo y plusvalía" };
const FRASE_PREOCUPA: Record<Preocupacion, string> = { no_arriende: "que no se arriende", poner_plata: "poner plata cada mes", elegir_mal: "elegir mal", tramite: "el trámite" };

/** «La lectura de Franco»: frases por reglas. Devuelve partes para poder resaltar la del medio (lámina: en negrita). */
export function lecturaDeFranco(opciones: readonly OpcionDepto[], objetivo: Objetivo, preocupaciones: readonly Preocupacion[], etiquetas: Readonly<Record<string, Etiqueta>>): { intro: string; destacado: string | null; resto: string } {
  const vivas = opciones.filter((o) => o.alcanza);
  const prs = preocupaciones.slice(0, 2).map((p) => FRASE_PREOCUPA[p]);
  const intro = `Buscas ${FRASE_OBJETIVO[objetivo]}${prs.length ? ` y te preocupa ${prs.join(" y ")}` : ""}.`;
  if (!vivas.length) return { intro, destacado: null, resto: "" };
  const porPlata = objetivo === "arriendo" || preocupaciones.includes("poner_plata") || preocupaciones.includes("no_arriende");
  const con = (et: Etiqueta) => vivas.find((o) => etiquetas[o.avisoId] === et) ?? null;
  const menosMes = con("menos_al_mes");
  const mejorPrecio = con("mejor_precio");
  const mejorScore = [...vivas].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0];
  const masCerca = [...vivas].filter((o) => o.metro).sort((a, b) => a.metro!.metros - b.metro!.metros)[0] ?? null;
  const calza = (porPlata ? menosMes : objetivo === "plusvalia" ? mejorPrecio : null) ?? mejorScore;
  const razones: string[] = [];
  if (calza === menosMes) razones.push(dejaPlata(calza) ? "el que más te deja al mes" : "el que menos te pide al mes");
  if (calza === mejorPrecio) razones.push("el mejor precio contra sus parecidos");
  if (calza === masCerca) razones.push("el más cerca del metro");
  if (!razones.length) razones.push("el de mejor puntaje");
  const destacado = `${nombreCorto(calza, vivas)} es el que mejor calza`;
  let resto = `: es ${unir(razones)}.`;
  const otro = mejorScore && mejorScore !== calza ? mejorScore : null;
  if (otro) {
    const extra = otro === mejorPrecio ? " y el mejor precio contra sus parecidos" : "";
    resto += ` ${cap(nombreCorto(otro, vivas))} tiene el mejor puntaje${extra}. Vale seguir con los dos.`;
  }
  return { intro: `${intro} Con eso,`, destacado, resto };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const unir = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

// ── EL RESULTADO Y POR QUÉ NO ALCANZA ────────────────────────────────────────
export type Caso = "alcanza" | "caso1" | "caso2";
export type Motivo = "pie" | "credito" | "pie_y_credito";

/** Lo que tiene de pie para la cuenta del faltante (con preaprobación y pie completo, el pie justo del monto). */
export function pieDisponible(t: Tope, pieUF: number | null): number {
  if ((t.fuente === "preaprobacion" || t.fuente === "aprobada") && t.limita === null && t.creditoUF) return t.creditoUF / (1 - REGLA_TOPE.piePct / 100) * REGLA_TOPE.piePct / 100;
  return Math.max(0, pieUF ?? 0);
}

/** Por qué un depto de precio P no le alcanza: falta pie (Y = 20 % de P − su pie), el crédito no llega (renta o preaprobación),
 *  o las dos; con las dos, primero la que más pesa (la que por sí sola deja un tope más bajo). */
export function porQueNoAlcanza(precioUF: number, t: Tope, pieUF: number | null): { motivo: Motivo; faltaPieUF: number; creditoUF: number | null } | null {
  const pie = pieDisponible(t, pieUF);
  const faltaPie = Math.max(0, Math.ceil(precioUF * REGLA_TOPE.piePct / 100 - pie));
  const faltaCredito = t.creditoUF != null && precioUF - Math.min(pie, precioUF * REGLA_TOPE.piePct / 100) > t.creditoUF + 0.5;
  if (!faltaPie && !faltaCredito) return null;
  if (faltaPie && faltaCredito) return { motivo: "pie_y_credito", faltaPieUF: faltaPie, creditoUF: t.creditoUF };
  return { motivo: faltaPie ? "pie" : "credito", faltaPieUF: faltaPie, creditoUF: t.creditoUF };
}

/** «Estás cerca» solo cuando lo que falta es poco (propuesto el 18-nov-2026): el más barato que conviene cuesta como mucho un
 *  10 % más de lo que puede comprar. Vale igual para la variante de pie y la de renta: las dos se dicen como «puedes comprar
 *  hasta X; el más barato está en Z». */
export const UMBRAL_CERCA_PCT = 10;
export const estaCerca = (topeUF: number, masBaratoUF: number | null) =>
  masBaratoUF != null && topeUF > 0 && masBaratoUF <= topeUF * (1 + UMBRAL_CERCA_PCT / 100);

export function casoDe(opciones: readonly OpcionDepto[]): Caso {
  const entrada = opciones.find((o) => o.esEntrada);
  const otrosQueAlcanzan = opciones.filter((o) => !o.esEntrada && o.alcanza).length;
  if (entrada?.alcanza) return "alcanza";
  return otrosQueAlcanzan ? "caso1" : "caso2";
}

/** Los textos del resultado. La variante de RENTA la aprobó Fabrizio el 18-nov-2026, con «Hoy tu renta limita el crédito». */
export const RESULTADO_COPY = {
  rotulo: "Tu resultado",
  alcanza: (comuna: string, n: number) => (n ? `El depto de ${comuna} te alcanza, y otros ${n} que convienen también.` : `El depto de ${comuna} te alcanza.`),
  sinEntrada: (n: number) => `Te alcanzan ${n} deptos que convienen.`,
  pregunta: "¿Con cuáles quieres seguir?",
  preguntaLinea: "Marca uno o varios. Con esos partimos.",
  lista: "Lista",
  comparar: "Comparar",
  verDetalles: "Ver detalles",
  seguir: (n: number) => (n === 1 ? "Seguir con este" : `Seguir con estos ${n}`),
  maximo: `Puedes seguir con hasta ${MAX_ACTIVOS} a la vez.`,
  lecturaRotulo: "La lectura de Franco",
  notaTabla: `En azul, la mejor de cada fila. Todas dan ${signoVeredicto("COMPRAR")} ${etiquetaVeredicto("COMPRAR", "frase")}.`,
  notaTablaPie: "Al mes: con pie 20 %, 30 años y la tasa del mes.",
  compararAviso: (n: number) => (n > 3 ? "Se comparan tres a la vez. Desliza para ver el resto." : ""),
  /** En el PC caben cinco; con más (lo que ya eligió y salió del top), la tabla se desliza adentro y lo dice. */
  compararAvisoPc: (n: number) => (n > MAX_OPCIONES ? `Son ${n} deptos. Desliza la tabla para ver todos.` : ""),
  filas: { veredicto: "Veredicto", precio: "Precio", pie: "Pie (20 %)", alcanza: "¿Te alcanza?", pones: "Al mes (con pie 20 %)", arriendo: "Arriendo estimado", parecidos: "Precio contra parecidos", metro: "Metro", sigo: "Sigo con este", detalle: "Detalles" },
  loQueMasImporta: "Lo que más te importa",
  si: "Sí",
  no: "No",
  caso1: {
    titulo: (comuna: string) => `El depto de ${comuna} todavía no te alcanza`,
    pie: (precio: string, y: string) => `Está en UF ${precio}: te faltan UF ${y} de pie.`,
    credito: (precio: string, x: string, conPre: boolean) => `Está en UF ${precio}: con tu ${conPre ? "preaprobación" : "renta"}, el crédito llega hasta UF ${x}.`,
    pieYCredito: (precio: string, y: string, x: string, piePesaMas: boolean, conPre: boolean) =>
      piePesaMas ? `Está en UF ${precio}: te faltan UF ${y} de pie, y con tu ${conPre ? "preaprobación" : "renta"} el crédito llega hasta UF ${x}.`
                 : `Está en UF ${precio}: con tu ${conPre ? "preaprobación" : "renta"}, el crédito llega hasta UF ${x}, y te faltan UF ${y} de pie.`,
    siAlcanza: "Lo que sí te alcanza hoy",
    siAlcanzaLinea: (n: number) => `Hay ${n} ${n === 1 ? "depto que conviene" : "deptos que convienen"} dentro de lo que puedes comprar. ${n === 1 ? "Es el que más se parece" : "Estos son los que más se parecen"} a lo que buscas.`,
    seguir: "Seguir con los que me alcanzan",
    avisar: (comuna: string) => `Avísenme cuando me alcance el de ${comuna}`,
  },
  caso2: {
    tituloPie: (y: string, cerca: boolean) => (cerca ? `Estás cerca: te faltan UF ${y} de pie` : `Hoy te faltan UF ${y} de pie`),
    tituloCredito: (cerca: boolean) => (cerca ? "Estás cerca: tu renta limita el crédito" : "Hoy tu renta limita el crédito"),
    cuerpoPie: (pie: string, x: string, z: string) => `Con tu pie de UF ${pie} puedes comprar hasta UF ${x}. El depto más barato que conviene hoy está en UF ${z}.`,
    cuerpoCredito: (credito: string, x: string, z: string) => `Con tu renta, el crédito llega hasta UF ${credito}, así que puedes comprar hasta UF ${x}. El depto más barato que conviene hoy está en UF ${z}.`,
    notaPieRentaOk: "Tu renta sí alcanza para el dividendo. Estimación con pie 20 %, 30 años y la tasa del mes. Sujeto a evaluación del banco.",
    notaPieSinRenta: "Sin tu renta, estimamos solo con tu pie. Estimación con pie 20 %, 30 años y la tasa del mes. Sujeto a evaluación del banco.",
    notaCredito: "Tu pie sí alcanza. Esto cambia con un codeudor o con menos cuotas al mes. Estimación con 30 años y la tasa del mes. Sujeto a evaluación del banco.",
    notaAmbas: "Estimación con pie 20 %, 30 años y la tasa del mes. Sujeto a evaluación del banco.",
    segundaPie: (y: string) => `Además, te faltan UF ${y} de pie.`,
    segundaCredito: (credito: string) => `Además, con tu renta el crédito llega hasta UF ${credito}.`,
    avisar: "Avísenme cuando algo me alcance",
    actualizar: "Cambió mi pie o mi renta: actualizar",
    avisado: "Listo. Te avisamos cuando algo te alcance.",
  },
  espera: {
    titulo: "Buscando tus opciones…",
    paso1: (comunas: string) => `Revisando los deptos que convienen en ${comunas}`,
    paso2: "Calculando cuáles te alcanzan",
    paso3: "Ordenándolos según lo que buscas",
    error: "No pudimos buscar tus opciones. Lo que contestaste quedó guardado.",
    reintentar: "Intentar de nuevo",
  },
} as const;

export const fmtUF = (n: number) => Math.round(n).toLocaleString("es-CL");
export const fmtCLP = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
export const comunasEnFrase = (cs: readonly string[]) => (cs.length <= 1 ? cs[0] ?? "" : `${cs.slice(0, -1).join(", ")} y ${cs[cs.length - 1]}`);
