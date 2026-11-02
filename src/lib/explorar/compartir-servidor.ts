// ─────────────────────────────────────────────────────────────────────────────
// UN DEPTO COMPARTIDO, del lado del servidor (02-nov-2026; las reglas puras en compartir.ts). `fichaCompartida` dice cómo
// está hoy el aviso de un enlace compartido, con el financiamiento por defecto (pie 20 %, 30 años, la tasa de hoy):
//   · PUBLICADO es lo mismo que pide el mapa (RPC explorar_mapa): activo, de venta, visto en el listado dentro de la ventana
//     semanal y no marcado despublicado por la ficha (`publicacion_avisos`).
//   · DA COMPRAR si está en el universo de los que convienen: en arriendo tradicional, el de la noche (la MISMA entrada en
//     caché de diez minutos que dibuja el mapa); en renta corta, el calculado de su comuna (guardado 24 horas por aviso,
//     el mismo que pide el mapa). Así la vista previa no dice «Comprar» de un depto que el mapa no muestra.
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
import { universoDeLaNocheCacheado } from "./portal-cache";
import { universoCalculado } from "./portal-servidor";
import { deptoDePin, type DeptoCompartido, type FichaCompartida } from "./compartir";
import { esAvisoId } from "./enlace-compartido";

const RUTA = "lib/explorar/compartir";

/** Los que convienen hoy con el financiamiento por defecto, en una modalidad (y, en renta corta, en una comuna). */
export type UniversoEstandar = (modalidad: ModalidadPortal, comuna: string) => Promise<PinMapa[]>;
const universoReal: UniversoEstandar = async (modalidad, comuna) =>
  modalidad === "ltr"
    ? descompactar(await universoDeLaNocheCacheado(PIE_POR_DEFECTO, PLAZO_POR_DEFECTO))
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
  o: { veredicto: boolean; ahora?: Date; universo?: UniversoEstandar } = { veredicto: true },
): Promise<FichaCompartida | null> {
  if (!esAvisoId(avisoId)) return null;
  const [{ data: sp, error: e1 }, { data: ae, error: e2 }, { data: pa, error: e3 }] = await Promise.all([
    admin.from("scraped_properties").select("id, comuna, lat, lng, superficie_m2, dormitorios, banos, condicion, is_active, type, scraped_at, titulo").eq("id", avisoId).maybeSingle(),
    admin.from("avisos_evaluados").select("aviso_id, precio_uf").eq("aviso_id", avisoId).maybeSingle(),
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
  const base = { avisoId, modalidad };
  if (!estaPublicado(fila, (pa as { estado?: string | null } | null)?.estado ?? null, o.ahora)) return { ...base, estado: "despublicado", depto, score: null };
  if (!o.veredicto) return { ...base, estado: "comprar", depto, score: null };
  const pines = await (o.universo ?? universoReal)(modalidad, fila.comuna);
  const pin = pines.find((p) => p.avisoId === avisoId);
  return pin ? { ...base, estado: "comprar", depto: deptoDePin(pin), score: pin.score } : { ...base, estado: "no-da", depto, score: null };
}

/** La ficha con el veredicto, en caché diez minutos (como el universo de la noche): la piden la vista previa, sus metadatos
 *  y el texto de quien comparte con otro pie, a veces varias veces seguidas por el mismo enlace. Una falla no se guarda. */
const fichaCacheada = unstable_cache(
  async (avisoId: string, modalidad: ModalidadPortal): Promise<FichaCompartida | null> => fichaCompartida(createServiceClient(), avisoId, modalidad, { veredicto: true }),
  ["explorar-compartido-v1"],
  { revalidate: 600 },
);
export function fichaCompartidaCacheada(avisoId: string, modalidad: ModalidadPortal): Promise<FichaCompartida | null> {
  return esAvisoId(avisoId) ? fichaCacheada(avisoId.toLowerCase(), modalidad === "str" ? "str" : "ltr") : Promise.resolve(null);
}
