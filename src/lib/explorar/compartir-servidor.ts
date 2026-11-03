// ─────────────────────────────────────────────────────────────────────────────
// UN DEPTO COMPARTIDO, del lado del servidor (02-nov-2026; las reglas puras en compartir.ts). `fichaCompartida` dice cómo
// está hoy el aviso de un enlace compartido, con el financiamiento por defecto (pie 20 %, 30 años, la tasa de hoy):
//   · PUBLICADO es lo mismo que pide el mapa (RPC explorar_mapa): activo, de venta, visto en el listado dentro de la ventana
//     semanal y no marcado despublicado por la ficha (`publicacion_avisos`).
//   · DA COMPRAR si está en el universo de los que convienen: en arriendo tradicional, el de la noche (la MISMA entrada en
//     caché de diez minutos que dibuja el mapa); en renta corta, el calculado de su comuna (guardado 24 horas por aviso,
//     el mismo que pide el mapa). Así la vista previa no dice «Comprar» de un depto que el mapa no muestra.
//   · CON EL TOPE DE LA CAPA «SI NEGOCIAS» (`n`, 03-nov-2026): si no da Comprar, el negociado que guardó la noche
//     (`avisos_evaluados.negociar_20`), si su descuento cabe en el tope, verificado con los datos de hoy como antes de cobrar
//     (negociado-hoy.ts): sigue o se movió → «negociado» con el precio de hoy; si no, «no-llega». Si la verificación falla,
//     vale lo de la noche (la capa lo muestra igual).
// La usan la página que abre el enlace (sin el veredicto: el navegador ya tiene el universo), la vista previa
// (/api/og/depto y los metadatos para los robots de vista previa) y GET /api/explorar/compartido (el texto de quien comparte
// mirando con otro pie u otro plazo).
// ─────────────────────────────────────────────────────────────────────────────
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { createServiceClient } from "@/lib/supabase/service";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";
import { condicionDe } from "@/lib/guia/linea-depto";
import { esEstudio } from "@/lib/avisos/estudio";
import { VENTANA_SEMANAL_DIAS } from "@/lib/guia/semanal";
import { PIE_POR_DEFECTO, PLAZO_POR_DEFECTO } from "@/lib/deptos/estandar";
import { descompactar, type ModalidadPortal, type PinMapa } from "./portal";
import { nocheExplorar } from "./portal-cache";
import { universoCalculado } from "./portal-servidor";
import { deptoDePin, type DeptoCompartido, type FichaCompartida, type NegociadoCompartido } from "./compartir";
import { esAvisoId } from "./enlace-compartido";
import { esTopeNegociar, precioNegociadoValido } from "./capa-negociar";
import { verificarNegociadoDeHoy, type VerificarNegociado } from "./negociado-hoy";

const RUTA = "lib/explorar/compartir";

/** Los que convienen hoy con el financiamiento por defecto, en una modalidad (y, en renta corta, en una comuna). */
export type UniversoEstandar = (modalidad: ModalidadPortal, comuna: string) => Promise<PinMapa[]>;
const universoReal: UniversoEstandar = async (modalidad, comuna) =>
  modalidad === "ltr"
    ? descompactar((await nocheExplorar(PIE_POR_DEFECTO, PLAZO_POR_DEFECTO)).universo)
    : universoCalculado(createServiceClient(), { comunas: [comuna], modalidad: "str", pie: PIE_POR_DEFECTO, plazo: PLAZO_POR_DEFECTO });

type FilaAviso = { id: string; comuna: string | null; lat: number | null; lng: number | null; superficie_m2: number | null; dormitorios: number | null; banos: number | null; condicion: string | null; is_active: boolean | null; type: string | null; scraped_at: string | null; titulo: string | null };

/** ¿Lo publicado según el listado? La misma regla del mapa. */
export function estaPublicado(f: Pick<FilaAviso, "is_active" | "type" | "scraped_at">, estadoFicha: string | null | undefined, ahora: Date = new Date()): boolean {
  const desde = ahora.getTime() - VENTANA_SEMANAL_DIAS * 864e5;
  const visto = f.scraped_at ? Date.parse(`${f.scraped_at.replace(" ", "T")}${/[zZ]|[+-]\d\d:?\d\d$/.test(f.scraped_at) ? "" : "Z"}`) : NaN;
  return f.is_active === true && f.type === "venta" && Number.isFinite(visto) && visto >= desde && estadoFicha !== "despublicado";
}

/**
 * Cómo está hoy el aviso de un enlace compartido; null si el aviso no existe (o no se pudo leer). Con `veredicto: false` no
 * mira si da Comprar (la página: el navegador lo sabe con el universo que carga) y un aviso publicado sale «comprar» a
 * secas, sin puntaje.
 */
export async function fichaCompartida(
  admin: SupabaseClient,
  avisoId: string,
  modalidad: ModalidadPortal,
  o: { veredicto: boolean; tope?: number | null; ahora?: Date; universo?: UniversoEstandar; verificar?: VerificarNegociado } = { veredicto: true },
): Promise<FichaCompartida | null> {
  if (!esAvisoId(avisoId)) return null;
  const [{ data: sp, error: e1 }, { data: ae, error: e2 }, { data: pa, error: e3 }] = await Promise.all([
    admin.from("scraped_properties").select("id, comuna, lat, lng, superficie_m2, dormitorios, banos, condicion, is_active, type, scraped_at, titulo").eq("id", avisoId).order("id").limit(1).maybeSingle(),
    admin.from("avisos_evaluados").select("aviso_id, precio_uf, negociar_20").eq("aviso_id", avisoId).maybeSingle(),
    admin.from("publicacion_avisos").select("estado").eq("aviso_id", avisoId).maybeSingle(),
  ]);
  reportarFalloQuery(e1 ?? e2 ?? e3, { ruta: RUTA, operacion: "ficha" });
  const fila = sp as FilaAviso | null;
  const precio = Number((ae as { precio_uf?: unknown } | null)?.precio_uf);
  if (!fila || !fila.comuna || !(precio > 0)) return null;
  const dorm = esEstudio(fila.dormitorios, fila.titulo) ? 0 : Number(fila.dormitorios) || 0;
  const cond = condicionDe(fila.condicion);
  const depto: DeptoCompartido = {
    comuna: fila.comuna, tipologia: tipologiaDe(dorm, fila.banos), m2: Math.round(Number(fila.superficie_m2) || 0), ...(cond ? { condicion: cond } : {}),
    precioUF: Math.round(precio), dormitorios: dorm, lat: fila.lat != null ? Number(fila.lat) : null, lng: fila.lng != null ? Number(fila.lng) : null,
  };
  // El tope de la capa solo existe en arriendo tradicional (capa-negociar.ts › capaNegociarDisponible).
  const tope = modalidad === "ltr" && esTopeNegociar(o.tope) ? Number(o.tope) : null;
  const base = { avisoId, modalidad, tope };
  if (!estaPublicado(fila, (pa as { estado?: string | null } | null)?.estado ?? null, o.ahora)) return { ...base, estado: "despublicado", depto, score: null };
  if (!o.veredicto) return { ...base, estado: "comprar", depto, score: null };
  const pines = await (o.universo ?? universoReal)(modalidad, fila.comuna);
  const pin = pines.find((p) => p.avisoId === avisoId);
  if (pin) return { ...base, estado: "comprar", depto: deptoDePin(pin), score: pin.score };
  if (tope == null) return { ...base, estado: "no-da", depto, score: null };
  // EL NEGOCIADO (03-nov-2026): el de la noche, si cabe en el tope del enlace, y verificado con los datos de hoy.
  const noche = negociadoDe((ae as { negociar_20?: unknown } | null)?.negociar_20);
  if (!noche || noche.d > tope) return { ...base, estado: "no-llega", depto, score: null };
  const v = await (o.verificar ?? verificarNegociadoDeHoy(admin))(avisoId, noche.p, tope).catch((e) => {
    reportarFalloQuery(e, { ruta: RUTA, operacion: "negociado-hoy" });
    return { estado: "sigue" as const };
  });
  if (v.estado === "sigue") return { ...base, estado: "negociado", depto, score: null, neg: noche };
  if (v.estado === "movido" && precioNegociadoValido(v.negociado.p, precio, tope)) return { ...base, estado: "negociado", depto, score: null, neg: v.negociado };
  return { ...base, estado: "no-llega", depto, score: null };
}

/** El negociado guardado por la noche (jsonb { d, p, s, f }); null si no hay o viene incompleto. */
function negociadoDe(x: unknown): NegociadoCompartido | null {
  const n = x as Partial<Record<"d" | "p" | "s" | "f", unknown>> | null;
  const d = Number(n?.d), p = Number(n?.p);
  if (!n || !(d > 0) || !(p > 0)) return null;
  const num = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  return { d, p: Math.round(p), s: num(n.s), f: num(n.f) };
}

/** La ficha con el veredicto, en caché diez minutos (como el universo de la noche): la piden la vista previa, sus metadatos,
 *  la página que abre el enlace de un negociado y el texto de quien comparte con otro pie, a veces varias veces seguidas por
 *  el mismo enlace —la verificación de un negociado lee comparables: se hace una vez por aviso y tope—. Una falla no se
 *  guarda. */
const fichaCacheada = unstable_cache(
  async (avisoId: string, modalidad: ModalidadPortal, tope: number | null): Promise<FichaCompartida | null> => fichaCompartida(createServiceClient(), avisoId, modalidad, { veredicto: true, tope }),
  ["explorar-compartido-v2"],
  { revalidate: 600 },
);
export function fichaCompartidaCacheada(avisoId: string, modalidad: ModalidadPortal, tope: number | null = null): Promise<FichaCompartida | null> {
  const m = modalidad === "str" ? "str" : "ltr";
  return esAvisoId(avisoId) ? fichaCacheada(avisoId.toLowerCase(), m, m === "ltr" && esTopeNegociar(tope) ? Number(tope) : null) : Promise.resolve(null);
}
