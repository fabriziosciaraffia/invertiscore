// ─────────────────────────────────────────────────────────────────────────────
// /deptos, la puerta B (16-oct-2026, decisiones de Fabrizio): una persona sin depto en la mira elige comuna, tipología,
// rango de precio y modalidad, y Franco responde AL INSTANTE con la evaluación de la noche (sin calcular en vivo):
// «En Ñuñoa, de 143 deptos 2D entre UF 3.000 y 4.000, 17 convienen como inversión con pie 20 % y 25 años.»
// Si da cero, dice con qué sí —con pie 30 %, o en qué comuna vecina— y aun así ofrece registrarse: «te aviso cuando
// aparezca uno». Puro: lo prueba el tier PUERTA-B. Los conteos los trae la RPC `deptos_conteo` (mismo universo que
// el correo semanal) y la ruta GET /api/deptos/respuesta.
// ─────────────────────────────────────────────────────────────────────────────
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { PIE_DEPTOS, PLAZO_DEPTOS } from "./estandar";

export const MAX_COMUNAS_DEPTOS = 3;
/** Un correo que se entiende (el mismo criterio que /entrar y el ticket). */
export const CORREO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Hasta cuántas comunas vecinas nombra la alternativa. */
export const MAX_VECINAS_ALTERNATIVA = 2;

export interface RangoUf { id: string; min: number | null; max: number; chip: string; frase: string }
/** Los rangos de precio en UF (los cortes siguen la distribución de los avisos: la mitad está bajo UF 3.000). */
export const RANGOS_UF: readonly RangoUf[] = [
  { id: "hasta-2000", min: null, max: 2000, chip: "Hasta UF 2.000", frase: "hasta UF 2.000" },
  { id: "2000-3000", min: 2000, max: 3000, chip: "UF 2.000 a 3.000", frase: "entre UF 2.000 y 3.000" },
  { id: "3000-4000", min: 3000, max: 4000, chip: "UF 3.000 a 4.000", frase: "entre UF 3.000 y 4.000" },
  { id: "4000-5500", min: 4000, max: 5500, chip: "UF 4.000 a 5.500", frase: "entre UF 4.000 y 5.500" },
  { id: "5500-8000", min: 5500, max: 8000, chip: "UF 5.500 a 8.000", frase: "entre UF 5.500 y 8.000" },
  { id: "8000-12000", min: 8000, max: 12000, chip: "UF 8.000 a 12.000", frase: "entre UF 8.000 y 12.000" },
  { id: "12000-mas", min: 12000, max: 60000, chip: "Más de UF 12.000", frase: "sobre UF 12.000" },
];

export interface TipologiaDeptos { id: string; dorms: number[]; chip: string; frase: string }
export const TIPOLOGIAS_DEPTOS: readonly TipologiaDeptos[] = [
  { id: "0", dorms: [0], chip: "Estudio", frase: "estudios" },
  { id: "1", dorms: [1], chip: "1D", frase: "1D" },
  { id: "2", dorms: [2], chip: "2D", frase: "2D" },
  { id: "3", dorms: [3], chip: "3D", frase: "3D" },
  { id: "4", dorms: [4, 5], chip: "4D o más", frase: "de 4 o más dormitorios" },
];

export type ModalidadDeptos = "ltr" | "str";
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
  frase: string;
  /** Con cero: con qué sí (pie 30 % o una comuna vecina), o que tampoco así. null si no es cero. */
  alternativa: string | null;
  conPie30: number | null;
  vecinas: Array<{ comuna: string; convienen: number }>;
  /** La invitación a registrarse, con o sin deptos. */
  registro: string;
  /** Renta corta: cómo se calcula (no hay veredicto de la noche para renta corta). */
  notaModalidad: string | null;
}

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
export const lista = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const convienenTexto = (n: number) => (n === 1 ? "1 conviene" : `${miles(n)} convienen`);
const deptosTexto = (n: number) => (n === 1 ? "1 depto" : `${miles(n)} deptos`);

export const DEPTOS_COPY = {
  titular: "Cada semana, los deptos que convienen",
  bajada: "Elige qué buscas y Franco te dice en el momento cuántos convienen como inversión, con los avisos que revisó anoche.",
  comuna: "Comuna",
  comunaAyuda: `Hasta ${MAX_COMUNAS_DEPTOS}, del Gran Santiago.`,
  otraComuna: "Otra comuna",
  fuera: "Por ahora solo Gran Santiago:",
  tipologia: "Tipología",
  rango: "Rango de precio",
  modalidad: "Cómo lo arriendas",
  estandar: `Con pie ${PIE_DEPTOS} % y ${PLAZO_DEPTOS} años, lo estándar. Lo cambias después en tu perfil.`,
  conRegistro: "Regístrate y te los mando hoy, revisados uno por uno.",
  sinDeptos: "Regístrate y te aviso cuando aparezca uno.",
  tope: `Hasta ${MAX_COMUNAS_DEPTOS} comunas.`,
  notaStr: "En renta corta, Franco mide cada depto con lo que se cobra por noche en su zona: el correo trae los que mejor rinden.",
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
  const tipo = lista(v.tipologias.map((t) => t.frase));
  const donde = lista(v.comunas);
  const conque = `con pie ${PIE_DEPTOS} % y ${PLAZO_DEPTOS} años`;
  const notaModalidad = v.modalidad === "str" ? DEPTOS_COPY.notaStr : null;
  if (convienen > 0) {
    return {
      total, convienen, alternativa: null, conPie30: null, vecinas: [], notaModalidad, registro: DEPTOS_COPY.conRegistro,
      frase: `En ${donde}, de ${deptosTexto(total)} ${tipo} ${v.rango.frase}, ${convienenTexto(convienen)} como inversión ${conque}.`,
    };
  }
  // EL CERO CON ALTERNATIVA: con qué pie sí (30 %, en sus mismas comunas), o en qué comuna vecina (con el estándar).
  const conPie30 = enSus.reduce((s, c) => s + c.comprar30, 0);
  const vecinasQueDan = vecinas
    .filter((c) => !v.comunas.includes(c.comuna) && c.comprar20 > 0)
    .sort((a, b) => b.comprar20 - a.comprar20 || a.comuna.localeCompare(b.comuna))
    .slice(0, MAX_VECINAS_ALTERNATIVA)
    .map((c) => ({ comuna: c.comuna, convienen: c.comprar20 }));
  const partes: string[] = [];
  if (conPie30 > 0) partes.push(`Con pie 30 %, ${conPie30 === 1 ? "1 sí conviene" : `${miles(conPie30)} sí convienen`}.`);
  for (const x of vecinasQueDan) partes.push(`En ${x.comuna}, comuna vecina, ${convienenTexto(x.convienen)} con pie ${PIE_DEPTOS} %.`);
  if (partes.length === 0) partes.push(`Tampoco con pie 30 % ni en las comunas vecinas.`);
  return {
    total, convienen: 0, conPie30, vecinas: vecinasQueDan, notaModalidad, registro: DEPTOS_COPY.sinDeptos,
    alternativa: partes.join(" "),
    frase: total === 0
      ? `En ${donde} no vimos deptos ${tipo} ${v.rango.frase} esta semana.`
      : `En ${donde}, de ${deptosTexto(total)} ${tipo} ${v.rango.frase}, ninguno conviene hoy como inversión ${conque}.`,
  };
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
  yaTienes: "Ya tienes cuenta, te mandamos el código para entrar.",
  nueva: "Te mandamos un código a tu correo. Sin contraseña.",
  agregar: (comunas: string[]) => `¿Agregamos ${lista(comunas)} a tu perfil de búsqueda?`,
  agregarSi: "Sí, agregar",
  agregarNo: "No, dejarlo como está",
  agregado: "Listo, quedó en tu perfil.",
  correo: "Tu correo",
  enviado: (correo: string) => `Lo mandamos a ${correo}. Escríbelo acá.`,
  pedir: "Quiero recibirlos",
  error: "No pudimos seguir. Intenta de nuevo.",
} as const;
