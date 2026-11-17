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
  paso1: "1 de 2",
  paso2: "2 de 2",
  volver: "Volver",
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
    cajaResto: "La orden nos autoriza a empezar las gestiones por ti. Solo pagas si compras un depto que te presentó Franco.",
    nombre: "Nombre completo",
    rut: "RUT",
    rutPlaceholder: "12.345.678-5",
    tuOrden: "Tu orden de visita y acompañamiento",
    version: (v: number) => `VERSIÓN ${v}`,
    desliza: "Desliza hasta el final para poder firmar.",
    acepto: "Leí la orden y la acepto.",
    firmar: "Firmar y partir",
    firmando: "Firmando…",
    preguntas: "Preguntas frecuentes",
    faltaNombre: "Escribe tu nombre completo.",
    faltaRut: "Revisa tu RUT: no es válido.",
    faltaFinal: "Desliza la orden hasta el final antes de firmar.",
    faltaCasilla: "Marca «Leí la orden y la acepto».",
    error: "No pudimos guardar tu firma. Intenta de nuevo.",
  },
  partimos: {
    titulo: (nombre: string | null) => (nombre ? `Partimos, ${nombre}` : "Partimos"),
    parrafo: (comuna: string | null) => `Franco trabaja por tu inversión, no por un aviso. Partimos por ${comuna ? `el depto de ${comuna}` : "este depto"} y trabajamos varias opciones al mismo tiempo, para que elijas la mejor comparando y no la primera que viste.`,
    pasos: [
      { titulo: "Cuéntanos qué buscas", texto: "Tu perfil de inversión, en dos minutos. Con eso podemos ofrecerte las mejores opciones." },
      { titulo: "Ve tus opciones y compáralas", texto: "Los deptos que convienen y están a tu alcance, lado a lado." },
      { titulo: "Elige con cuáles sigues y visítalos", texto: "Tú eliges el horario. Alguien de Franco te acompaña en cada visita." },
      { titulo: "Te acompañamos hasta la escritura", texto: "La oferta, la promesa y el crédito, con los números de Franco en la mano." },
    ],
    perfil: "Hacer mi perfil de inversión",
    guardada: "Tu orden firmada queda guardada en tu cuenta.",
    /** Si la copia por correo todavía no salió (18-nov-2026): honesto, con la orden a mano. */
    copiaPendiente: "Todavía no pudimos mandarte la copia por correo; tu orden ya está guardada y la puedes ver aquí.",
    verOrden: "Ver mi orden",
    porQueTitulo: "Por qué te vamos a mostrar más opciones",
    porQueTexto: "El trabajo de Franco no se limita a un depto: buscamos que hagas una buena inversión. Por eso, cuando completes tu perfil te mostraremos otras opciones que convienen y están a tu alcance, para que puedas elegir mejor.",
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
  nombre: string;
  /** Sin puntos («16482317-5»). */
  rut: string;
  version: number;
  acepto: true;
  leyoHastaElFinal: true;
}
export type ErrorFirma = "depto" | "nombre" | "rut" | "final" | "casilla" | "version";
export type ValidacionFirma = { ok: true; pedido: PedidoFirma } | { ok: false; error: ErrorFirma };

export function nombreValido(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const n = x.replace(/\s+/g, " ").trim();
  return n.length >= 3 && n.length <= 120 && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(n) ? n : null;
}

export function validarFirma(b: Record<string, unknown> | null | undefined): ValidacionFirma {
  const x = b ?? {};
  if (!esAvisoId(x.avisoId)) return { ok: false, error: "depto" };
  const nombre = nombreValido(x.nombre);
  if (!nombre) return { ok: false, error: "nombre" };
  const rut = normalizarRut(x.rut);
  if (!rut) return { ok: false, error: "rut" };
  if (x.leyoHastaElFinal !== true) return { ok: false, error: "final" };
  if (x.acepto !== true) return { ok: false, error: "casilla" };
  if (x.version !== VERSION_ORDEN) return { ok: false, error: "version" };
  return { ok: true, pedido: { avisoId: x.avisoId, nombre, rut, version: VERSION_ORDEN, acepto: true, leyoHastaElFinal: true } };
}

export function textoErrorFirma(e: ErrorFirma | "red"): string {
  const F = FLUJO_COPY.firma;
  if (e === "nombre") return F.faltaNombre;
  if (e === "rut") return F.faltaRut;
  if (e === "final") return F.faltaFinal;
  if (e === "casilla") return F.faltaCasilla;
  return F.error;
}

/** El primer nombre, para «Partimos, Camila». */
export function primerNombre(nombre: string | null | undefined): string | null {
  const p = (nombre ?? "").trim().split(/\s+/)[0];
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
