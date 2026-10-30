// ─────────────────────────────────────────────────────────────────────────────
// EXPLORAR SIN CUENTA, LA PUERTA E (29-oct-2026, mockup docs/puerta-b-mockups/6-puerta-e.html, estados A a D). Las reglas
// puras; el servidor está en portal-servidor.ts y la ruta /api/explorar/abierto, la pantalla en src/app/explorar.
//   · SIN CUENTA SE VE el mapa, los grupos, los filtros y la lista. El flujo, el arriendo, el cap rate y la UF por m² NO
//     VIAJAN al navegador (`sinCifras`): la tarjeta y la lista los muestran borrosos con un relleno fijo, no con el valor.
//   · DECISIONES DE FABRIZIO (29-oct-2026): pie y plazo quedan en el financiamiento por defecto —20 % y 30 años desde el 30-oct-2026— (tocarlos abre el registro); la modalidad
//     sí se cambia; lo que depende del flujo («Solo flujo positivo», ordenar por mayor flujo o cap rate) se ve y pide
//     registro; «Avísame de nuevos» abre la hoja hablando del regalo, sin línea de depto.
//   · LA HOJA DE REGISTRO (estado D) sale de lo que se tocó (`PedidoRegistro`) y, al terminar el alta, se hace eso mismo: la
//     cuenta nace con el perfil del pin que miraba (comuna, tipología, chip de precio y la modalidad del filtro), puerta E
//     con su llegada, y vuelve al mismo pin con el pop-up «Analizar este · usa tu análisis de regalo» abierto.
//   · OFERTAS DE A UNA: la bienvenida y el registro hablan solo del regalo; nunca del ticket, del pie ni del plazo.
// ─────────────────────────────────────────────────────────────────────────────
import { perfilManualDeElecciones, RANGOS_UF, validarElecciones, type EleccionesDeptos } from "@/lib/deptos/respuesta";
import { lineaDepto } from "@/lib/guia/linea-depto";
import { DESDE_LANDING } from "./puertas-landing";
import { PIE_POR_DEFECTO, PLAZO_POR_DEFECTO } from "@/lib/deptos/estandar";
import { perfilDeFiltros, urlDePortal, validarPortal, type FiltrosPortal, type ModalidadPortal, type OrdenPortal, type PinMapa, type UniversoCompacto } from "./portal";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

// ── LA LLEGADA (landing o directo) ───────────────────────────────────────────
/** El hero de la landing lleva a /explorar con `?desde=landing`: así se separan, en el panel por puerta, las visitas que
 *  llegan desde la landing de las que llegan directo. */
export type OrigenExplorar = "landing" | "directo";
// Lo de la landing vive en un módulo sin dependencias (la landing es un cliente liviano: LCP en el teléfono).
export { DESDE_LANDING, HERO_MAPA, HREF_DESDE_LANDING, pisoDeMiles } from "./puertas-landing";
export const origenDeLlegada = (desde: string | null | undefined): OrigenExplorar => (desde === DESDE_LANDING ? "landing" : "directo");
/** El detalle de la puerta E en la atribución: «explorar:landing» o «explorar:directo». */
export const detalleDeOrigen = (o: OrigenExplorar): string => `explorar:${o}`;
/** Normaliza un detalle que llega de afuera (lo elegido, la candidata del navegador). */
export const detalleExplorar = (d: string | null | undefined): string => (d === "explorar:landing" ? d : "explorar:directo");
export const origenDeDetalle = (d: string): OrigenExplorar => (d === "explorar:landing" ? "landing" : "directo");

// ── LOS SUPUESTOS SIN CUENTA ─────────────────────────────────────────────────
export const PIE_ABIERTO = PIE_POR_DEFECTO;
export const PLAZO_ABIERTO = PLAZO_POR_DEFECTO;
/** Sin cuenta: el financiamiento por defecto (pie 20 % y 30 años, deptos/estandar.ts), y sin «Solo flujo positivo» (pide registro); la modalidad y lo demás, como vengan. */
export function filtrosAbiertos(f: FiltrosPortal): FiltrosPortal {
  // Sin cuenta, la tasa es la de hoy (30-oct-2026): elegir otra pide registro, como el pie y el plazo.
  return f.pie === PIE_ABIERTO && f.plazo === PLAZO_ABIERTO && f.tasa == null && !f.flujoPositivo ? f : { ...f, pie: PIE_ABIERTO, plazo: PLAZO_ABIERTO, tasa: null, flujoPositivo: false };
}
/** Los órdenes que dependen del flujo: sin cuenta se ven y piden registro. */
export const ORDENES_CON_CIFRAS: readonly OrdenPortal[] = ["flujo", "caprate"];
export const ordenAbierto = (o: OrdenPortal): OrdenPortal => (ORDENES_CON_CIFRAS.includes(o) ? "puntaje" : o);

/** El universo que viaja sin cuenta: sin flujo y sin arriendo (de ahí salen el cap rate y la cuota). */
export function sinCifras(u: UniversoCompacto): UniversoCompacto {
  return { comunas: u.comunas, filas: u.filas.map((f) => [f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[8], null, null, f[11], f[12]]) };
}
/** Lo que se dibuja borroso en lugar de las cifras: un relleno fijo, nunca el valor. */
export const BORROSO = { flujo: "+$000.000", capRate: "0,0 %", porM2: "00 UF/m²" } as const;

// ── LA HOJA DE REGISTRO (estado D) ───────────────────────────────────────────
/** Lo que la persona tocó y que se hace al terminar el alta. */
export type MotivoRegistro = "analizar" | "guardar" | "avisame" | "orden" | "flujo" | "pie-plazo";
export const MOTIVOS_REGISTRO: readonly MotivoRegistro[] = ["analizar", "guardar", "avisame", "orden", "flujo", "pie-plazo"];
export const esMotivoRegistro = (x: unknown): x is MotivoRegistro => typeof x === "string" && (MOTIVOS_REGISTRO as readonly string[]).includes(x);

export interface PedidoRegistro {
  motivo: MotivoRegistro;
  /** El pin del que nace el perfil (y al que se vuelve). En «Avísame» no hay pin: el perfil sale de los filtros. */
  pin: PinMapa | null;
  /** El orden que se tocó («orden»). */
  orden?: OrdenPortal;
}

export const REGISTRO_COPY = {
  conDepto: "Te regalamos el análisis de este depto.",
  sinDepto: "Te regalamos un análisis.",
  cuerpoDepto: { antes: "Crea tu cuenta gratis y recibe el informe completo, con ", fuerte: "el enlace a la publicación", despues: "." },
  cuerpoAvisame: "Crea tu cuenta gratis y te avisamos de los nuevos que convienen con estos filtros.",
  cuerpoCifras: "Crea tu cuenta gratis y ve el flujo, el cap rate y el precio por m² de cada depto.",
  cuerpoPiePlazo: "Crea tu cuenta gratis y elige tu pie y tu plazo.",
  google: "Entrar con Google",
  oTuCorreo: "o con tu correo",
  correo: "Tu correo",
  placeholder: "nombre@correo.cl",
  verDepto: "Ver este depto",
  crearCuenta: "Crear mi cuenta",
  sinContrasena: "Sin contraseña: te mandamos un código.",
  cerrar: "Cerrar",
  codigo: { titulo: "Revisa tu correo.", bajada: (correo: string) => `Te mandamos un código a ${correo}. Escríbelo acá.`, campo: "Código", entrar: "Entrar", otroCorreo: "Usar otro correo" },
  errorCorreo: "Ese correo no parece válido.",
  errorCodigo: "Ese código no sirve. Revisa el último correo que te mandamos.",
  error: "No pudimos seguir. Intenta de nuevo.",
  entrando: "Entrando…",
} as const;

/** Los textos de la hoja según lo que se tocó: con depto (el pin) o sin él (Avísame, las cifras, pie y plazo). */
export function textosHoja(p: PedidoRegistro): { titulo: string; linea: string | null; cuerpo: string | { antes: string; fuerte: string; despues: string }; boton: string } {
  if (p.pin && (p.motivo === "analizar" || p.motivo === "guardar")) {
    return { titulo: REGISTRO_COPY.conDepto, linea: `${lineaDepto(p.pin)} · UF ${miles(p.pin.precioUF)}`, cuerpo: REGISTRO_COPY.cuerpoDepto, boton: REGISTRO_COPY.verDepto };
  }
  const cuerpo = p.motivo === "avisame" ? REGISTRO_COPY.cuerpoAvisame : p.motivo === "pie-plazo" ? REGISTRO_COPY.cuerpoPiePlazo : REGISTRO_COPY.cuerpoCifras;
  return { titulo: REGISTRO_COPY.sinDepto, linea: null, cuerpo, boton: REGISTRO_COPY.crearCuenta };
}

/** La tipología de /deptos de un pin (0 a 3 dormitorios, o «4 o más»). */
export const tipologiaDePin = (dormitorios: number): string => (dormitorios >= 4 ? "4" : String(Math.max(0, Math.round(dormitorios))));
/** El chip de precio de /deptos que contiene un precio. */
export const rangoDePrecio = (uf: number): string => (RANGOS_UF.find((r) => uf <= r.max) ?? RANGOS_UF[RANGOS_UF.length - 1]).id;

/** LO ELEGIDO desde un pin, como lo elige una persona en /deptos: su comuna, su tipología, el chip de su precio y la
 *  modalidad del filtro activo. Lo valida y lo guarda /api/deptos/correo (o /google) igual que en la puerta B. */
export function eleccionesDePin(pin: Pick<PinMapa, "comuna" | "dormitorios" | "precioUF">, modalidad: ModalidadPortal): EleccionesDeptos {
  return { comunas: [pin.comuna], tipologias: [tipologiaDePin(pin.dormitorios)], rango: rangoDePrecio(pin.precioUF), modalidad };
}

/** El perfil (columnas de `perfil_busqueda`) desde los filtros activos, para «Avísame de nuevos» sin cuenta: lo mismo que
 *  guarda «Avísame» con cuenta (perfilDeFiltros), con el financiamiento por defecto. null sin comunas (o más de ocho). */
export function perfilFilaDeFiltros(f: FiltrosPortal): Record<string, unknown> | null {
  const r = perfilDeFiltros(filtrosAbiertos(f));
  if (!r.ok) return null;
  const c = r.cambios;
  return { comunas: c.comunas, dormitorios: c.dormitorios, precio_min_uf: c.precioMinUf, precio_max_uf: c.precioMaxUf, modalidad: c.modalidad === "str" ? "str" : null, pie_pct: c.piePct, plazo_anios: c.plazoAnios };
}

/** EL PERFIL DE LO ELEGIDO, en las rutas que lo guardan antes del código o de Google (/api/deptos/correo y /google): los
 *  chips de /deptos —también los que arma un pin de Explorar (eleccionesDePin)— o, solo en la puerta E, los filtros de
 *  «Avísame de nuevos». */
export function perfilDelPedido(b: { elecciones?: Partial<EleccionesDeptos>; filtros?: unknown; puerta?: unknown }): { ok: true; perfil: Record<string, unknown> } | { ok: false; error: string } {
  if (b.puerta === "E" && b.filtros && typeof b.filtros === "object") {
    const fila = perfilFilaDeFiltros(validarPortal(b.filtros as Partial<Record<keyof FiltrosPortal, unknown>>));
    return fila ? { ok: true, perfil: fila } : { ok: false, error: "comunas" };
  }
  const v = validarElecciones(b.elecciones ?? {});
  return v.ok ? { ok: true, perfil: perfilManualDeElecciones(v) } : { ok: false, error: v.error };
}

// ── LA VUELTA AL MISMO PIN ───────────────────────────────────────────────────
/** La URL de Explorar a la que se vuelve después del alta, con lo que hay que hacer: el pin (`a`), el motivo (`hacer`) y el
 *  orden tocado. El enlace del correo agrega `entro=1`; Google, `entro=google&p=<clave>` (destinoGoogleExplorar). */
export function destinoDeVuelta(p: { filtros: FiltrosPortal; orden: OrdenPortal; pedido: PedidoRegistro }): string {
  const q = new URLSearchParams(urlDePortal(p.filtros, p.pedido.motivo === "orden" && p.pedido.orden ? p.pedido.orden : p.orden));
  if (p.pedido.pin) q.set("a", p.pedido.pin.avisoId);
  q.set("hacer", p.pedido.motivo);
  return `/explorar?${q.toString()}`;
}
export const destinoGoogleExplorar = (vuelta: string, clave: string): string => `${vuelta}${vuelta.includes("?") ? "&" : "?"}entro=google&p=${clave}`;
export const destinoEnlaceExplorar = (vuelta: string): string => `${vuelta}${vuelta.includes("?") ? "&" : "?"}entro=1`;

/** Lo que trae la URL de vuelta: qué hacer y con qué pin; null si no viene de un alta. */
export function accionDeVuelta(sp: URLSearchParams): { motivo: MotivoRegistro; avisoId: string | null } | null {
  const motivo = sp.get("hacer");
  return esMotivoRegistro(motivo) ? { motivo, avisoId: sp.get("a") } : null;
}

// ── LA BIENVENIDA (estado B), una sola vez ───────────────────────────────────
export const CLAVE_BIENVENIDA = "franco_explorar_bienvenida";
type Almacen = Pick<Storage, "getItem" | "setItem"> | null;
/** ¿Ya la vio en este navegador? Sin almacenamiento se da por vista: mejor no mostrarla que mostrarla a cada carga. */
export function bienvenidaVista(a: Almacen): boolean {
  try {
    return !a || a.getItem(CLAVE_BIENVENIDA) != null;
  } catch {
    return true;
  }
}
export function marcarBienvenida(a: Almacen, ahora: number = Date.now()): void {
  try {
    a?.setItem(CLAVE_BIENVENIDA, String(ahora));
  } catch {
    /* sin almacenamiento */
  }
}

export const BIENVENIDA_COPY = {
  revisados: "Revisados por Franco",
  titulo: "Deptos en venta que convienen como inversión hoy.",
  paso1: "Toca uno en el mapa para ver por qué conviene.",
  paso2: { antes: "Regístrate gratis y ", fuerte: "te regalamos el análisis completo", despues: " del que más te interese." },
  boton: "Ver el mapa",
} as const;

// ── LA TARJETA Y LA LISTA SIN CUENTA (estado C) ──────────────────────────────
export const ABIERTO_COPY = {
  cta: "Regístrate gratis para ver este depto",
  flujo: "Flujo",
  alMes: "al mes",
  capRate: "Cap rate",
  entrar: "Entrar",
} as const;

// ── LA MEDICIÓN DEL EMBUDO ───────────────────────────────────────────────────
/** Nada de datos de la persona antes del registro: los eventos llevan lo que se tocó, nunca el correo. */
export const EVENTOS_ABIERTO = {
  /** La vista desde el servidor (middleware), con la llegada y los robots marcados. */
  vista: "explorar_abierto_vista",
  bienvenida: "explorar_bienvenida_vista",
  pin: "explorar_pin",
  registroAbierto: "explorar_registro_abierto",
  registroHecho: "explorar_registro_hecho",
  regaloUsado: "explorar_regalo_usado",
} as const;

