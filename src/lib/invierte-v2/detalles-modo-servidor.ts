// ─────────────────────────────────────────────────────────────────────────────
// QUÉ ES ESTE DEPTO PARA LA PERSONA, en los detalles abiertos desde Invierte (láminas del 19-nov-2026). Lo decide el servidor por
// su base, nunca el enlace:
//   · elegido en su base → «Uno de tus deptos», su estado y «Escribirle a Franco»;
//   · si no, y hoy da Comprar y le alcanza → «Te lo recomendamos», por qué (contra el suyo: el depto con que firmó) y «Seguir
//     con este»;
//   · si no (sin perfil, no le alcanza, ya no conviene) → null: el informe se ve como hoy (sin el enlace a la publicación, porque
//     firmó).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { vistaSumar, numeroFranco } from "./base-servidor";
import { distanciaDelTuyo, indicadorContraElegido, lineaRecomendado, metrosEntre, nombreDeDatos, type CabezaDetalles, type ModoDetalles } from "./detalles-modo";
import { fotosDe } from "./fotos-servidor";

async function puntoYFlujo(admin: SupabaseClient, avisoId: string): Promise<{ lat: number; lng: number; comuna: string | null; precioUF: number | null; flujoCLP: number | null } | null> {
  const [sp, ev] = await Promise.all([
    admin.from("scraped_properties").select("lat, lng, comuna").eq("id", avisoId).order("id").limit(1),
    admin.from("avisos_evaluados").select("precio_uf, flujo_20").eq("aviso_id", avisoId).maybeSingle(),
  ]);
  const f = sp.data?.[0] as { lat?: unknown; lng?: unknown; comuna?: unknown } | undefined;
  const lat = Number(f?.lat), lng = Number(f?.lng);
  if (!f || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  const e = ev.data as { precio_uf?: unknown; flujo_20?: unknown } | null;
  return {
    lat, lng, comuna: typeof f.comuna === "string" ? f.comuna : null,
    precioUF: e?.precio_uf != null ? Number(e.precio_uf) : null,
    flujoCLP: e?.flujo_20 != null ? Number(e.flujo_20) : null,
  };
}

/** `whatsappAdmin`: el cliente de servicio construido en línea por quien llama (CONFIG-PUBLICA §6: `numeroFranco` lee `config`). */
export async function modoDetalles(admin: SupabaseClient, userId: string, avisoId: string, whatsappAdmin: SupabaseClient): Promise<ModoDetalles | null> {
  const [v, fotos] = await Promise.all([vistaSumar(admin, userId, avisoId), fotosDe(admin, [avisoId])]);
  const d = v.datos;
  const cabeza: CabezaDetalles = { avisoId, nombre: d ? nombreDeDatos(d) : "", veredicto: d?.veredicto ?? null, score: d?.score ?? null, fotos: fotos[avisoId] ?? 0 };
  if (v.estado === "ya") return { cabeza, relacion: "suyo", whatsapp: await numeroFranco(whatsappAdmin).catch(() => null) };
  if (v.estado !== "listo" || !v.alcanza || v.datos?.veredicto !== "COMPRAR" || !v.orden || !v.perfil) return null;
  const [alt, ele] = await Promise.all([puntoYFlujo(admin, avisoId), puntoYFlujo(admin, v.orden.avisoId)]);
  const enKm = v.perfil.donde === "convenga";
  const distancia = alt && ele ? distanciaDelTuyo(metrosEntre(alt, ele), alt.comuna, enKm) : null;
  const ind = alt && ele ? indicadorContraElegido(alt, ele, v.perfil) : null;
  if (!distancia && !ind) return null;
  const linea = distancia ? lineaRecomendado(distancia, ind?.frase ?? null) : lineaRecomendado(ind!.frase, null);
  return { cabeza, relacion: "recomendado", avisoId, linea, activos: (v.activos ?? []).map((a) => ({ avisoId: a.avisoId, datos: a.datos as unknown as Record<string, unknown> })) };
}
