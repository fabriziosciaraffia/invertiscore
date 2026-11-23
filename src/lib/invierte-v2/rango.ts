// ─────────────────────────────────────────────────────────────────────────────
// EL RANGO DE OFERTA, VERSIÓN 1 (etapa 3, B3; regla decidida por Fabrizio el 22-nov-2026). Puro: la regla, los textos y los avisos;
// lo usan el servidor (rango-servidor.ts), las pantallas de la oferta y el tier.
//   · En vez de comparar contra la zona, estima cuánto cede quien vende: un descuento BASE (lo que ceden los usados que ajustan su
//     precio; medido el 20-nov-2026: mediana −4,4 %) más y menos puntos por señales del propio aviso:
//       ya bajó de precio +1 · más de 5 % sobre la mediana de sus vecinos del edificio +2 · arreglos concretos +1 (remodelación +3) ·
//       más de 10 % bajo la mediana de sus vecinos −1.
//     Vecinos del edificio: venta activa a < 30 m, mismos dormitorios, ±20 % m², sin duplicados ni el propio; al menos 2; sin pin
//     sospechoso; y si la diferencia contra su mediana pasa de 25 % (arriba o abajo), la señal no se usa: es otro edificio.
//     El punto por arreglos suma solo si la lectura nombra un arreglo CONCRETO (visto o dicho), no si la publicación no lo describe.
//   · Descuento final entre MIN y MAX. Recomendado = publicado × (1 − descuento); la persona ve un punto arriba y uno abajo del
//     recomendado (sin pasar el techo).
//   · AJUSTA SUPUESTOS (v1.1, 22-nov-2026, Fabrizio): el recomendado normal se calcula igual sobre el publicado. Si queda en o bajo el
//     precio al que vuelve a Comprar, el rango es el normal y su borde alto no pasa de ese precio (el techo). Si queda sobre ese precio,
//     el recomendado ES ese precio, el rango baja dos puntos desde ahí, la postura es «Negocia con argumentos» y la primera razón dice
//     que es más rebaja de la que suelen dar. Ofrecer sobre ese precio trae su aviso («deja de convenir»), que no bloquea. La entrada
//     no cambia: un Ajusta entra a Invierte si la rebaja para volver a Comprar es de 10 % o menos (TOPE_NEGOCIAR_PCT).
//   · Postura: hasta 4 %, Asegúralo; 5 a 6 %, Negocia un poco; 7 % o más, Negocia con argumentos.
//   · Razones en fácil (sin UF por m² ni «mediana»): una por señal; sin señales, una sola.
// Todos los valores van en `config` (rango-servidor › leerConfigRango); estos son los de la versión 1.
// ─────────────────────────────────────────────────────────────────────────────

export const REGLA_VERSION = "v1.1";

export interface ConfigRango {
  base: number; min: number; max: number; banda: number;
  /** En un Ajusta cuyo recomendado normal queda sobre el precio a Comprar: cuántos puntos baja el rango desde ese precio. */
  bandaAjusta: number;
  yaBajo: number; vecinosSobre: number; vecinosBajo: number; arreglos: number; remodelacion: number;
  sobreVecinosPct: number; bajoVecinosPct: number; corteVecinosPct: number; minVecinos: number;
  posturaAsegura: number; posturaNegocia: number;
  avisoFuertePct: number;
}
export const CONFIG_RANGO_V1: ConfigRango = {
  base: 5, min: 2, max: 9, banda: 1, bandaAjusta: 2,
  yaBajo: 1, vecinosSobre: 2, vecinosBajo: -1, arreglos: 1, remodelacion: 3,
  sobreVecinosPct: 5, bajoVecinosPct: 10, corteVecinosPct: 25, minVecinos: 2,
  posturaAsegura: 4, posturaNegocia: 6,
  avisoFuertePct: 5,
};

export type Postura = "asegura" | "negocia_poco" | "negocia_argumentos";
export const POSTURA_COPY: Record<Postura, string> = { asegura: "Asegúralo", negocia_poco: "Negocia un poco", negocia_argumentos: "Negocia con argumentos" };

export interface SenalesRango {
  /** La última bajada de precio registrada (UF que bajó y cuándo), o null. */
  bajada: { uf: number; fecha: string } | null;
  /** Sus vecinos del mismo edificio (ya filtrados: mismos dormitorios, ±20 % m², sin duplicados ni el propio), o null si no se buscaron. */
  vecinos: { ufm2: number[]; propioUfm2: number } | null;
  pinSospechoso: boolean;
  estadoArriendo: string | null;
  arreglos: string[];
  /** Republicados (23-nov-2026): desde cuándo está publicado contando la cadena de gemelos, y cuántos eslabones anteriores tiene.
   *  Se guardan con las señales para calibrar; la regla v1.1 no los usa. */
  publicadoDesde?: string | null;
  eslabones?: number;
}

export interface Rango {
  regla: string;
  descuentoPct: number;
  postura: Postura;
  techoUF: number;
  /** En un Ajusta supuestos, el precio al que vuelve a Comprar (sobre él, deja de convenir); null en un Comprar. */
  comprarUF: number | null;
  recomendadoUF: number;
  pisoUF: number;
  altoUF: number;
  razones: string[];
  /** Lo que movió el descuento, para calibrar después (inv_ofertas.senales). */
  aplicado: { senal: string; puntos: number; dato?: Record<string, unknown> }[];
}

const mediana = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmt = (n: number) => Math.round(n).toLocaleString("es-CL");
const NUM = ["cero", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];
const cuantos = (n: number) => (n <= 10 ? NUM[n] : String(n));

/** «hace tres semanas», «hace 5 días», «hace un mes». */
export function haceCuanto(fecha: string, ahora: Date): string {
  const dias = Math.max(0, Math.round((ahora.getTime() - new Date(`${fecha}T12:00:00Z`).getTime()) / 864e5));
  if (dias <= 1) return dias === 0 ? "hoy" : "ayer";
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 30) return `hace ${cuantos(Math.round(dias / 7))} semanas`;
  const meses = Math.round(dias / 30);
  return meses <= 1 ? "hace un mes" : `hace ${cuantos(meses)} meses`;
}

/** La señal de los vecinos del edificio: null si no se usa (pocos, pin sospechoso o tan distintos que es otro edificio). */
export function senalVecinos(v: SenalesRango["vecinos"], pinSospechoso: boolean, c: ConfigRango = CONFIG_RANGO_V1): { difPct: number; n: number; masBaratos: number; masCaros: number } | null {
  if (!v || pinSospechoso || v.ufm2.length < c.minVecinos || !(v.propioUfm2 > 0)) return null;
  const med = mediana(v.ufm2);
  const difPct = (v.propioUfm2 / med - 1) * 100;
  if (Math.abs(difPct) > c.corteVecinosPct) return null;
  return { difPct, n: v.ufm2.length, masBaratos: v.ufm2.filter((x) => x < v.propioUfm2).length, masCaros: v.ufm2.filter((x) => x > v.propioUfm2).length };
}

/** ¿Suma por arreglos? Solo con un arreglo concreto nombrado por la lectura. */
export function puntosArreglos(estado: string | null, arreglos: readonly string[], c: ConfigRango = CONFIG_RANGO_V1): number {
  if (!arreglos.length) return 0;
  if (estado === "remodelacion") return c.remodelacion;
  if (estado === "arreglos_menores") return c.arreglos;
  return 0;
}

export const postura = (descuentoPct: number, c: ConfigRango = CONFIG_RANGO_V1): Postura =>
  descuentoPct <= c.posturaAsegura ? "asegura" : descuentoPct <= c.posturaNegocia ? "negocia_poco" : "negocia_argumentos";

const conMayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** Los arreglos en una frase corta: el primero; y el segundo con «y» solo si el primero es corto y no trae ya una «y». */
export function arreglosEnUnaFrase(xs: readonly string[]): string {
  const [a, b] = xs;
  if (!a) return "";
  return b && a.length <= 45 && !/\by\b/.test(a) && a.length + b.length <= 85 ? `${a} y ${b}` : a;
}

/** LA REGLA v1.1. `publicadoUF`: el precio publicado; `comprarUF`: en un Ajusta supuestos, el precio al que vuelve a Comprar (null en un
 *  Comprar). */
export function calcularRango(publicadoUF: number, s: SenalesRango, ahora: Date = new Date(), c: ConfigRango = CONFIG_RANGO_V1, comprarUF: number | null = null): Rango {
  const aplicado: Rango["aplicado"] = [];
  const razones: string[] = [];
  let pts = c.base;
  if (s.bajada && s.bajada.uf > 0) {
    pts += c.yaBajo;
    aplicado.push({ senal: "ya_bajo", puntos: c.yaBajo, dato: s.bajada });
    razones.push(`Ya bajó UF ${fmt(s.bajada.uf)} ${haceCuanto(s.bajada.fecha, ahora)}: quien vende está dispuesto a moverse.`);
  }
  const v = senalVecinos(s.vecinos, s.pinSospechoso, c);
  if (v && v.difPct > c.sobreVecinosPct) {
    pts += c.vecinosSobre;
    aplicado.push({ senal: "sobre_vecinos", puntos: c.vecinosSobre, dato: { n: v.n, difPct: Math.round(v.difPct * 10) / 10 } });
    razones.push(`En su mismo edificio se ${v.masBaratos === 1 ? "vende un depto parecido más barato" : `venden ${v.masBaratos} deptos parecidos más baratos`}: es un argumento para pedir rebaja.`);
  } else if (v && v.difPct < -c.bajoVecinosPct) {
    pts += c.vecinosBajo;
    aplicado.push({ senal: "bajo_vecinos", puntos: c.vecinosBajo, dato: { n: v.n, difPct: Math.round(v.difPct * 10) / 10 } });
    razones.push(v.masCaros === v.n
      ? `Es más barato que los ${v.n} deptos parecidos que se venden en su edificio: hay poco margen para pedir rebaja.`
      : `Es más barato que la mayoría de los ${v.n} deptos parecidos que se venden en su edificio: hay poco margen para pedir rebaja.`);
  }
  const pa = puntosArreglos(s.estadoArriendo, s.arreglos, c);
  if (pa) {
    pts += pa;
    aplicado.push({ senal: s.estadoArriendo === "remodelacion" ? "remodelacion" : "arreglos", puntos: pa, dato: { arreglos: s.arreglos } });
    razones.push(`${conMayuscula(arreglosEnUnaFrase(s.arreglos))}: es un argumento concreto para pedir rebaja.`);
  }
  if (!razones.length) razones.push(`No vimos nada en este depto que mueva el precio. Estimamos que los vendedores de deptos usados que ajustan su precio ceden cerca de ${fmt(c.base)} %.`);
  const descuentoPct = Math.min(c.max, Math.max(c.min, pts));
  const pub = publicadoUF;
  const recomendadoUF = Math.round(pub * (1 - descuentoPct / 100));
  const comprar = comprarUF != null && comprarUF > 0 && comprarUF < pub ? Math.round(comprarUF) : null;
  if (comprar == null || recomendadoUF <= comprar) {
    // Comprar, o un Ajusta cuyo recomendado normal ya queda en o bajo el precio a Comprar: el rango normal, con el techo como tope.
    const techoUF = comprar ?? Math.round(pub);
    const pisoUF = Math.round(pub * (1 - (descuentoPct + c.banda) / 100));
    const altoUF = Math.min(techoUF, Math.round(pub * (1 - (descuentoPct - c.banda) / 100)));
    return { regla: REGLA_VERSION, descuentoPct, postura: postura(descuentoPct, c), techoUF, comprarUF: comprar, recomendadoUF, pisoUF, altoUF, razones, aplicado };
  }
  // Ajusta con el recomendado normal sobre el precio a Comprar: se recomienda ese precio y el rango baja desde ahí.
  const dComprar = Math.round((1 - comprar / pub) * 1000) / 10;
  aplicado.push({ senal: "ajusta_sobre_comprar", puntos: Math.round((dComprar - descuentoPct) * 10) / 10, dato: { comprarUF: comprar, descuentoNormalPct: descuentoPct } });
  razones.unshift(`Al precio publicado no conviene. Conviene desde UF ${fmt(comprar)} hacia abajo. Es más rebaja de la que suelen dar los vendedores: puede que no la acepten.`);
  const pisoUF = Math.round(pub * (1 - (dComprar + c.bandaAjusta) / 100));
  return { regla: REGLA_VERSION, descuentoPct: dComprar, postura: "negocia_argumentos", techoUF: comprar, comprarUF: comprar, recomendadoUF: comprar, pisoUF, altoUF: comprar, razones, aplicado };
}

// ── EL TOPE Y LA BARRA DEL RANGO (rediseño del 23-nov-2026) ─────────────────
/** El tope duro de la oferta: el precio publicado. Nunca se oferta sobre lo publicado: el + se detiene ahí, el campo no acepta más
 *  (tampoco escrito ni por la dirección) y el servidor lo rechaza al firmar. */
export const topeOferta = (publicadoUF: number) => Math.max(1, Math.floor(publicadoUF));
export const acotarOferta = (montoUF: number, publicadoUF: number) => Math.min(topeOferta(publicadoUF), Math.max(1, Math.round(montoUF)));

// Con espacio que no corta: «5 %» nunca queda partido en dos renglones.
const pct1 = (x: number) => `${(Math.round(x * 10) / 10).toLocaleString("es-CL", { maximumFractionDigits: 1 })} %`;
/** «5 % bajo el precio publicado», «7,8 %…». */
export const pctBajoPublicado = (montoUF: number, publicadoUF: number) => `${pct1((1 - montoUF / publicadoUF) * 100)} bajo el precio publicado`;
/** «4 % a 6 % bajo el precio publicado» (el rango, en puntos enteros). */
export function rangoPctPublicado(pisoUF: number, altoUF: number, publicadoUF: number): string {
  const a = Math.round((1 - altoUF / publicadoUF) * 100), b = Math.round((1 - pisoUF / publicadoUF) * 100);
  return `${a === b ? `${a} %` : `${a} % a ${b} %`} bajo el precio publicado`;
}
/** Bajo este monto sale el aviso fuerte (la zona rayada de la barra): el piso menos 5 % del publicado. */
export const fuerteDesde = (pisoUF: number, publicadoUF: number, c: Pick<ConfigRango, "avisoFuertePct"> = CONFIG_RANGO_V1) => pisoUF - publicadoUF * c.avisoFuertePct / 100;
/** LA ESCALA DE LA BARRA: va hasta el publicado (el tope). Parte un poco antes de la zona rayada para que se vea; si el rango queda muy
 *  angosto o pegado a un extremo, la escala se acorta hasta que la franja ocupe al menos 10 % del ancho. */
export const FRANJA_MIN_PCT = 10;
export function escalaBarra(pisoUF: number, altoUF: number, publicadoUF: number, fuerteUF: number): { minUF: number; maxUF: number } {
  const maxUF = publicadoUF;
  let minUF = Math.max(0, fuerteUF - 0.3 * (maxUF - fuerteUF));
  const ancho = Math.max(altoUF - pisoUF, 1);
  if ((ancho / (maxUF - minUF)) * 100 < FRANJA_MIN_PCT) minUF = Math.max(0, maxUF - ancho / (FRANJA_MIN_PCT / 100));
  return { minUF: Math.min(minUF, pisoUF - ancho * 0.5), maxUF };
}

// ── LOS AVISOS DE LA OFERTA (decididos el 21-nov-2026; de una línea desde el 23-nov) ──
export type AvisoOferta = "ninguno" | "bajo_piso" | "bajo_piso_fuerte" | "sobre_recomendado" | "sobre_techo";

/** Bajo el piso, aviso suave; si el piso menos la oferta pasa de 5 % del publicado, aviso fuerte. En un Ajusta supuestos, sobre el precio
 *  a Comprar, que ahí deja de convenir (22-nov-2026). Sobre el borde alto, que puede partir más abajo. Nunca bloquea: Franco la presenta
 *  igual si la persona insiste. */
export function avisoOferta(montoUF: number, r: Pick<Rango, "pisoUF" | "altoUF"> & { comprarUF?: number | null }, publicadoUF: number, c: Pick<ConfigRango, "avisoFuertePct"> = CONFIG_RANGO_V1): AvisoOferta {
  if (montoUF < r.pisoUF) return r.pisoUF - montoUF > publicadoUF * c.avisoFuertePct / 100 ? "bajo_piso_fuerte" : "bajo_piso";
  if (r.comprarUF != null && montoUF > r.comprarUF) return "sobre_techo";
  if (montoUF > r.altoUF) return "sobre_recomendado";
  return "ninguno";
}

export const OFERTA_COPY = {
  cabecera: "Tu oferta",
  titulo: "La oferta que recomienda Franco",
  rotulo: "Franco recomienda",
  entre: (a: number, b: number) => `Entre UF ${fmt(a)} y UF ${fmt(b)}`,
  entreCorto: (a: number, b: number) => `UF ${fmt(a)} a ${fmt(b)}`,
  campoRotulo: "Tu oferta",
  bajar: "Bajar UF 10",
  subir: "Subir UF 10",
  barra: "Tu oferta en el rango",
  poco: "Poco probable",
  publicado: "Publicado",
  tuOferta: (uf: number) => `Tu oferta UF ${fmt(uf)}`,
  recomendado: (uf: number) => `Recomendado UF ${fmt(uf)}`,
  revisar: "Revisar y firmar mi oferta",
  revisarPor: (uf: number) => `Revisar y firmar por UF ${fmt(uf)}`,
  firmarIgual: (uf: number) => `Firmar igual por UF ${fmt(uf)}`,
  volverRecomendada: "Volver a la recomendada",
  hablar: "Hablarlo con Franco",
  hablarListo: "Le avisamos a Franco: te escribe para conversarlo.",
  bajoT: (uf: number) => `Estás UF ${fmt(uf)} bajo lo recomendado.`,
  bajoSuave: "Puedes ofertar igual.",
  bajoFuerte: "Es probable que no la acepten. Puedes ofertar igual.",
  sobreT: (uf: number) => `Estás UF ${fmt(uf)} sobre lo recomendado.`,
  sobre: "Puedes partir más abajo.",
  sobreTecho: (uf: number) => `Sobre UF ${fmt(uf)} este depto deja de convenir.`,
  tope: "No puedes ofrecer más que el precio publicado.",
} as const;

/** La firma (rediseño del 23-nov-2026, láminas 5.1b): lo primero es que firmar no obliga a comprar, con los cuatro pasos; el resumen en
 *  tres filas; que mientras tanto no puede ofertar por otro depto va junto a la vigencia. */
export const FIRMA_COPY = {
  volver: "Cambiar el precio",
  titulo: "Revisa y firma tu oferta",
  noObliga: "Firmar no te obliga a comprar",
  noObligaS: "Tu oferta queda sujeta a tu visita",
  pasos: ["Firmas", "Responden", "Visitas el depto", "Confirmas o la retiras"],
  siNo: "Si después de ver el depto no te convence, la retiras o la ajustas. Sin costo.",
  queSignifica: "¿Qué significa «sujeta a visita»?",
  sujetaVentana: [
    "Tu oferta vale solo si, después de visitar el depto, tú la confirmas.",
    "Si quien vende la acepta, Franco coordina la visita contigo.",
    "Si lo que ves no te convence, la retiras o la ajustas, sin costo.",
    "Si prefieres no visitarlo, puedes confirmarla igual.",
  ],
  entendido: "Entendido",
  ofreces: "Ofreces",
  comoPagas: "Cómo pagas",
  pieYCredito: (pie: number) => `Pie de UF ${fmt(pie)} y crédito hipotecario`,
  sinCredito: "Sin crédito hipotecario",
  conPreaprobacion: (banco: string | null, monto: number | null, hasta: string | null) =>
    `Con tu preaprobación${banco ? ` de ${/^banco/i.test(banco) ? banco : `Banco ${banco}`}` : ""}${monto ? ` por UF ${fmt(monto)}` : ""}${hasta ? `, vigente hasta el ${hasta}` : ""}`,
  preaprobacion: (banco: string | null, monto: number | null) =>
    `Preaprobación${banco ? ` de ${/^banco/i.test(banco) ? banco : `Banco ${banco}`}` : ""}${monto ? ` por UF ${fmt(monto)}` : ""}`,
  ver: "Ver",
  vigencia: "Vigencia",
  vigenciaTexto: "5 días desde que Franco la presenta",
  vigenciaS: "Mientras tanto no puedes ofertar por otro depto",
  documentoT: "Oferta de compra",
  documentoLinea: "El documento que vas a firmar",
  leer: "Leer",
  casilla: "Leí la oferta y estoy de acuerdo",
  firmar: (uf: number) => `Firmar mi oferta por UF ${fmt(uf)}`,
  firmando: "Firmando…",
  nota: "Firma electrónica simple. Queda en tus documentos.",
  error: "No pudimos firmar tu oferta. Inténtalo de nuevo.",
} as const;
