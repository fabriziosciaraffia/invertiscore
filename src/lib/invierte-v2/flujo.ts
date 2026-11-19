// ─────────────────────────────────────────────────────────────────────────────
// EL FLUJO NUEVO DE «INVIERTE CON FRANCO», ETAPA 1 (18-nov-2026): el copy de las pantallas (mockups
// docs/invierte-v2-mockups/etapa-1/) y la validación del contacto y de la firma, la misma en el navegador y en la ruta.
//   · Frente a la persona: «Franco», nunca nombres de personas; «los detalles del depto», nunca «el informe» ni «el análisis»;
//     ninguna mención a hasta cuánto ofrecer.
//   · La casilla de WhatsApp es OBLIGATORIA y viene sin marcar (la lámina 1.2 la muestra marcada a propósito: no se copia).
//   · La firma se rechaza también en el servidor sin casilla, sin haber llegado al final del texto o con un RUT que no pasa el
//     módulo 11.
// ─────────────────────────────────────────────────────────────────────────────
import { esOrigen, esPie, esUrgencia, normalizarWhatsapp, type OrigenInvierte, type PieInvierte, type UrgenciaInvierte } from "@/lib/invierte/invierte";
import { esAvisoId } from "./destino";
import { normalizarRut } from "./rut";
import { VERSION_ORDEN } from "./orden";

export const FLUJO_COPY = {
  cabecera: "Invierte con Franco",
  /** El indicador de pasos (quinta entrega, 18-nov-2026; láminas 1.2 y 2.1): el mismo arriba del contenido en los dos pasos, en
   *  celular y en PC. Reemplaza al «1 de 2» de la cabecera y al rótulo «INVIERTE CON FRANCO · 2 DE 2». */
  pasos: { total: 2, contacto: "Paso 1 de 2 · Tus datos", firma: "Paso 2 de 2 · Tu firma" },
  volver: "Volver",
  /** Láminas del 19-nov-2026: «Ver» de la franja «Orden firmada» y la entrada «Mi inversión» (menú y volver del flujo). */
  franjaVer: "Ver",
  miInversion: "Mi inversión",
  contacto: {
    titulo: "Invierte en este depto con Franco",
    parrafo: "Franco trabaja por tu inversión: partimos por este depto y te mostramos más opciones a la vez, para que elijas la mejor.",
    permiso: "Acepto que Franco me escriba por WhatsApp sobre mi inversión.",
    continuar: "Continuar",
    guardando: "Guardando…",
    nota: "Lo que sigue es firmar tu orden de visita. No te obliga a comprar ni tiene costo.",
    faltaPermiso: "Para seguir, acepta que Franco te escriba por WhatsApp.",
  },
  firma: {
    titulo: "Para partir, necesitamos tu permiso",
    parrafo: "Con tu firma, Franco empieza a gestionar este depto y a buscar los que mejor calzan contigo.",
    cajaFuerte: "Firmar no te obliga a comprar ni tiene costo.",
    cajaResto: "Solo pagas si compras un depto que te presentó Franco.",
    /** Nombres y apellidos por separado (decisión de Fabrizio, 20-nov-2026), con el autocompletado given-name / family-name. */
    nombres: "Nombres",
    apellidos: "Apellidos",
    rut: "RUT",
    rutPlaceholder: "12.345.678-5",
    tuOrden: "Tu orden de visita y acompañamiento",
    version: (v: number) => `VERSIÓN ${v}`,
    desliza: "Desliza hasta el final para poder firmar.",
    /** En el PC (lámina 2.1-firma-pc). */
    deslizaPc: "Lee hasta el final para poder firmar. El botón se activa cuando llegas al último párrafo.",
    acepto: "Leí la orden y la acepto.",
    firmar: "Firmar y partir",
    firmando: "Firmando…",
    preguntas: "Preguntas frecuentes",
    /** El botón de la ventana de preguntas (lámina 2.1-preguntas-frecuentes). */
    volverFirma: "Volver a la firma",
    faltaNombres: "Escribe tus nombres.",
    faltaApellidos: "Escribe tus apellidos.",
    faltaRut: "Revisa tu RUT: no es válido.",
    faltaFinal: "Desliza la orden hasta el final antes de firmar.",
    faltaCasilla: "Marca «Leí la orden y la acepto».",
    error: "No pudimos guardar tu firma. Intenta de nuevo.",
  },
  /** Partimos, cuarta entrega (18-nov-2026, láminas 2.2-partimos y 2.2-partimos-pc): los textos tal como están en la lámina. */
  partimos: {
    estado: "Orden firmada",
    titulo: (nombre: string | null) => (nombre ? `Partimos, ${nombre}` : "Partimos"),
    linea: "Ahora cuéntanos qué buscas, para mostrarte las mejores opciones.",
    perfil: "Hacer mi perfil de inversión",
    verOrden: "Ver mi orden firmada",
    /** Solo cuando la copia de verdad salió; si no, `copiaPendiente`. */
    guardada: "Te mandamos una copia a tu correo.",
    /** Si la copia por correo todavía no salió (18-nov-2026): honesto. */
    copiaPendiente: "Todavía no pudimos mandarte la copia por correo; tu orden ya está guardada.",
    loQueSigue: "Lo que sigue",
    pasos: [
      { titulo: "Cuéntanos qué buscas", texto: "Tu perfil de inversión, en dos minutos." },
      { titulo: "Ve tus opciones y compáralas", texto: "Los deptos que convienen y te alcanzan, lado a lado." },
      { titulo: "Elige con cuáles sigues", texto: "Oferta o visita primero, como prefieras." },
      { titulo: "Te acompañamos hasta la escritura", texto: "La oferta, la promesa y el crédito." },
    ],
    porQueTitulo: "Por qué te vamos a mostrar más opciones",
    porQueTexto: "Franco no trabaja un solo depto: busca que hagas una buena inversión. Con tu perfil te mostramos otras que convienen y te alcanzan, para que compares.",
  },
  /** La ventana de un documento firmado (láminas 2.2-ver-mi-orden y 2.2-ver-mi-orden-pc). */
  documento: {
    tituloOrden: "Tu orden de visita y acompañamiento",
    firmada: "Firmada",
    /** Bajo la fecha (quinta entrega): lo que se ve y lo que se descarga dicen lo mismo. */
    mismoDocumento: (v: number) => `Versión ${v} · es el mismo documento del PDF`,
    /** Abre el PDF guardado en una pestaña nueva, en el visor del navegador o del teléfono (18-nov-2026: en iPhone la descarga
     *  ofrecía guardarlo, que no sirve). */
    abrirPdf: "Abrir PDF",
    cerrar: "Cerrar",
  },
  perfil: {
    titulo: "Tu perfil de inversión viene pronto",
    texto: "Estamos terminando esta parte. Tu orden ya está firmada y guardada en tu cuenta.",
    volver: "Volver",
  },
} as const;

// ── EL CONTACTO (paso 1 de 2) ────────────────────────────────────────────────
export interface PedidoContacto {
  avisoId: string;
  origen: OrigenInvierte;
  urgencia: UrgenciaInvierte;
  pie: PieInvierte;
  whatsapp: string;
  permiso: true;
}
export type ErrorContacto = "depto" | "origen" | "cuando" | "pie" | "whatsapp" | "permiso";
export type ValidacionContacto = { ok: true; pedido: PedidoContacto } | { ok: false; error: ErrorContacto };

export function validarContacto(b: Record<string, unknown> | null | undefined): ValidacionContacto {
  const x = b ?? {};
  if (!esAvisoId(x.avisoId)) return { ok: false, error: "depto" };
  if (!esOrigen(x.origen)) return { ok: false, error: "origen" };
  if (!esUrgencia(x.urgencia)) return { ok: false, error: "cuando" };
  if (!esPie(x.pie)) return { ok: false, error: "pie" };
  const whatsapp = normalizarWhatsapp(x.whatsapp);
  if (!whatsapp) return { ok: false, error: "whatsapp" };
  if (x.permiso !== true) return { ok: false, error: "permiso" };
  return { ok: true, pedido: { avisoId: x.avisoId, origen: x.origen, urgencia: x.urgencia, pie: x.pie, whatsapp, permiso: true } };
}

// ── LA FIRMA (paso 2 de 2) ───────────────────────────────────────────────────
export interface PedidoFirma {
  avisoId: string;
  /** Sin espacios en los bordes ni dobles en medio (la regla de inv_ordenes, 20-nov-2026). */
  nombres: string;
  apellidos: string;
  /** «Nombres Apellidos»: lo que lee la orden, el PDF y el registro de la firma. */
  nombre: string;
  /** Sin puntos («16482317-5»). */
  rut: string;
  version: number;
  acepto: true;
  leyoHastaElFinal: true;
}
export type ErrorFirma = "depto" | "nombres" | "apellidos" | "rut" | "final" | "casilla" | "version";
export type ValidacionFirma = { ok: true; pedido: PedidoFirma } | { ok: false; error: ErrorFirma };

/**
 * Nombres o apellidos (20-nov-2026): se juntan los espacios de más (también los dobles en medio) y se quitan los de los bordes,
 * ANTES de guardar: la regla de inv_ordenes exige `nombre = nombres || ' ' || apellidos`, cada parte sin espacios en los bordes y
 * de 1 a 80 caracteres. Con al menos una letra.
 */
export function parteNombre(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const n = x.replace(/\s+/g, " ").trim();
  return n.length >= 1 && n.length <= 80 && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(n) ? n : null;
}

export function validarFirma(b: Record<string, unknown> | null | undefined): ValidacionFirma {
  const x = b ?? {};
  if (!esAvisoId(x.avisoId)) return { ok: false, error: "depto" };
  const nombres = parteNombre(x.nombres);
  if (!nombres) return { ok: false, error: "nombres" };
  const apellidos = parteNombre(x.apellidos);
  if (!apellidos) return { ok: false, error: "apellidos" };
  const nombre = `${nombres} ${apellidos}`;
  const rut = normalizarRut(x.rut);
  if (!rut) return { ok: false, error: "rut" };
  if (x.leyoHastaElFinal !== true) return { ok: false, error: "final" };
  if (x.acepto !== true) return { ok: false, error: "casilla" };
  if (x.version !== VERSION_ORDEN) return { ok: false, error: "version" };
  return { ok: true, pedido: { avisoId: x.avisoId, nombres, apellidos, nombre, rut, version: VERSION_ORDEN, acepto: true, leyoHastaElFinal: true } };
}

export function textoErrorFirma(e: ErrorFirma | "red"): string {
  const F = FLUJO_COPY.firma;
  if (e === "nombres") return F.faltaNombres;
  if (e === "apellidos") return F.faltaApellidos;
  if (e === "rut") return F.faltaRut;
  if (e === "final") return F.faltaFinal;
  if (e === "casilla") return F.faltaCasilla;
  return F.error;
}

/** El primer nombre, para «Partimos, Camila»: la primera palabra de los nombres; en las órdenes de antes (sin `nombres`), la
 *  primera del nombre completo. */
export function primerNombre(nombre: string | null | undefined, nombres?: string | null): string | null {
  const p = (nombres || nombre || "").trim().split(/\s+/)[0];
  return p ? p : null;
}

// ── LA MEDICIÓN: solo desde el servidor, con prefijo inv2_ ───────────────────
export const EVENTOS_INV2 = {
  contacto: "inv2_contacto",
  firma: "inv2_firma",
  ordenVista: "inv2_orden_vista",
} as const;

// ── LO PENDIENTE DE QUIEN CONTESTA SIN CUENTA (modo «todos») ─────────────────
// El contacto se guarda en el navegador y se manda al volver con cuenta, en la firma. Se COPIA antes y se BORRA después de que
// la ruta respondió bien (regla del repo).
export const CLAVE_PENDIENTE_V2 = "franco_inv2_contacto";
export const VIDA_PENDIENTE_V2_MS = 24 * 60 * 60 * 1000;
