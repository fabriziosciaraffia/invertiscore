// ─────────────────────────────────────────────────────────────────────────────
// /deptos, la puerta B (16-oct-2026, decisiones de Fabrizio): una persona sin depto en la mira elige comuna, tipología y
// rango de precio, y Franco responde AL INSTANTE con la evaluación de la noche (sin calcular en vivo).
// LA RESPUESTA ES UN NÚMERO (16-oct-2026, segunda pasada: la única meta de la página es que dejen el correo): «29 de 1.008
// convienen». Desde el 17-oct-2026, antes del número la etiqueta «Si buscas Santiago · 2D · UF 3.000 a 4.000» y debajo
// la nota chica con el financiamiento por defecto. Con cero, con
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
 * CUATRO RANGOS (16-oct-2026: los cuartiles del precio de lo que la gente analiza, redondeados). DESDE EL 23-oct-2026, los
 * del mockup de la puerta B (`docs/puerta-b-mockups/1b-deptos.html` y `3b-dashboard.html`): el tercero llega a UF 6.000 y
 * el último empieza ahí. `chip` es también el nombre del `<select>` y el de la línea del perfil.
 */
export const RANGOS_UF: readonly RangoUf[] = [
  { id: "hasta-3000", min: null, max: 3000, chip: "Hasta UF 3.000", frase: "hasta UF 3.000" },
  { id: "3000-4000", min: 3000, max: 4000, chip: "UF 3.000 a 4.000", frase: "entre UF 3.000 y 4.000" },
  { id: "4000-6000", min: 4000, max: 6000, chip: "UF 4.000 a 6.000", frase: "entre UF 4.000 y 6.000" },
  { id: "6000-mas", min: 6000, max: 60000, chip: "Más de UF 6.000", frase: "sobre UF 6.000" },
];

export interface TipologiaDeptos { id: string; dorms: number[]; chip: string; /** El nombre del `<select>` y de la línea del perfil (23-oct-2026): «2 dormitorios». */ nombre: string; frase: string }
/** Una sola tipología, 2D por defecto (16-oct-2026). */
export const TIPOLOGIA_POR_DEFECTO = "2";
export const TIPOLOGIAS_DEPTOS: readonly TipologiaDeptos[] = [
  { id: "0", dorms: [0], chip: "Estudio", nombre: "Estudio", frase: "estudios" },
  { id: "1", dorms: [1], chip: "1D", nombre: "1 dormitorio", frase: "1D" },
  { id: "2", dorms: [2], chip: "2D", nombre: "2 dormitorios", frase: "2D" },
  { id: "3", dorms: [3], chip: "3D", nombre: "3 dormitorios", frase: "3D" },
  { id: "4", dorms: [4, 5], chip: "4D o más", nombre: "4 dormitorios o más", frase: "de 4 o más dormitorios" },
];

export type ModalidadDeptos = "ltr" | "str";
/** Se pregunta en «Estás dentro» (16-oct-2026), no en la pantalla de elegir. */
export const MODALIDADES_DEPTOS: ReadonlyArray<{ id: ModalidadDeptos; chip: string }> = [
  { id: "ltr", chip: "Arriendo tradicional" },
  { id: "str", chip: "Renta corta" },
];
export const MODALIDAD_POR_DEFECTO: ModalidadDeptos = "ltr";

/**
 * LA BÚSQUEDA CON QUE ARRANCA LA PÁGINA (17-oct-2026, decisión de Fabrizio): Santiago, 2D, UF 3.000 a 4.000. El número y el
 * correo están desde el primer segundo —el servidor ya trae la respuesta— y los chips de abajo la afinan.
 */
export const ELECCIONES_POR_DEFECTO = { comunas: ["Santiago"], tipologias: [TIPOLOGIA_POR_DEFECTO], rango: "3000-4000", modalidad: MODALIDAD_POR_DEFECTO } as const;

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
  /** Los que convienen con el financiamiento por defecto (pie 20 %, 30 años: deptos/estandar.ts). */
  convienen: number;
  /** El número: «29 de 1.008». null si esta semana no hubo avisos así. */
  cifra: string | null;
  /** «29 de 1.008 publicados convienen»; sin avisos, «Ninguno publicado así esta semana». */
  titular: string;
  /**
   * LA TARJETA DEL NÚMERO (23-oct-2026, mockup `1b-deptos.html`): el número grande y, a su lado, «de 310 publicados
   * convienen» (`resto`); debajo, la nota. Las tres piezas llegan en la MISMA respuesta: al cambiar un campo cambian juntas.
   */
  resto: string | null;
  /** «Publicados anoche. Cambia la búsqueda y el número cambia.», chico bajo el número. */
  nota: string;
  /** Con cero: con qué sí, en una línea corta. null si no es cero. */
  alternativa: string | null;
  conPie30: number | null;
  vecinas: Array<{ comuna: string; convienen: number }>;
  /** El título de la tarjeta del correo, con o sin deptos. */
  registro: string;
}

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
export const lista = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const siConvienen = (n: number) => `${miles(n)} sí ${n === 1 ? "conviene" : "convienen"}`;

/** El total de la frase de arriba, en miles y hacia abajo, con «+» («21.453» → «+21.000»): nunca dice más de lo que hay.
 *  Bajo diez mil, exacto. */
export function masDeMiles(n: number): string {
  return n >= 10_000 ? `+${miles(Math.floor(n / 1000) * 1000)}` : miles(n);
}

/**
 * EL COPY DE /deptos SEGÚN EL MOCKUP DE LA PUERTA B (23-oct-2026, `docs/puerta-b-mockups/1b-deptos.html`, decisión de
 * Fabrizio): el título en serif, la bajada con «Se van rápido.» en negrita, la tarjeta «¿Qué buscas?» con tres campos con
 * nombre, la tarjeta del número, la tarjeta del correo con el material de la tríada —Google primero, «o con tu correo», el
 * campo y «Quiero verlos»— y, debajo, la prueba con las cifras de la noche y «Ver un análisis de ejemplo». Sin pie ni plazo.
 */
export const DEPTOS_COPY = {
  /** El título de la pestaña y de la vista previa del enlace. */
  titular: "Cada semana, los deptos que convienen",
  /** El título de la página (serif). */
  titulo: "Accede antes que el resto a los deptos en venta que convienen como inversión.",
  /** La bajada: la primera frase en negrita. */
  bajadaFuerte: "Se van rápido.",
  bajada: "Franco rastrea cada noche todas las publicaciones y selecciona las que más calzan con tu perfil de inversión.",
  /** Arriba, cuando se llega desde «Empezar gratis» de la página de planes (19-oct-2026, decisión de Fabrizio): el enlace
   *  va en «Analízalo gratis», al wizard. */
  desdePlanes: { antes: "Elige qué buscas y te mandamos los deptos cada semana. ¿Tienes un depto en la mira?", enlace: "Analízalo gratis" },
  /** La tarjeta de los tres campos (los mismos que edita el perfil del dashboard: components/deptos/CamposBusqueda.tsx). */
  queBuscas: "¿Qué buscas?",
  comuna: "Comuna",
  eligeComuna: "Elige una comuna",
  tipologia: "Tipología",
  rango: "Rango de precio",
  /** Bajo los campos, hasta que elige la comuna. */
  eligeYTeDecimos: "Elige la comuna y te decimos cuántos convienen hoy.",
  /** Al lado del número: «de 310 publicados convienen». */
  resto: (total: number, convienen: number) => `de ${miles(total)} publicados ${convienen === 1 ? "conviene" : "convienen"}`,
  nota: "Publicados anoche. Cambia la búsqueda y el número cambia.",
  /** La tarjeta del correo. */
  correo: {
    titulo: "Regístrate gratis y revísalos ahora mismo.",
    tituloSinDeptos: "Regístrate gratis y te avisamos cuando aparezca uno.",
    /** «Los mejores de estos 12 te llegan al correo en minutos, con un análisis de regalo para el que más te interese.»: la
     *  negrita va en `fuerte`. «LOS MEJORES DE ESTOS» (24-oct-2026, recorrido de Fabrizio): lo que llega es la selección, no
     *  los 12; prometer los 12 era falso. */
    bajada: (convienen: number): { antes: string; fuerte: string; despues: string } =>
      convienen > 1
        ? { antes: `Los mejores de estos ${miles(convienen)} te llegan al correo en minutos, `, fuerte: "con un análisis de regalo", despues: " para el que más te interese." }
        : convienen === 1
          ? { antes: "Te llega al correo en minutos, ", fuerte: "con un análisis de regalo", despues: " para analizarlo." }
          : { antes: "Te llega al correo apenas se publique, ", fuerte: "con un análisis de regalo", despues: " para analizarlo." },
    google: "Entrar con Google",
    oTuCorreo: "o con tu correo",
    placeholder: "nombre@correo.cl",
    boton: "Quiero verlos",
    nota: "Sin contraseña: te mandamos un código. Nada de spam, solo deptos.",
  },
  /** Después de pedir el código: EL MISMO MENSAJE exista o no la cuenta (16-oct-2026, decisión de Fabrizio). Un título
   *  corto en serif y el correo abajo, en Inter y con corte de línea (24-oct-2026, recorrido de Fabrizio: el correo entero
   *  en el serif del título no cabía en el teléfono). */
  enviado: {
    titulo: "Revisa tu correo.",
    bajada: (correo: string) => `Te mandamos un código a ${correo}. Escríbelo acá.`,
  },
  /**
   * LA PRUEBA, debajo del correo, con las cifras de la evaluación de la noche: las mismas con que se cuenta la respuesta de
   * arriba (deptos publicados en la última semana con arriendo de referencia; resumenDeLaNoche). «EN VENTA» (17-oct-2026,
   * decisión de Fabrizio): el +40.000 de la landing son los comparables de venta Y arriendo (src/lib/stats.ts); sin decir
   * «en venta», las dos cifras se leían como si se contradijeran. La negrita va en `fuerte`.
   */
  prueba: (revisados: number | null, convienen: number | null): { antes: string; fuerte: string; despues: string } => ({
    antes: "Cada noche Franco revisa ",
    fuerte: revisados ? `las ${masDeMiles(revisados)} publicaciones` : "todas las publicaciones",
    despues: ` en venta de Santiago y calcula cuáles convienen como inversión.${convienen != null ? ` Anoche, ${miles(convienen)} deptos.` : ""}`,
  }),
  verAnalisis: "Ver un análisis de ejemplo",
  /** Adónde lleva «Ver un análisis de ejemplo» (29-oct-2026: antes «real», en todo el sitio): el demo público. */
  hrefAnalisis: "/demo",
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
  const nota = DEPTOS_COPY.nota;
  const cifra = total > 0 ? `${miles(convienen)} de ${miles(total)}` : null;
  const resto = total > 0 ? DEPTOS_COPY.resto(total, convienen) : null;
  const titular = resto ? `${miles(convienen)} ${resto}` : "Ninguno publicado así esta semana";
  if (convienen > 0) {
    return { total, convienen, cifra, titular, resto, nota, alternativa: null, conPie30: null, vecinas: [], registro: DEPTOS_COPY.correo.titulo };
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
  return { total, convienen: 0, cifra, titular, resto, nota, alternativa, conPie30, vecinas: vecinasQueDan, registro: DEPTOS_COPY.correo.tituloSinDeptos };
}

/** El perfil manual con que nace la cuenta (columnas de `perfil_busqueda`): los chips, con el financiamiento por defecto (pie 20 % y 30 años). LA MODALIDAD
 *  NO SE ESCRIBE POR DEFECTO (24-oct-2026, mockup 3b): /deptos ya no la pregunta, así que la cuenta nace sin contestarla y
 *  el perfil del dashboard se la pregunta («¿Cómo lo arriendas?», lib/casa/reglas.ts › preguntasPendientes). Sin respuesta,
 *  todo sigue en renta larga (perfil-busqueda.ts). Solo una elección explícita de renta corta se guarda. */
export function perfilManualDeElecciones(v: Extract<Validacion, { ok: true }>): Record<string, unknown> {
  return {
    comunas: v.comunas,
    dormitorios: v.dorms,
    precio_min_uf: v.rango.min,
    precio_max_uf: v.rango.max,
    modalidad: v.modalidad === "str" ? "str" : null,
    pie_pct: PIE_DEPTOS,
    plazo_anios: PLAZO_DEPTOS,
  };
}

// ── EL PERFIL ES DE LA PERSONA, NO DEL EJEMPLO (21-oct-2026, recorrido real de Fabrizio por la puerta B) ──────────
// /deptos no arranca con una comuna: la elige la persona, y recién con ella hay número y correo. La tipología y el rango
// sí vienen puestos, a la vista, como sugerencia. Así nadie deja el correo con la búsqueda del ejemplo. En «Estás dentro»
// (23-oct-2026, mockup `2-estas-dentro.html`), después de la selección, «Tu perfil de búsqueda» en una línea —«Providencia
// · 2 dormitorios · UF 3.000 a 4.000»— con «Editar», que lleva al perfil del dashboard. Lo prueba el tier PUERTA-B-RECORRIDO.

/** ¿Se puede pedir el correo? Solo con al menos una comuna elegida por la persona. */
export function puedePedirCorreo(comunas: readonly string[]): boolean {
  return comunas.length > 0;
}

export interface BusquedaDeptos {
  comunas: string[];
  tipologia: string;
  rango: string;
}

/** La línea del perfil de «Estás dentro» (23-oct-2026): «Providencia · 2 dormitorios · UF 3.000 a 4.000», con el nombre
 *  largo de la tipología (el de los `<select>`), no el chip. */
export function lineaPerfil(b: BusquedaDeptos): string {
  const t = TIPOLOGIAS_DEPTOS.find((x) => x.id === b.tipologia);
  const r = RANGOS_UF.find((x) => x.id === b.rango);
  return [lista(b.comunas), t?.nombre, r?.chip].filter(Boolean).join(" · ");
}

/** El copy de «Estás dentro» según el mockup `2-estas-dentro.html` (23-oct-2026). Sin pie ni plazo, sin la modalidad ni
 *  el «cuándo» (van al perfil del dashboard), sin lo del correo. */
export const ESTAS_DENTRO_DEPTOS = {
  titulo: "Bienvenido, estás dentro.",
  regalo: {
    kicker: "Regalo de bienvenida",
    titulo: "Tienes un análisis de regalo.",
    /** «Úsalo en el depto que más te interese de abajo. Vence el 21 de noviembre.» (la fecha, textoVence). */
    bajada: "Úsalo en el depto que más te interese de abajo.",
  },
  perfil: {
    kicker: "Tu perfil de búsqueda",
    editar: "Editar",
    /** Adónde lleva «Editar»: el perfil del dashboard. */
    hrefEditar: "/dashboard#perfil",
    nota: "Con este perfil te hacemos llegar una selección actualizada todos los lunes. Puedes editar los parámetros y la frecuencia en tu dashboard.",
  },
  dashboard: "Ir a mi dashboard",
  hrefDashboard: "/dashboard",
} as const;

/** La búsqueda de los chips desde el perfil manual (la inversa de `perfilManualDeElecciones`), para la línea «Buscas». */
export function busquedaDePerfil(p: { comunas?: unknown; dormitorios?: unknown; precio_min_uf?: unknown; precio_max_uf?: unknown } | null | undefined): BusquedaDeptos | null {
  const comunas = Array.isArray(p?.comunas) ? (p!.comunas as unknown[]).filter((c): c is string => typeof c === "string") : [];
  if (comunas.length === 0) return null;
  const dorms = Array.isArray(p?.dormitorios) ? (p!.dormitorios as unknown[]).map(Number).sort((a, b) => a - b) : [];
  const t = TIPOLOGIAS_DEPTOS.find((x) => x.dorms.length === dorms.length && x.dorms.every((d, i) => d === dorms[i]));
  const max = Number(p?.precio_max_uf);
  const min = p?.precio_min_uf == null ? null : Number(p.precio_min_uf);
  const r = RANGOS_UF.find((x) => x.max === max && (x.min ?? null) === min);
  return { comunas, tipologia: t?.id ?? TIPOLOGIA_POR_DEFECTO, rango: r?.id ?? ELECCIONES_POR_DEFECTO.rango };
}

/** Lo que guardan los tres campos del perfil del dashboard (PUT /api/perfil-busqueda): las comunas, los dormitorios y el
 *  rango. null si la búsqueda no está completa. */
export function cambiosDeBusqueda(b: BusquedaDeptos): { comunas: string[]; dormitorios: number[]; precioMaxUf: number; precioMinUf: number | null } | null {
  const t = TIPOLOGIAS_DEPTOS.find((x) => x.id === b.tipologia);
  const r = RANGOS_UF.find((x) => x.id === b.rango);
  if (!puedePedirCorreo(b.comunas) || !t || !r) return null;
  return { comunas: b.comunas, dormitorios: [...t.dorms], precioMaxUf: r.max, precioMinUf: r.min };
}

/**
 * LA CUENTA INSTANTÁNEA (16-oct-2026): ¿esta entrada creó la cuenta, o el correo ya la tenía? Nueva solo si, cuando pidió
 * el código, el correo NO tenía cuenta y la cuenta nació después de ese pedido (con un minuto de holgura por relojes).
 * Una cuenta que ya existía no se duplica ni se pisa su perfil: se le pregunta si agrega las comunas. Y una cuenta que YA
 * TIENE perfil con comunas nunca es nueva (16-oct-2026, visto en el QA de Google): con el minuto de holgura, quien se
 * registró y vuelve a /deptos dentro del minuto se daba por nueva y se le pisaba el perfil.
 */
export function tipoDeAlta(p: { existiaAlPedir: boolean; cuentaCreadaAt: string | null | undefined; pedidoAt: string; yaTienePerfil?: boolean }): "nueva" | "existente" {
  if (p.existiaAlPedir || !p.cuentaCreadaAt || p.yaTienePerfil) return "existente";
  return Date.parse(p.cuentaCreadaAt) >= Date.parse(p.pedidoAt) - 60_000 ? "nueva" : "existente";
}

/** Tope de comunas del perfil (validarCambiosPerfil): al agregar las de /deptos no se pasa. */
export const MAX_COMUNAS_PERFIL = 8;

/** Las comunas elegidas en /deptos que su perfil todavía no tiene, sin pasar el tope del perfil. */
export function comunasParaAgregar(actuales: string[], elegidas: string[]): string[] {
  const nuevas = elegidas.filter((c) => !actuales.includes(c));
  return nuevas.slice(0, Math.max(0, MAX_COMUNAS_PERFIL - actuales.length));
}

// ── CON GOOGLE (16-oct-2026) ─────────────────────────────────────────────────────
// Con el código se sabe el correo ANTES de salir; con Google no. Lo elegido queda con una clave al azar
// (`deptos_pendientes.correo` = «google:<clave>», servidor.ts › guardarPendienteGoogle), la clave viaja en el destino de
// vuelta —/deptos?entro=google&p=<clave>— y el callback, que ya sabe el correo, la vuelve a guardar a nombre del correo
// (reclavarPendienteGoogle). Desde ahí, la cuenta nace exactamente igual que por código. La página del invitado, cuando
// exista, entra por el mismo camino con su propio destino.
export const CLAVE_GOOGLE = /^[0-9a-f]{32}$/;
export const PREFIJO_GOOGLE = "google:";

/** Adónde vuelve Google: la misma página, con la clave de lo elegido. */
export function destinoGoogle(clave: string, pagina = "/deptos"): string {
  return `${pagina}?entro=google&p=${clave}`;
}

/** La clave de lo elegido en un destino de vuelta de Google (`?entro=google&p=<clave>`), o null. */
export function claveDeDestino(destino: string | null | undefined): string | null {
  if (!destino || !destino.startsWith("/")) return null;
  const q = new URLSearchParams(destino.split("?")[1] ?? "");
  const p = q.get("p");
  return q.get("entro") === "google" && p && CLAVE_GOOGLE.test(p) ? p : null;
}

export const ALTA_COPY = {
  agregar: (comunas: string[]) => `¿Agregamos ${lista(comunas)} a tu perfil de búsqueda?`,
  agregarSi: "Sí, agregar",
  agregarNo: "No, dejarlo como está",
  agregado: "Listo, quedó en tu perfil.",
  correo: "Tu correo",
  /** El botón del correo y el de Google (23-oct-2026): los del mockup (DEPTOS_COPY.correo). */
  pedir: DEPTOS_COPY.correo.boton,
  google: DEPTOS_COPY.correo.google,
  error: "No pudimos seguir. Intenta de nuevo.",
} as const;
