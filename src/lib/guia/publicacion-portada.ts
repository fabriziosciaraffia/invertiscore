// ─────────────────────────────────────────────────────────────────────────────
// EL ENLACE A LA PUBLICACIÓN, EN LA PORTADA (27-oct-2026, decisión de Fabrizio). El pop-up de antes de analizar promete
// «El informe incluye el enlace a la publicación» (aviso-analizar.ts), y hasta hoy el enlace solo llegaba si la persona
// tocaba «Quiero verlo» y abría el correo: un cliente que pagó el pack el 26-oct no lo recibió y se sintió engañado.
// Desde hoy todo informe que salió de un aviso de Franco —la selección, la guía, Explorar— lo lleva visible en la
// portada, junto a «Ficha del depto», sin pedirlo. «Mandármelo por correo» (el «Quiero verlo» de antes) queda debajo.
//
// Lo lee el servidor (informe-ltr.tsx, informe-str.tsx) y baja por props OBLIGATORIAS hasta PortadaInforme: un eslabón
// que no lo pase no compila. El tier PUBLICACION-PORTADA dibuja la portada con informes reales de la selección.
// El enlace es el mismo que manda «Mandármelo por correo» (`scraped_properties.url`). Si el chequeo de la ficha lo dio por
// despublicado (`publicacion_avisos`), la portada lo dice en vez de llevar a una página que ya no existe.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";

/** El enlace de la portada. null = el informe no salió de un aviso, o el aviso no trae enlace. */
export type PublicacionPortada = { url: string; despublicado: boolean } | null;

/** El aviso del que salió el informe (`input_data.origenAviso.avisoId`), o null. */
export function avisoDelInforme(inputData: unknown): string | null {
  const origen = (inputData as { origenAviso?: { avisoId?: unknown } } | null | undefined)?.origenAviso;
  const id = origen?.avisoId;
  return typeof id === "string" && id ? id : null;
}

/** Con el cliente de servicio: `publicacion_avisos` tiene RLS sin políticas. Un error de lectura no rompe el informe:
 *  la portada queda como antes, sin el enlace. */
export async function publicacionDelInforme(admin: SupabaseClient, inputData: unknown): Promise<PublicacionPortada> {
  const avisoId = avisoDelInforme(inputData);
  if (!avisoId) return null;
  try {
    const [sp, pub] = await Promise.all([
      admin.from("scraped_properties").select("url").eq("id", avisoId).order("id").limit(1),
      admin.from("publicacion_avisos").select("estado").eq("aviso_id", avisoId).maybeSingle(),
    ]);
    const url = (sp.data?.[0] as { url?: unknown } | undefined)?.url;
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
    return { url, despublicado: (pub.data as { estado?: unknown } | null)?.estado === "despublicado" };
  } catch {
    return null;
  }
}
