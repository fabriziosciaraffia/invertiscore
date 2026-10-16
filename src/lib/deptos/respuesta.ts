// ─────────────────────────────────────────────────────────────────────────────
// /deptos, la puerta B (16-oct-2026, decisiones de Fabrizio): una persona sin depto en la mira elige comuna, tipología y
// rango de precio, y Franco responde AL INSTANTE con la evaluación de la noche (sin calcular en vivo).
// LA RESPUESTA ES UN NÚMERO (16-oct-2026, segunda pasada: la única meta de la página es que dejen el correo): «29 de 1.008
// convienen como inversión», y debajo el detalle «Santiago · 2D · UF 3.000 a 4.000 · pie 20 %, 25 años». Con cero, con
// qué sí en una línea corta —con pie 30 %, o en qué comuna vecina— y aun así el registro: «te aviso cuando aparezca uno».
// La modalidad ya no se pregunta acá: va en «Estás dentro», con arriendo tradicional por defecto.
// Puro: lo prueba el tier PUERTA-B. Los conteos los trae la RPC `deptos_conteo` (mismo universo que el correo semanal)
// y la ruta GET /api/deptos/respuesta.
// ─────────────────────────────────────────────────────────────────────────────
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { PIE_DEPTOS, PLAZO_DEPTOS } from "./estandar";

export const MAX_COMUNAS_DEPTOS = 3;
/** Un correo que se entiende (el mismo criterio que /entrar y el ticket). */
export const CORREO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** La alternativa del cero va en UNA línea corta: nombra una sola comuna vecina. */
export const MAX_VECINAS_ALTERNATIVA = 1;

/**
 * LAS OCHO COMUNAS A LA VISTA (16-oct-2026): las más buscadas, medidas en los informes de todo el historial sin cuentas de
 * prueba —Santiago 262 (con «Santiago Centro»), Ñuñoa 206, Providencia 174, Las Condes 136, La Florida 79, Macul 60,
 * Vitacura 47, Peñalolén 40; la novena, San Miguel, 25—. Las demás, en el buscador de «Otra comuna…».
 */
export const COMUNAS_DESTACADAS = ["Santiago", "Ñuñoa", "Providencia", "Las Condes", "La Florida", "Macul", "Vitacura", "Peñalolén"] as const;

export interface RangoUf { id: string; min: number | null; max: number; chip: string; frase: string }
/**
 * CUATRO RANGOS (16-oct-2026): los cuartiles del precio de lo que la gente analiza (UF 2.950, 3.800 y 5.500, todo el
 * historial sin cuentas de prueba), redondeados.
 */
export const RANGOS_UF: readonly RangoUf[] = [
  { id: "hasta-3000", min: null, max: 3000, chip: "Hasta UF 3.000", frase: "hasta UF 3.000" },
  { id: "3000-4000", min: 3000, max: 4000, chip: "UF 3.000 a 4.000", frase: "entre UF 3.000 y 4.000" },
  { id: "4000-5500", min: 4000, max: 5500, chip: "UF 4.000 a 5.500", frase: "entre UF 4.000 y 5.500" },
  { id: "5500-mas", min: 5500, max: 60000, chip: "Más de UF 5.500", frase: "sobre UF 5.500" },
];

export interface TipologiaDeptos { id: string; dorms: number[]; chip: string; frase: string }
/** Una sola tipología, 2D por defecto (16-oct-2026). */
export const TIPOLOGIA_POR_DEFECTO = "2";
export const TIPOLOGIAS_DEPTOS: readonly TipologiaDeptos[] = [
  { id: "0", dorms: [0], chip: "Estudio", frase: "estudios" },
  { id: "1", dorms: [1], chip: "1D", frase: "1D" },
  { id: "2", dorms: [2], chip: "2D", frase: "2D" },
  { id: "3", dorms: [3], chip: "3D", frase: "3D" },
  { id: "4", dorms: [4, 5], chip: "4D o más", frase: "de 4 o más dormitorios" },
];

export type ModalidadDeptos = "ltr" | "str";
/** Se pregunta en «Estás dentro» (16-oct-2026), no en la pantalla de elegir. */
export const MODALIDADES_DEPTOS: ReadonlyArray<{ id: ModalidadDeptos; chip: string }> = [
  { id: "ltr", chip: "Arriendo tradicional" },
  { id: "str", chip: "Renta corta" },
];
export const MODALIDAD_POR_DEFECTO: ModalidadDeptos = "ltr";

export interface EleccionesDeptos {
  comunas: string[];
  tipologias: string[];
  rango: string;
  modalidad: ModalidadDeptos;
}

/** Lo elegido, validado: las comunas del Gran Santiago (hasta tres), al menos una tipología, un rango y la modalidad. */
export type Validacion =
  | { ok: true; comunas: string[]; dorms: number[]; tipologias: TipologiaDeptos[]; rango: RangoUf; modalidad: ModalidadDeptos }
  | { ok: false; error: "comunas" | "fuera" | "tipologia" | "rango"; fuera?: string };

const COMUNAS_OK = new Set<string>(COMUNAS_DISPONIBLES as readonly string[]);

export function validarElecciones(e: Partial<EleccionesDeptos>): Validacion {
  const comunas = Array.from(new Set((e.comunas ?? []).map((c) => String(c).trim()).filter(Boolean)));
  const fuera = comunas.find((c) => !COMUNAS_OK.has(c));
  if (fuera) return { ok: false, error: "fuera", fuera };
  if (comunas.length === 0 || comunas.length > MAX_COMUNAS_DEPTOS) return { ok: false, error: "comunas" };
  const tipologias = TIPOLOGIAS_DEPTOS.filter((t) => (e.tipologias ?? []).includes(t.id));
  if (tipologias.length === 0) return { ok: false, error: "tipologia" };
  const rango = RANGOS_UF.find((r) => r.id === e.rango);
  if (!rango) return { ok: false, error: "rango" };
  const modalidad: ModalidadDeptos = e.modalidad === "str" ? "str" : MODALIDAD_POR_DEFECTO;
  const dorms = Array.from(new Set(tipologias.flatMap((t) => t.dorms))).sort((a, b) => a - b);
  return { ok: true, comunas, dorms, tipologias, rango, modalidad };
}

/** Lo que trae la RPC `deptos_conteo` por comuna. */
export interface ConteoComuna { comuna: string; total: number; comprar20: number; comprar30: number }

export interface RespuestaDeptos {
  total: number;
  /** Los que convienen con el estándar (pie 20 %, 25 años). */
  convienen: number;
  /** El número: «29 de 1.008». null si esta semana no hubo avisos así. */
  cifra: string | null;
  /** «29 de 1.008 convienen como inversión»; sin avisos, «Ninguno publicado así esta semana». */
  titular: string;
  /** «Santiago · 2D · UF 3.000 a 4.000 · pie 20 %, 25 años», chico y en gris debajo del número. */
  detalle: string;
  /** Con cero: con qué sí, en una línea corta. null si no es cero. */
  alternativa: string | null;
  conPie30: number | null;
  vecinas: Array<{ comuna: string; convienen: number }>;
  /** La invitación a registrarse, pegada al número, con o sin deptos. */
  registro: string;
}

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
export const lista = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const siConvienen = (n: number) => `${miles(n)} sí ${n === 1 ? "conviene" : "convienen"}`;

export const DEPTOS_COPY = {
  titular: "Cada semana, los deptos que convienen",
  /** En una línea, también en el teléfono. */
  bajada: "Elige y Franco te dice cuántos convienen hoy.",
  comuna: "Comuna",
  comunaAyuda: `Hasta ${MAX_COMUNAS_DEPTOS}`,
  otraComuna: "Otra comuna…",
  buscar: "Busca tu comuna",
  fuera: "Por ahora solo Gran Santiago.",
  tipologia: "Tipología",
  rango: "Rango de precio",
  conRegistro: "Regístrate y te los mando hoy",
  sinDeptos: "Regístrate y te aviso cuando aparezca uno",
  /** Debajo del botón, siempre. */
  sinContrasena: "Te mandamos un código. Sin contraseña.",
  /** Después de pedir el código: EL MISMO MENSAJE exista o no la cuenta (16-oct-2026, decisión de Fabrizio). */
  enviado: (correo: string) => `Te mandamos un código a ${correo}. Escríbelo acá.`,
  tope: `Hasta ${MAX_COMUNAS_DEPTOS} comunas.`,
} as const;

/**
 * La respuesta de /deptos. `propias`: los conteos de sus comunas; `vecinas`: los de las comunas vecinas (sin las suyas),
 * para la alternativa del cero.
 */
export function respuestaDeptos(
  v: Extract<Validacion, { ok: true }>,
  propias: ConteoComuna[],
  vecinas: ConteoComuna[],
): RespuestaDeptos {
  const enSus = propias.filter((c) => v.comunas.includes(c.comuna));
  const total = enSus.reduce((s, c) => s + c.total, 0);
  const convienen = enSus.reduce((s, c) => s + c.comprar20, 0);
  const detalle = [lista(v.comunas), v.tipologias.map((t) => t.chip).join(" y "), v.rango.chip, `pie ${PIE_DEPTOS} %, ${PLAZO_DEPTOS} años`].join(" · ");
  const cifra = total > 0 ? `${miles(convienen)} de ${miles(total)}` : null;
  const titular = cifra ? `${cifra} ${convienen === 1 ? "conviene" : "convienen"} como inversión` : "Ninguno publicado así esta semana";
  if (convienen > 0) {
    return { total, convienen, cifra, titular, detalle, alternativa: null, conPie30: null, vecinas: [], registro: DEPTOS_COPY.conRegistro };
  }
  // EL CERO CON ALTERNATIVA, en una línea: con qué pie sí (30 %, en sus mismas comunas) o, si no, en qué comuna vecina.
  const conPie30 = enSus.reduce((s, c) => s + c.comprar30, 0);
  const vecinasQueDan = vecinas
    .filter((c) => !v.comunas.includes(c.comuna) && c.comprar20 > 0)
    .sort((a, b) => b.comprar20 - a.comprar20 || a.comuna.localeCompare(b.comuna))
    .slice(0, MAX_VECINAS_ALTERNATIVA)
    .map((c) => ({ comuna: c.comuna, convienen: c.comprar20 }));
  const alternativa = conPie30 > 0 ? `Con pie 30 %, ${siConvienen(conPie30)}.`
    : vecinasQueDan[0] ? `En ${vecinasQueDan[0].comuna}, comuna vecina, ${siConvienen(vecinasQueDan[0].convienen)}.`
    : "Tampoco con pie 30 % ni en comunas vecinas.";
  return { total, convienen: 0, cifra, titular, detalle, alternativa, conPie30, vecinas: vecinasQueDan, registro: DEPTOS_COPY.sinDeptos };
}

/** El perfil manual con que nace la cuenta (columnas de `perfil_busqueda`): los chips, con pie 20 % y 25 años. */
export function perfilManualDeElecciones(v: Extract<Validacion, { ok: true }>): Record<string, unknown> {
  return {
    comunas: v.comunas,
    dormitorios: v.dorms,
    precio_min_uf: v.rango.min,
    precio_max_uf: v.rango.max,
    modalidad: v.modalidad,
    pie_pct: PIE_DEPTOS,
    plazo_anios: PLAZO_DEPTOS,
  };
}

/**
 * LA CUENTA INSTANTÁNEA (16-oct-2026): ¿esta entrada creó la cuenta, o el correo ya la tenía? Nueva solo si, cuando pidió
 * el código, el correo NO tenía cuenta y la cuenta nació después de ese pedido (con un minuto de holgura por relojes).
 * Una cuenta que ya existía no se duplica ni se pisa su perfil: se le pregunta si agrega las comunas.
 */
export function tipoDeAlta(p: { existiaAlPedir: boolean; cuentaCreadaAt: string | null | undefined; pedidoAt: string }): "nueva" | "existente" {
  if (p.existiaAlPedir || !p.cuentaCreadaAt) return "existente";
  return Date.parse(p.cuentaCreadaAt) >= Date.parse(p.pedidoAt) - 60_000 ? "nueva" : "existente";
}

/** Tope de comunas del perfil (validarCambiosPerfil): al agregar las de /deptos no se pasa. */
export const MAX_COMUNAS_PERFIL = 8;

/** Las comunas elegidas en /deptos que su perfil todavía no tiene, sin pasar el tope del perfil. */
export function comunasParaAgregar(actuales: string[], elegidas: string[]): string[] {
  const nuevas = elegidas.filter((c) => !actuales.includes(c));
  return nuevas.slice(0, Math.max(0, MAX_COMUNAS_PERFIL - actuales.length));
}

export const ALTA_COPY = {
  agregar: (comunas: string[]) => `¿Agregamos ${lista(comunas)} a tu perfil de búsqueda?`,
  agregarSi: "Sí, agregar",
  agregarNo: "No, dejarlo como está",
  agregado: "Listo, quedó en tu perfil.",
  correo: "Tu correo",
  pedir: "Quiero recibirlos",
  error: "No pudimos seguir. Intenta de nuevo.",
} as const;
