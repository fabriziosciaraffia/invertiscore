// ─────────────────────────────────────────────────────────────────────────────
// «PRONTO: INVIERTE CON FRANCO» (11-nov-2026, goal de Fabrizio; mockups docs/invierte-pronto-mockups/). Una inscripción por
// persona y depto que mide cuántos registrados quieren invertir con Franco ANTES de construir el servicio. Las reglas puras:
// isomorfo (lo usan el navegador, la ruta /api/invierte, el correo a hola@ y el tier INVIERTE-PRONTO).
//   · DÓNDE: la portada del informe (en lugar de la franja «Mandármelo por correo»), y como botón SECUNDARIO en la tarjeta de
//     Explorar (con y sin cuenta) y en la de la selección del dashboard, debajo de lo que la tarjeta ya tiene. «Analizar este»
//     sigue siendo la acción principal.
//   · EN USADOS Y NUEVOS DE INMOBILIARIA que dan ✓ Comprar o − Ajustar negociable (la capa «Si negocias»). Nunca en Buscar otro,
//     nunca en Ajustar no negociable, nunca en un depto cuya condición el aviso no dice (`puedeInvertir`). Los nuevos entraron el
//     12-nov-2026 (goal de Fabrizio), con la misma hoja y la misma confirmación; su correo a hola@ lleva «[NUEVO]».
//   · EL COPY ES EL DE LOS MOCKUPS, TAL CUAL: sin comisión, sin lista de servicios, sin precio y sin plazo prometido.
// ─────────────────────────────────────────────────────────────────────────────

/** ¿Cuándo piensas comprar? */
export type UrgenciaInvierte = "este_mes" | "uno_a_tres" | "mas_adelante";
/** ¿Tienes el pie? */
export type PieInvierte = "si" | "parte" | "no";
/** De dónde se inscribió. */
export type OrigenInvierte = "explorar" | "informe" | "seleccion";
export type EstadoInvierte = "nuevo" | "contactado" | "descartado";

export const URGENCIAS: readonly UrgenciaInvierte[] = ["este_mes", "uno_a_tres", "mas_adelante"];
export const PIES: readonly PieInvierte[] = ["si", "parte", "no"];
export const ORIGENES: readonly OrigenInvierte[] = ["explorar", "informe", "seleccion"];
export const ESTADOS: readonly EstadoInvierte[] = ["nuevo", "contactado", "descartado"];

/** El pie que se pregunta: 20 % del precio del depto. */
export const PIE_PREGUNTA_PCT = 20;

export const INVIERTE_COPY = {
  boton: "Invierte con Franco",
  pronto: "PRONTO",
  /** La franja de la portada del informe. */
  franja: {
    titulo: "¿Quieres invertir? Pronto Franco te acompaña.",
    texto: "Todo lo que Franco sabe de este depto, puesto a trabajar en tu inversión. Inscríbete y te avisamos.",
  },
  /** La hoja de inscripción. */
  hoja: {
    cabecera: "Invierte con Franco",
    titulo: "Invierte en este depto con Franco",
    parrafo: "Estamos preparando una forma nueva de invertir: todo lo que Franco sabe de este depto, puesto a trabajar en tu inversión, hasta el final. Inscríbete y sé de los primeros.",
    cuando: "¿Cuándo piensas comprar?",
    urgencias: { este_mes: "Este mes", uno_a_tres: "En 1 a 3 meses", mas_adelante: "Más adelante" } satisfies Record<UrgenciaInvierte, string>,
    pie: (uf: number | null) => (uf != null ? `¿Tienes el pie de UF ${Math.round(uf).toLocaleString("es-CL")}?` : "¿Tienes el pie?"),
    pieAclaracion: "20 % de este depto",
    pies: { si: "Sí", parte: "Una parte", no: "Todavía no" } satisfies Record<PieInvierte, string>,
    whatsapp: "Tu WhatsApp",
    whatsappPlaceholder: "+56 9 1234 5678",
    enviar: "Avísenme cuando pueda invertir en este depto",
    enviando: "Inscribiendo…",
    volver: "Volver",
    cerrar: "Cerrar",
    faltaCuando: "Elige cuándo piensas comprar.",
    faltaPie: "Elige si tienes el pie.",
    faltaWhatsapp: "Escribe un WhatsApp de Chile (+56 9 y 8 dígitos).",
    error: "No pudimos inscribirte. Intenta de nuevo.",
    /** Sin cuenta: la misma hoja sigue con el registro (el regalo de cuenta nueva se respeta). */
    sinCuenta: "Para inscribirte, crea tu cuenta en el paso siguiente.",
  },
  /** La confirmación, igual para todos. */
  listo: {
    titulo: "Listo, quedaste inscrito.",
    texto: "Te avisamos apenas puedas invertir en este depto con Franco.",
    sub: "Vas a ser de los primeros en saberlo.",
    queda: "En la tarjeta del depto queda",
    volverMapa: "Volver al mapa",
    cerrar: "Listo",
  },
  /** La etiqueta de la tarjeta de un depto inscrito. */
  inscrito: "Inscrito en Invierte con Franco",
} as const;

/** El depto de la inscripción, como lo dibuja la hoja (línea, precio y chip) y lo guarda la ruta. */
export interface DeptoInvierte {
  avisoId: string;
  /** «Ñuñoa · 2D2B · 58 m² · Usado» (linea-depto.ts). */
  linea: string;
  precioUF: number;
  /** El veredicto del chip: COMPRAR, o AJUSTA SUPUESTOS si es negociable. */
  veredicto: string;
  score: number | null;
  /** El informe de donde salió, si salió de uno. */
  analysisId?: string | null;
}

/**
 * ¿VA EL BOTÓN? Un usado o un nuevo de inmobiliaria que da ✓ Comprar, o − Ajustar con la negociación de la capa «Si negocias».
 * La condición la dice el aviso (`scraped_properties.condicion`); sin condición no va (no se supone). Hasta el 12-nov-2026 los
 * nuevos no iban.
 */
export function puedeInvertir(d: { condicion?: unknown; veredicto?: string | null; negociable?: boolean }): boolean {
  if (d.condicion !== "usado" && d.condicion !== "nuevo") return false;
  if (d.veredicto === "COMPRAR") return true;
  return d.veredicto === "AJUSTA SUPUESTOS" && d.negociable === true;
}

/** El pie que se pregunta, en UF enteras: el 20 % del precio publicado. null sin precio. */
export function pieDelDepto(precioUF: number | null | undefined): number | null {
  if (precioUF == null || !Number.isFinite(precioUF) || precioUF <= 0) return null;
  return Math.round((precioUF * PIE_PREGUNTA_PCT) / 100);
}

/** El WhatsApp normalizado a +569XXXXXXXX, o null si no es un móvil chileno. Acepta espacios, guiones y paréntesis, con o sin
 *  +56, con o sin el 9 inicial escrito como 09. */
export function normalizarWhatsapp(x: unknown): string | null {
  if (typeof x !== "string") return null;
  let d = x.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("56")) d = d.slice(2);
  if (d.startsWith("09")) d = d.slice(1);
  return /^9\d{8}$/.test(d) ? `+56${d}` : null;
}

export const esUrgencia = (x: unknown): x is UrgenciaInvierte => typeof x === "string" && (URGENCIAS as readonly string[]).includes(x);
export const esPie = (x: unknown): x is PieInvierte => typeof x === "string" && (PIES as readonly string[]).includes(x);
export const esOrigen = (x: unknown): x is OrigenInvierte => typeof x === "string" && (ORIGENES as readonly string[]).includes(x);
export const esEstado = (x: unknown): x is EstadoInvierte => typeof x === "string" && (ESTADOS as readonly string[]).includes(x);

export interface RespuestasInvierte {
  urgencia: UrgenciaInvierte;
  pie: PieInvierte;
  whatsapp: string;
}

/** Lo que la hoja manda y la ruta valida. Sin depto no hay inscripción. */
export interface PedidoInvierte extends RespuestasInvierte {
  avisoId: string;
  origen: OrigenInvierte;
  analysisId?: string | null;
}

export type ValidacionInvierte = { ok: true; pedido: PedidoInvierte } | { ok: false; error: "depto" | "cuando" | "pie" | "whatsapp" | "origen" };

const AVISO_ID = /^[A-Za-z0-9_-]{1,80}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida lo que llega (de la hoja o de la ruta). El primero que falta es el error. */
export function validarInscripcion(b: Record<string, unknown> | null | undefined): ValidacionInvierte {
  const x = b ?? {};
  const avisoId = typeof x.avisoId === "string" ? x.avisoId.trim() : "";
  if (!avisoId || !AVISO_ID.test(avisoId)) return { ok: false, error: "depto" };
  if (!esOrigen(x.origen)) return { ok: false, error: "origen" };
  if (!esUrgencia(x.urgencia)) return { ok: false, error: "cuando" };
  if (!esPie(x.pie)) return { ok: false, error: "pie" };
  const whatsapp = normalizarWhatsapp(x.whatsapp);
  if (!whatsapp) return { ok: false, error: "whatsapp" };
  const analysisId = typeof x.analysisId === "string" && UUID.test(x.analysisId) ? x.analysisId : null;
  return { ok: true, pedido: { avisoId, origen: x.origen, urgencia: x.urgencia, pie: x.pie, whatsapp, analysisId } };
}

/** El texto del error de la hoja. */
export function textoError(e: Exclude<ValidacionInvierte, { ok: true }>["error"] | "red"): string {
  if (e === "cuando") return INVIERTE_COPY.hoja.faltaCuando;
  if (e === "pie") return INVIERTE_COPY.hoja.faltaPie;
  if (e === "whatsapp") return INVIERTE_COPY.hoja.faltaWhatsapp;
  return INVIERTE_COPY.hoja.error;
}

/** El asunto del correo a hola@: las de «este mes» van marcadas al principio, para verlas primero en la bandeja; las de un nuevo de
 *  inmobiliaria, con «[NUEVO]» (12-nov-2026). */
export function asuntoInscripcion(p: { urgencia: UrgenciaInvierte; linea: string | null; precioUF: number | null; prueba?: boolean; condicion?: "nuevo" | "usado" }): string {
  const marca = `${p.urgencia === "este_mes" ? "[ESTE MES] " : ""}${p.condicion === "nuevo" ? "[NUEVO] " : ""}`;
  const depto = [p.linea, p.precioUF != null ? `UF ${Math.round(p.precioUF).toLocaleString("es-CL")}` : null].filter(Boolean).join(" · ") || "un depto";
  return `${p.prueba ? "[prueba] " : ""}${marca}Invierte con Franco: ${depto}`;
}

/**
 * La condición de una inscripción, leída de su línea guardada (12-nov-2026): `lineaDepto` termina en «· Nuevo» o «· Usado» cuando
 * el aviso la dice, y la ruta solo inscribe avisos con condición. null si la línea no la trae.
 */
export function condicionDeLinea(linea: string | null | undefined): "nuevo" | "usado" | null {
  const m = / · (Nuevo|Usado)$/.exec((linea ?? "").trim());
  return m ? (m[1] === "Nuevo" ? "nuevo" : "usado") : null;
}
export const esFiltroCondicion = (x: unknown): x is "nuevo" | "usado" => x === "nuevo" || x === "usado";

// ── LA MEDICIÓN ──────────────────────────────────────────────────────────────
export const EVENTOS_INVIERTE = {
  /** El botón se vio (una vez por depto y superficie en la carga). */
  ver: "invierte_ver",
  /** Tocó el botón: abrió la hoja. */
  abrir: "invierte_abrir",
  /** Se inscribió (del servidor, con la urgencia y el pie). */
  inscripcion: "invierte_inscripcion",
} as const;

// ── LO PENDIENTE DE QUIEN SE INSCRIBE SIN CUENTA ─────────────────────────────
// Sin cuenta, la hoja guarda lo contestado antes de pasar al registro; al volver con cuenta (el mismo navegador), Explorar lo
// manda y muestra la confirmación. Se COPIA antes y se BORRA después de que la ruta respondió bien (regla del repo).
export const CLAVE_PENDIENTE = "franco_invierte_pendiente";
/** Pasado esto, lo pendiente ya no se manda solo: se vuelve a preguntar. */
export const VIDA_PENDIENTE_MS = 24 * 60 * 60 * 1000;

export interface PendienteInvierte {
  pedido: PedidoInvierte;
  depto: DeptoInvierte;
  t: number;
}

type Almacen = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;

export function guardarPendiente(a: Almacen, p: Omit<PendienteInvierte, "t">, ahora: number = Date.now()): boolean {
  try {
    a?.setItem(CLAVE_PENDIENTE, JSON.stringify({ ...p, t: ahora }));
    return !!a;
  } catch {
    return false;
  }
}

/** Lo pendiente para ese depto, vigente; null si no hay, es de otro depto o venció. */
export function leerPendiente(a: Almacen, avisoId: string | null, ahora: number = Date.now()): PendienteInvierte | null {
  try {
    const raw = a?.getItem(CLAVE_PENDIENTE);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendienteInvierte;
    if (!p?.pedido || !p.depto || typeof p.t !== "number" || ahora - p.t > VIDA_PENDIENTE_MS) return null;
    if (avisoId && p.pedido.avisoId !== avisoId) return null;
    const v = validarInscripcion(p.pedido as unknown as Record<string, unknown>);
    return v.ok ? { ...p, pedido: v.pedido } : null;
  } catch {
    return null;
  }
}

export function borrarPendiente(a: Almacen): void {
  try {
    a?.removeItem(CLAVE_PENDIENTE);
  } catch {
    /* sin almacenamiento */
  }
}
