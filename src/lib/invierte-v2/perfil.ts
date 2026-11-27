// ─────────────────────────────────────────────────────────────────────────────
// EL PERFIL DE INVERSIÓN (Invierte con Franco, etapa 2, 18-nov-2026; láminas 3.1). Puro e isomorfo: lo usan el formulario
// (navegador), la ruta que lo guarda y el tier.
//   · Paso 1, «Qué buscas»: confirma, no pregunta de cero. Las comunas vienen marcadas (la del depto con que entró, después las
//     de su perfil guardado); se pregunta qué busca y qué le preocupa.
//   · Paso 2, «Tu financiamiento»: parte por si tiene un crédito preaprobado. Con preaprobación basta el monto (y si tiene el
//     pie); sin ella, pie, renta líquida y otras cuotas, o «Prefiero no decir mi renta».
//   · HASTA CUÁNTO PUEDE COMPRAR (hastaCuanto): función pura, con sus supuestos guardados junto al resultado. En pantalla nunca
//     es el titular: va como segunda línea.
// Es UN solo perfil: al confirmar, las comunas y el tope se escriben también en perfil_busqueda (el de la selección semanal).
// ─────────────────────────────────────────────────────────────────────────────

import { CAMINOS, CARGA_MAX_PCT, DIVIDENDO_MAX_PCT, PLAZO_MAX, VERSION_REGLA, creditoPorRentaRegla, pieNecesarioUF, topesDeCompra, type TipoRenta } from "@/lib/tope/regla";
export const OBJETIVOS = ["arriendo", "plusvalia", "ambas"] as const;
export type Objetivo = (typeof OBJETIVOS)[number];
export const PREOCUPACIONES = ["no_arriende", "poner_plata", "elegir_mal", "tramite"] as const;
export type Preocupacion = (typeof PREOCUPACIONES)[number];
export const PREAPROBADOS = ["tengo", "tramite", "no"] as const;
export type Preaprobado = (typeof PREAPROBADOS)[number];
/** «¿Dónde buscamos?» (láminas del 19-nov-2026; columna inv_perfiles.donde, por defecto «cerca»). */
export const DONDES = ["cerca", "comuna", "convenga"] as const;
export type Donde = (typeof DONDES)[number];
export const PIES_TIENE = ["si", "parte", "no"] as const;
export type PieTiene = (typeof PIES_TIENE)[number];

export const PERFIL_COPY = {
  titulo: "Tu perfil de inversión",
  paso1: "Paso 1 de 2 · Qué buscas",
  paso2: "Paso 2 de 2 · Tu financiamiento",
  p1: {
    titulo: "Esto es lo que sabemos de lo que buscas",
    linea: "Confirma o corrige. Con esto elegimos tus opciones.",
    /** La primera vez, al caer directo desde la firma (lámina 3.1-perfil-paso1 del 19-nov-2026). */
    tituloPrimera: (nombre: string | null) => (nombre ? `Partimos, ${nombre}. ¿Qué buscas?` : "Partimos. ¿Qué buscas?"),
    lineaPrimera: "Dos minutos. Con esto te mostramos las mejores opciones.",
    comunas: "Comunas",
    /** «¿Dónde buscamos?» reemplaza a «Comunas» (lámina 3.1-perfil-paso1 del 19-nov-2026); viene marcado «Cerca de este». */
    donde: "¿Dónde buscamos?",
    dondes: { cerca: "Cerca de este", comuna: "En toda la comuna", convenga: "Donde más convenga" } as Record<Donde, string>,
    dondeLinea: (d: Donde, comuna: string | null) =>
      d === "cerca" ? (comuna ? `Cerca del depto que elegiste en ${comuna}, y parecidos en tamaño.` : "Cerca del depto que elegiste, y parecidos en tamaño.")
      : d === "comuna" ? (comuna ? `En toda ${comuna}, y parecidos en tamaño.` : "En toda la comuna del depto que elegiste, y parecidos en tamaño.")
      : "En todas las comunas, donde más convenga, y parecidos en tamaño.",
    otra: "Otra",
    otraPlaceholder: "Escribe una comuna",
    porDepto: (c: string) => `${c}, por el depto que elegiste.`,
    dePerfil: (cs: string[]) => `${cs.join(", ")}, de tu perfil.`,
    objetivo: "¿Qué buscas con tu inversión?",
    objetivos: { arriendo: "Arriendo mes a mes", plusvalia: "Plusvalía", ambas: "Las dos" } as Record<Objetivo, string>,
    preocupa: "¿Qué es lo que más te preocupa?",
    preocupaciones: { no_arriende: "Que no se arriende", poner_plata: "Poner plata cada mes", elegir_mal: "Elegir mal", tramite: "El trámite" } as Record<Preocupacion, string>,
    continuar: "Continuar",
  },
  p2: {
    titulo: "¿Cómo vas a financiar?",
    preaprobado: "¿Tienes un crédito preaprobado?",
    preaprobados: { tengo: "Tengo", tramite: "En trámite", no: "No tengo" } as Record<Preaprobado, string>,
    monto: "Monto preaprobado",
    montoAclara: "el crédito que te aprobó el banco",
    conCredito: (topeUF: string, pieUF: string) => `Con ese crédito puedes comprar hasta UF ${topeUF}, con un pie de UF ${pieUF}.`,
    tienePie: "¿Tienes ese pie?",
    piesTiene: { si: "Sí", parte: "Una parte", no: "Todavía no" } as Record<PieTiene, string>,
    pieParte: "¿Cuánto tienes de pie?",
    pie: "Pie disponible",
    /** Debajo del pie, solo si en el contacto dijo que lo tiene (20-nov-2026); nunca llena el campo. */
    // Con los gastos de la compra (27-nov-2026): el pie del 20 % más el 4,4 % de gastos.
    pieAyuda: (x: string) => `Para el depto que elegiste necesitas UF ${x} (20 % de pie más gastos).`,
    pieNoSe: "Todavía no sé",
    renta: "Renta líquida al mes",
    rentaAclara: "La usamos solo para estimar qué deptos te alcanzan. No se comparte con nadie.",
    cuotas: "Otras cuotas al mes",
    cuotasAclara: "créditos, tarjetas, otro dividendo",
    noDecir: "Prefiero no decir mi renta",
    noDecirNota: "Sin tu renta estimamos solo con tu pie. Es menos preciso.",
    verOpciones: "Ver mis opciones",
    volver: "Volver",
    enviando: "Buscando…",
  },
  errores: {
    comunas: "Marca al menos una comuna.",
    objetivo: "Elige qué buscas con tu inversión.",
    preaprobado: "Dinos si tienes un crédito preaprobado.",
    monto: "Escribe el monto preaprobado, en UF.",
    pieTiene: "Dinos si tienes ese pie.",
    pie: "Escribe tu pie, en UF, o marca «Todavía no sé».",
    pieNoSabe: "Sin tu pie, necesitamos tu renta para estimar hasta cuánto puedes comprar.",
    renta: "Escribe tu renta líquida al mes, o marca «Prefiero no decir mi renta».",
    red: "No pudimos guardar tu perfil. Intenta de nuevo.",
  },
} as const;

// ── LA REGLA DE HASTA CUÁNTO (versión 2, 27-nov-2026) ──────────────────────────
// UNA SOLA CUENTA con la asesoría en el mapa (decisión de Fabrizio): la de src/lib/tope/regla.ts. Lo nuevo de la versión 2: los gastos
// de la compra (4,4 % en un usado) entran en los dos topes —por pie, pie ÷ 24,4 %; por renta, (pie + crédito) ÷ 1,044—, y el plazo y
// la forma de recibir la renta salen del perfil de la asesoría cuando lo hay (plazo por edad; boletas al 70 % y carga 35 %). Sin
// ellos, 30 años y contrato, como antes.
export const REGLA_TOPE = {
  version: VERSION_REGLA,
  piePct: CAMINOS.usado.piePct,          // el pie mínimo: el banco financia el 80 %
  gastosPct: CAMINOS.usado.gastosPct,    // los gastos de la compra (trámites del crédito y comisión de Franco)
  dividendoMaxPct: DIVIDENDO_MAX_PCT,    // el dividendo no pasa del 25 % de la renta computable
  cargaMaxPct: CARGA_MAX_PCT.contrato,   // dividendo + otras cuotas no pasan del 40 % (35 % con boletas)
  plazoAnios: PLAZO_MAX,                 // sin la edad, 30 años
} as const;

export type FuenteTope = "renta" | "solo_pie" | "preaprobacion" | "aprobada";
/** Qué deja el tope donde está: el pie, o el crédito (la renta o el monto que aprobó el banco). */
export type Limita = "pie" | "credito" | null;

export interface EntradaTope {
  preaprobado: Preaprobado;
  montoPreaprobadoUF?: number | null;
  pieTiene?: PieTiene | null;
  pieUF?: number | null;
  rentaCLP?: number | null;
  otrasCuotasCLP?: number | null;
  noDiceRenta?: boolean;
  /** «Todavía no sé» mi pie (20-nov-2026): se calcula solo por la renta, suponiendo un pie de 20 %. */
  pieNoSabe?: boolean;
  /** Tasa anual del motor, en % (config.tasa_hipotecaria). */
  tasaPct: number;
  /** UF del día, en pesos. */
  uf: number;
  /** Monto de la preaprobación APROBADA por Franco: reemplaza la estimación. */
  aprobadaUF?: number | null;
  /** Del perfil de la asesoría (27-nov-2026): el plazo que la edad permite y cómo recibe la renta. Sin ellos, 30 años y contrato. */
  plazoAnios?: number | null;
  tipoRenta?: TipoRenta | null;
}

export interface Tope {
  topeUF: number;
  fuente: FuenteTope;
  limita: Limita;
  /** Hasta cuánto alcanza el pie solo, contando los gastos (pie ÷ 24,4 %). */
  porPieUF: number;
  /** El crédito: el que alcanza la renta, o el preaprobado. Null sin renta. */
  creditoUF: number | null;
  menosPreciso: boolean;
  supuestos: { version: number; piePct: number; gastosPct: number; dividendoMaxPct: number; cargaMaxPct: number; plazoAnios: number; tasaPct: number; uf: number; tipoRenta?: TipoRenta; /** «Todavía no sé» mi pie (20-nov-2026). */ pieNoSabe?: boolean };
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** El crédito que cabe en la renta (la regla única: dividendo ≤ 25 % de la renta computable y dividendo + otras cuotas ≤ la carga
 *  máxima, al plazo dado —30 años si no se sabe la edad— con la tasa del motor y sin seguros). En UF. */
export function creditoPorRenta(rentaCLP: number, otrasCuotasCLP: number, tasaPct: number, uf: number, o: { plazoAnios?: number | null; tipoRenta?: TipoRenta | null } = {}): number {
  return creditoPorRentaRegla({ rentaCLP, otrasCuotasCLP, tasaPct, uf, plazoAnios: o.plazoAnios ?? PLAZO_MAX, tipoRenta: o.tipoRenta ?? "contrato" }).creditoUF;
}

export function hastaCuanto(e: EntradaTope): Tope {
  const plazo = e.plazoAnios ?? PLAZO_MAX;
  const tipo = e.tipoRenta ?? "contrato";
  const supuestos = { version: REGLA_TOPE.version, piePct: REGLA_TOPE.piePct, gastosPct: REGLA_TOPE.gastosPct, dividendoMaxPct: REGLA_TOPE.dividendoMaxPct, cargaMaxPct: CARGA_MAX_PCT[tipo], plazoAnios: plazo, tasaPct: e.tasaPct, uf: e.uf, ...(e.tipoRenta ? { tipoRenta: tipo } : {}) };
  const fraccionPie = REGLA_TOPE.piePct / 100;
  const pie = Math.max(0, e.pieUF ?? 0);
  const monto = e.aprobadaUF ?? (e.preaprobado === "tengo" ? e.montoPreaprobadoUF ?? null : null);
  if (monto != null && monto > 0) {
    const fuente: FuenteTope = e.aprobadaUF ? "aprobada" : "preaprobacion";
    // El banco financia el 80 %: con el pie completo (pie y gastos cubiertos), monto ÷ 0,8; con una parte, la regla única con el
    // monto del banco como crédito (el menor entre pie ÷ 24,4 % y (pie + monto) ÷ 1,044).
    if (e.pieTiene === "si") return { topeUF: r2(monto / (1 - fraccionPie)), fuente, limita: null, porPieUF: r2(monto / (1 - fraccionPie)), creditoUF: r2(monto), menosPreciso: false, supuestos };
    // Sin la pregunta «¿tienes ese pie?» (quien entró por la renta y después le aprobaron la preaprobación, entrega 3) cuenta el
    // pie que declaró; con «Todavía no», cero.
    const pieReal = e.pieTiene === "parte" || (e.pieTiene == null && e.pieUF != null) ? pie : 0;
    const t = topesDeCompra({ pieUF: pieReal, creditoUF: monto });
    return { topeUF: r2(t.topeUF), fuente, limita: t.limita === "pie" ? "pie" : "credito", porPieUF: r2(t.topePieUF ?? 0), creditoUF: r2(monto), menosPreciso: false, supuestos };
  }
  // «Todavía no sé» mi pie (decisión de Fabrizio, 20-nov-2026): solo por la renta, con un pie de 20 % (el crédito es el 80 %).
  if (e.pieNoSabe && !e.noDiceRenta && e.rentaCLP && e.rentaCLP > 0) {
    const credito = creditoPorRenta(e.rentaCLP, e.otrasCuotasCLP ?? 0, e.tasaPct, e.uf, { plazoAnios: plazo, tipoRenta: tipo });
    const t = topesDeCompra({ pieUF: null, creditoUF: credito });
    return { topeUF: r2(t.topeUF), fuente: "renta", limita: "credito", porPieUF: r2(t.topeUF), creditoUF: r2(credito), menosPreciso: true, supuestos: { ...supuestos, pieNoSabe: true } };
  }
  if (e.noDiceRenta || !e.rentaCLP || e.rentaCLP <= 0) {
    const t = topesDeCompra({ pieUF: pie, creditoUF: null });
    return { topeUF: r2(t.topeUF), fuente: "solo_pie", limita: "pie", porPieUF: r2(t.topePieUF ?? 0), creditoUF: null, menosPreciso: true, supuestos };
  }
  const credito = creditoPorRenta(e.rentaCLP, e.otrasCuotasCLP ?? 0, e.tasaPct, e.uf, { plazoAnios: plazo, tipoRenta: tipo });
  const t = topesDeCompra({ pieUF: pie, creditoUF: credito });
  return { topeUF: r2(t.topeUF), fuente: "renta", limita: t.limita === "pie" ? "pie" : "credito", porPieUF: r2(t.topePieUF ?? 0), creditoUF: r2(credito), menosPreciso: false, supuestos };
}

/** La segunda línea bajo el resultado (nunca el titular). Según qué limita (decisión de Fabrizio, 20-nov-2026): sin el pie, por la
 *  renta con un pie de 20 %; si limita el pie que escribió, lo dice y cuánto le prestaría el banco; si limita la renta, como antes. */
export function lineaTope(t: Pick<Tope, "topeUF" | "fuente"> & { limita?: Tope["limita"]; creditoUF?: number | null; pieUF?: number | null; pieNoSabe?: boolean }, fmtUF: (n: number) => string): string {
  if (t.fuente === "preaprobacion" || t.fuente === "aprobada") return `Según tu preaprobación, puedes comprar hasta UF ${fmtUF(t.topeUF)}. Sujeto a evaluación del banco.`;
  if (t.fuente === "solo_pie") return `Con tu pie, estimamos que puedes comprar hasta UF ${fmtUF(t.topeUF)}. Sin tu renta es menos preciso. Sujeto a evaluación del banco.`;
  if (t.pieNoSabe && t.creditoUF != null) return `Por tu renta, el banco podría prestarte hasta UF ${fmtUF(t.creditoUF)}. Con un pie de 20 % más gastos podrías comprar hasta UF ${fmtUF(t.topeUF)}. Dinos tu pie para afinarlo.`;
  if (t.limita === "pie" && t.pieUF != null && t.creditoUF != null) return `Con tu pie de UF ${fmtUF(t.pieUF)} puedes comprar hasta UF ${fmtUF(t.topeUF)}. Por tu renta, el banco podría prestarte hasta UF ${fmtUF(t.creditoUF)}: con más pie te alcanzan deptos más grandes.`;
  return `Con tu pie y tu renta, estimamos que puedes comprar hasta UF ${fmtUF(t.topeUF)}. Sujeto a evaluación del banco.`;
}

// ── LO QUE SE PRECARGA ───────────────────────────────────────────────────────
/** Las comunas marcadas: primero la del depto con que entró, después las de su perfil guardado; sin repetir. */
export function comunasPrecargadas(comunaEntrada: string | null, delPerfil: readonly string[]): { comunas: string[]; deEntrada: string | null; dePerfil: string[] } {
  const visto = new Set<string>();
  const comunas: string[] = [];
  const agregar = (c: string | null | undefined) => { const x = (c ?? "").trim(); if (x && !visto.has(x.toLowerCase())) { visto.add(x.toLowerCase()); comunas.push(x); } };
  agregar(comunaEntrada);
  for (const c of delPerfil) agregar(c);
  const deEntrada = comunaEntrada?.trim() || null;
  return { comunas, deEntrada, dePerfil: comunas.filter((c) => c !== deEntrada) };
}

/** LA AYUDA DEL PIE (20-nov-2026): si en el contacto dijo que tiene el pie, debajo del campo «Para el depto que elegiste necesitas
 *  UF X (20 %)». NUNCA llena el campo: en el perfil solo se llena lo que la persona dijo antes, y nada financiero se deduce del
 *  depto (decisión de Fabrizio: el pie deducido del depto hacía que el tope fuera su precio, y el cálculo daba vueltas en círculo). */
export function ayudaPie(respuestaContacto: string | null, precioEntradaUF: number | null): number | null {
  return respuestaContacto === "si" && precioEntradaUF ? Math.round(pieNecesarioUF(precioEntradaUF)) : null;
}

// ── LA VALIDACIÓN (la ruta vuelve a exigir todo) ─────────────────────────────
export interface PedidoPerfil {
  comunas: string[];
  /** «Todavía no sé» mi pie (20-nov-2026): sin pie, solo por la renta con un pie de 20 %. */
  pieNoSabe?: boolean;
  /** «¿Dónde buscamos?» (láminas del 19-nov-2026): reemplaza a la pregunta de comunas. Las comunas siguen, derivadas (la del
   *  depto con que entró), para el perfil de la selección semanal. */
  donde: Donde;
  objetivo: Objetivo;
  preocupaciones: Preocupacion[];
  preaprobado: Preaprobado;
  montoPreaprobadoUF: number | null;
  pieTiene: PieTiene | null;
  pieUF: number | null;
  rentaCLP: number | null;
  otrasCuotasCLP: number | null;
  noDiceRenta: boolean;
}
export type ErrorPerfil = keyof typeof PERFIL_COPY.errores;

const num = (x: unknown): number | null => {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") { const n = Number(x.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")); return x.trim() && Number.isFinite(n) ? n : null; }
  return null;
};

export function validarPerfil(b: Record<string, unknown> | null | undefined): { ok: true; pedido: PedidoPerfil } | { ok: false; error: ErrorPerfil } {
  const x = b ?? {};
  const comunas = Array.isArray(x.comunas) ? Array.from(new Set(x.comunas.filter((c): c is string => typeof c === "string" && c.trim().length > 1 && c.length <= 60).map((c) => c.trim()))).slice(0, 12) : [];
  if (!comunas.length) return { ok: false, error: "comunas" };
  const donde: Donde = (DONDES as readonly unknown[]).includes(x.donde) ? (x.donde as Donde) : "cerca";
  if (!(OBJETIVOS as readonly unknown[]).includes(x.objetivo)) return { ok: false, error: "objetivo" };
  const preocupaciones = Array.isArray(x.preocupaciones) ? x.preocupaciones.filter((p): p is Preocupacion => (PREOCUPACIONES as readonly unknown[]).includes(p)) : [];
  if (!(PREAPROBADOS as readonly unknown[]).includes(x.preaprobado)) return { ok: false, error: "preaprobado" };
  const preaprobado = x.preaprobado as Preaprobado;
  const pieUF = num(x.pieUF);
  if (preaprobado === "tengo") {
    const monto = num(x.montoPreaprobadoUF);
    if (!monto || monto <= 0 || monto > 100000) return { ok: false, error: "monto" };
    if (!(PIES_TIENE as readonly unknown[]).includes(x.pieTiene)) return { ok: false, error: "pieTiene" };
    const pieTiene = x.pieTiene as PieTiene;
    if (pieTiene === "parte" && (pieUF == null || pieUF <= 0)) return { ok: false, error: "pie" };
    return { ok: true, pedido: { comunas, donde, objetivo: x.objetivo as Objetivo, preocupaciones, preaprobado, montoPreaprobadoUF: monto, pieTiene, pieUF: pieTiene === "parte" ? pieUF : null, rentaCLP: null, otrasCuotasCLP: null, noDiceRenta: false } };
  }
  // El pie es obligatorio (lo escribe la persona), salvo «Todavía no sé», que entonces exige la renta.
  const pieNoSabe = x.pieNoSabe === true;
  if (!pieNoSabe && (pieUF == null || pieUF < 0 || pieUF > 100000)) return { ok: false, error: "pie" };
  const noDiceRenta = x.noDiceRenta === true;
  const renta = num(x.rentaCLP);
  if (pieNoSabe && (noDiceRenta || !renta || renta <= 0)) return { ok: false, error: "pieNoSabe" };
  if (!noDiceRenta && (!renta || renta <= 0)) return { ok: false, error: "renta" };
  const cuotas = num(x.otrasCuotasCLP);
  return { ok: true, pedido: { comunas, donde, objetivo: x.objetivo as Objetivo, preocupaciones, preaprobado, montoPreaprobadoUF: null, pieTiene: null, pieUF: pieNoSabe ? null : pieUF, pieNoSabe, rentaCLP: noDiceRenta ? null : Math.round(renta!), otrasCuotasCLP: noDiceRenta ? null : Math.max(0, Math.round(cuotas ?? 0)), noDiceRenta } };
}

/** Al dibujar un texto con porcentajes, el «%» no queda solo en la línea siguiente (20-nov-2026: «(20 %)» se cortaba a 360 px).
 *  Cambia el espacio antes de «%» por uno que no se corta; el texto guardado y el que fija el tier no cambian. */
export const sinCortar = (t: string): string => t.replace(/ %/g, " %");

/** En el admin, ficha del comprador (20-nov-2026, Fabrizio): qué limita su tope, igual que el resultado. Antes decía «con su renta» también
 *  cuando lo limitaba el pie. */
export function porQueTopeAdmin(p: { topeFuente: string | null; pieUF: number | null; topeSupuestos: Record<string, unknown> | null }, fmt: (n: number) => string): string {
  const s = p.topeSupuestos ?? {};
  const credito = typeof s.creditoUF === "number" ? s.creditoUF : null;
  if (p.topeFuente === "aprobada") return "según su preaprobación aprobada";
  if (p.topeFuente === "preaprobacion") return "con su preaprobación";
  if (s.pieNoSabe === true) return `por su renta, con un pie supuesto de 20 % (no sabe su pie)${credito ? `; el banco le prestaría hasta UF ${fmt(credito)}` : ""}`;
  if (p.topeFuente === "solo_pie") return "solo con el pie (sin renta)";
  if (s.limita === "pie") return `lo limita su pie${p.pieUF != null ? ` (UF ${fmt(p.pieUF)})` : ""}${credito ? `; por su renta, el banco le prestaría hasta UF ${fmt(credito)}` : ""}`;
  if (s.limita === "credito") return `lo limita su renta${credito ? ` (el banco le prestaría hasta UF ${fmt(credito)})` : ""}`;
  return p.topeFuente === "renta" ? "con su pie y su renta" : "";
}
