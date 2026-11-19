// ─────────────────────────────────────────────────────────────────────────────
// LA BASE COMPLETA, SUS TEXTOS Y SUS REGLAS PURAS (Invierte con Franco, etapa 2, entrega 2, 19-nov-2026). Láminas 3.3-base,
// 3.3-base-pc, 3.3-menu, 3.3-documentos, 3.3-perfil-editado y 3.3-sumar-otro-depto. Los textos van tal como están en la lámina.
//   · No se construye en esta etapa (LEEME de las láminas): la barra de cuatro tramos y el paso de cada depto, «Mis avisos»
//     del menú, ni la subida de la preaprobación (etapa 3). «Lo que te toca hoy» espera a la preaprobación: sin ella no hay
//     una acción que ofrecer, y la base no inventa una.
//   · «Escribirle» abre, en modo prueba, un WhatsApp al número que se configura en /admin/invierte-v2 (`config`
//     invierte_whatsapp_franco). Sin número, no se muestra.
// Módulo puro (sin DB): lo usan las páginas, la ruta de sumar y el tier INVIERTE-V2-E2.
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_ACTIVOS, fmtUF } from "./opciones";
import type { Tope } from "./perfil";

export const CLAVE_WHATSAPP_FRANCO = "invierte_whatsapp_franco";
export const URL_DOCUMENTOS = "/invierte/documentos";
export const URL_PERFIL_ACTUALIZADO = "/invierte/perfil/actualizado";
export const urlSumar = (avisoId: string) => `/invierte/${encodeURIComponent(avisoId)}/sumar`;

/** Un número de WhatsApp de Chile (+569 y ocho dígitos), sin espacios. Null si no lo es. */
export function numeroWhatsapp(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const n = x.replace(/[\s()-]/g, "");
  const m = /^(?:\+?56)?(9\d{8})$/.exec(n);
  return m ? `+56${m[1]}` : null;
}

/** El enlace de «Escribirle»: el mensaje no lleva datos de la persona. */
export const urlWhatsapp = (numero: string) =>
  `https://wa.me/${numero.replace(/^\+/, "")}?text=${encodeURIComponent("Hola, Franco. Te escribo por mi inversión.")}`;

export interface LineaDepto { comuna?: string | null; dormitorios?: number | null; banos?: number | null; m2?: number | null }
/** «Macul · 2D2B · 60 m²». */
export function lineaDepto(d: LineaDepto): string {
  const tip = d.dormitorios != null ? `${d.dormitorios}D${d.banos != null ? `${d.banos}B` : ""}` : null;
  // «58 m²» con espacio que no corta: la cifra y la unidad nunca quedan en renglones distintos.
  return [d.comuna, tip, d.m2 ? `${Math.round(d.m2)} m²` : null].filter(Boolean).join(" · ");
}

export const BASE_COPY = {
  titulo: "Tu inversión con Franco",
  hola: (n: string) => `Hola, ${n}`,
  menu: "Menú",
  tusDeptos: "Tus deptos",
  tusDeptosLinea: (n: number) => (n === 1 ? "El que elegiste para seguir." : `Los ${n === 2 ? "dos" : n} con que elegiste seguir. Cada uno avanza por su cuenta.`),
  teTocaATi: "Te toca a ti",
  francoEnEso: "Franco está en eso",
  abrir: "Abrir",
  otras: (n: number) => `Otras opciones que convienen · ${n}`,
  seguirConEste: "Seguir con este",
  compararTodas: "Comparar todas",
  buscarEnMapa: "Buscar otro en el mapa",
  acompana: "Franco te acompaña en todo el proceso",
  escribirle: "Escribirle",
  fueraDeAlcance: "fuera de tu alcance hoy",
  maximo: `Ya sigues ${MAX_ACTIVOS} deptos, el máximo. Para sumar otro, deja uno.`,
  error: "No pudimos sumarlo. Inténtalo de nuevo.",
} as const;

export const MENU_COPY = {
  cerrar: "Cerrar",
  perfil: "Mi perfil de inversión",
  perfilLinea: (topeUF: number | null, comunas: readonly string[]) => [topeUF ? `Hasta UF ${fmtUF(topeUF)}` : null, comunasCortas(comunas)].filter(Boolean).join(" · "),
  documentos: "Mis documentos",
  documentosLinea: "Tu orden firmada y lo de cada depto",
  preguntas: "Preguntas frecuentes",
  preguntasLinea: "Qué firmé, cuánto cobra Franco",
  escribirle: "Escribirle a Franco",
  escribirleLinea: "Tu contacto durante todo el proceso",
} as const;

/** «Ñuñoa y Macul»; con más de dos, «Ñuñoa, Macul y 2 más». */
export function comunasCortas(cs: readonly string[]): string {
  if (cs.length <= 2) return cs.join(" y ");
  return `${cs.slice(0, 2).join(", ")} y ${cs.length - 2} más`;
}

export const DOCUMENTOS_COPY = {
  cabecera: "Tus documentos",
  orden: "Orden de visita y acompañamiento",
  ordenLinea: (fecha: string) => `Firmada el ${fecha}. Cubre todos tus deptos.`,
  preaprobacion: "Preaprobación de crédito",
  preaprobacionLinea: "La necesitas para ofertar o visitar. Foto o PDF de tu banco.",
  detalles: "Los detalles de tus deptos",
  detallesLinea: "Los que elegiste, cada uno con todos sus detalles.",
  oferta: "Oferta de compra",
  ofertaLinea: "Aparece cuando hagas una.",
  promesa: "Promesa y escritura",
  promesaLinea: "Se firman en notaría; aquí queda la copia.",
  ver: "Ver",
  masAdelante: "Más adelante",
} as const;

export const SUMAR_COPY = {
  cabecera: "Invierte con Franco",
  volver: "Volver al mapa",
  titulo: "Súmalo a tus opciones",
  sinFirmaT: "No tienes que firmar de nuevo",
  sinFirma: (fecha: string) => `Tu orden del ${fecha} cubre también este depto. Franco empieza a gestionarlo y puedes ver todos sus detalles desde tus deptos.`,
  teAlcanza: "Te alcanza",
  conQue: (f: Tope["fuente"] | null) => (f === "renta" ? "con tu pie y tu renta." : f === "solo_pie" ? "con tu pie." : "con tu preaprobación."),
  noTeAlcanza: "Hoy no te alcanza",
  noTeAlcanzaLinea: (precioUF: number, topeUF: number) => `cuesta UF ${fmtUF(precioUF)} y puedes comprar hasta UF ${fmtUF(topeUF)}.`,
  entra: "Entra a tu comparativo",
  entraLinea: (n: number) => (n === 0 ? "como tu primera opción." : `junto a ${n === 1 ? "la opción" : `las ${n === 2 ? "dos" : n === 3 ? "tres" : n === 4 ? "cuatro" : n === 5 ? "cinco" : n} opciones`} que ya tienes.`),
  boton: "Sumar a mis opciones",
  revisarPerfil: "Revisar mi perfil",
  dejarUno: "¿Cuál dejas?",
  ya: "Ya está entre tus deptos.",
  verMisDeptos: "Ver mis deptos",
} as const;

export const ACTUALIZADO_COPY = {
  cabecera: "Tu perfil de inversión",
  titulo: "Perfil actualizado",
  hasta: (topeUF: number) => `Estimamos que puedes comprar hasta UF ${fmtUF(topeUF)}. Sujeto a evaluación del banco.`,
  masDeptos: (n: number) => (n === 1 ? "Ahora te alcanza 1 depto más" : `Ahora te alcanzan ${n} deptos más`),
  sinNuevos: "Tus opciones siguen igual",
  menosDeptos: (n: number) => (n === 1 ? "1 depto quedó fuera de tu alcance hoy" : `${n} deptos quedaron fuera de tu alcance hoy`),
  cambiaron: "Tus opciones cambiaron",
  entra: "Entra",
  fuera: "Fuera de tu alcance hoy",
  siguen: (n: number) => (n === 0 ? "" : n === 1 ? "La que ya tenías sigue ahí." : `Las ${n} que ya tenías siguen ahí.`),
  nadaSale: "Nada sale por haber cambiado tu perfil.",
  quedanMarcadas: "Las que ya no te alcanzan no se borran: quedan marcadas «fuera de tu alcance hoy».",
  boton: "Ver mis opciones",
} as const;

// ── EL CAMBIO DEL PERFIL («Subiste tu pie de UF 700 a UF 900.») ──────────────
export interface PerfilComparable { pieUF: number | null; rentaCLP: number | null; otrasCuotasCLP: number | null; comunas: readonly string[]; topeUF: number | null; montoPreaprobadoUF: number | null }

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

/** Lo que cambió del perfil, en una frase (la primera diferencia que pesa). Null si no cambió nada que se diga. */
export function fraseCambioPerfil(a: PerfilComparable, b: PerfilComparable): string | null {
  const sube = (x: number, y: number) => (y > x ? "Subiste" : "Bajaste");
  if (a.pieUF != null && b.pieUF != null && Math.round(a.pieUF) !== Math.round(b.pieUF)) return `${sube(a.pieUF, b.pieUF)} tu pie de UF ${fmtUF(a.pieUF)} a UF ${fmtUF(b.pieUF)}.`;
  if (a.montoPreaprobadoUF != null && b.montoPreaprobadoUF != null && Math.round(a.montoPreaprobadoUF) !== Math.round(b.montoPreaprobadoUF)) return `Cambiaste tu preaprobación de UF ${fmtUF(a.montoPreaprobadoUF)} a UF ${fmtUF(b.montoPreaprobadoUF)}.`;
  if (a.rentaCLP != null && b.rentaCLP != null && a.rentaCLP !== b.rentaCLP) return `${sube(a.rentaCLP, b.rentaCLP)} tu renta de ${clp(a.rentaCLP)} a ${clp(b.rentaCLP)}.`;
  if (a.rentaCLP == null && b.rentaCLP != null) return `Sumaste tu renta: ${clp(b.rentaCLP)}.`;
  if ((a.otrasCuotasCLP ?? 0) !== (b.otrasCuotasCLP ?? 0)) return `Cambiaste tus otras cuotas de ${clp(a.otrasCuotasCLP ?? 0)} a ${clp(b.otrasCuotasCLP ?? 0)}.`;
  const nuevas = b.comunas.filter((c) => !a.comunas.includes(c));
  const fuera = a.comunas.filter((c) => !b.comunas.includes(c));
  if (nuevas.length || fuera.length) return nuevas.length ? `Sumaste ${comunasCortas(nuevas)} a tus comunas.` : `Sacaste ${comunasCortas(fuera)} de tus comunas.`;
  return null;
}

/** «15 de noviembre» de un instante, en la hora de Chile (la fecha de la orden en documentos y en sumar). */
export function diaMesChile(iso: string): string {
  const p = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "long" }).formatToParts(new Date(iso));
  return `${p.find((x) => x.type === "day")?.value ?? ""} de ${p.find((x) => x.type === "month")?.value ?? ""}`;
}
