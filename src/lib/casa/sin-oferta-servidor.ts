// ─────────────────────────────────────────────────────────────────────────────
// El aviso de «sin oferta» desde la base (26-oct-2026): `deptos_conteo` —la cuenta de /deptos— con sus comunas y las
// vecinas, sus dormitorios y el rango del semanal; y, desde el 27-oct-2026, una segunda lectura con el chip de precio de
// abajo. La regla vive en sin-oferta.ts; la leen el dashboard (`leerAvisoSinOferta`) y el correo vacío
// (semanal-servidor.ts › verdadDelVacio, que además necesita cuántos había aunque haya oferta).
// Una falla no muestra aviso (lo dice Sentry): mejor nada que un «no hay» sin verificar.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { comunasVecinas } from "@/lib/comunas-vecinas";
import { comunaDeAviso } from "@/lib/guia/semanal-candidatos";
import { rangoSemanal, VENTANA_SEMANAL_DIAS } from "@/lib/guia/semanal";
import { reportarFalloQuery } from "@/lib/observabilidad";
import type { ConteoComuna } from "@/lib/deptos/respuesta";
import type { PerfilBusqueda } from "@/lib/perfil-busqueda";
import { avisoSinOferta, chipDeAbajo, type AvisoSinOferta } from "./sin-oferta";

type FilaConteo = { comuna: string; total: number; comprar_20: number; comprar_30: number };
const aConteo = (data: unknown): ConteoComuna[] =>
  ((data ?? []) as FilaConteo[]).map((f) => ({ comuna: f.comuna, total: Number(f.total) || 0, comprar20: Number(f.comprar_20) || 0, comprar30: Number(f.comprar_30) || 0 }));

/** El aviso y cuántos había en sus comunas. null si el perfil no alcanza para buscar o si la base falló. */
export async function contarSinOferta(admin: SupabaseClient, userId: string, perfil: PerfilBusqueda | null, ahora: Date = new Date()): Promise<{ aviso: AvisoSinOferta | null; revisados: number } | null> {
  if (!perfil?.completo) return null;
  const rango = rangoSemanal(perfil);
  if (!rango) return null;
  const comunas = Array.from(new Set(perfil.comunas.map(comunaDeAviso)));
  const vecinas = comunasVecinas(comunas).filter((c) => !comunas.includes(c));
  const desde = new Date(ahora.getTime() - VENTANA_SEMANAL_DIAS * 864e5).toISOString().replace("Z", "");
  const abajo = chipDeAbajo(rango);
  const [suyo, deAbajo] = await Promise.all([
    admin.rpc("deptos_conteo", { comunas: [...comunas, ...vecinas], dorms: perfil.dormitorios, uf_min: rango.ufMin, uf_max: rango.ufMax, desde }),
    abajo ? admin.rpc("deptos_conteo", { comunas, dorms: perfil.dormitorios, uf_min: abajo.min ?? 0, uf_max: abajo.max, desde }) : Promise.resolve({ data: [], error: null }),
  ]);
  reportarFalloQuery(suyo.error, { ruta: "lib/casa/sin-oferta", operacion: "deptos-conteo", userId });
  reportarFalloQuery(deAbajo.error, { ruta: "lib/casa/sin-oferta", operacion: "deptos-conteo-chip-de-abajo", userId });
  if (suyo.error) return null;
  const filas = aConteo(suyo.data);
  const propias = filas.filter((f) => comunas.includes(f.comuna));
  // Sin el conteo de abajo (falló), el aviso sale con las otras dos salidas.
  const filasAbajo = abajo && !deAbajo.error ? { rango: abajo, filas: aConteo(deAbajo.data) } : null;
  return {
    aviso: avisoSinOferta({ piePct: perfil.piePct, comunas }, propias, filas.filter((f) => vecinas.includes(f.comuna)), filasAbajo),
    revisados: propias.reduce((s, f) => s + f.total, 0),
  };
}

/** El aviso del dashboard: null si hay oferta, si el perfil no alcanza o si la base falló. */
export async function leerAvisoSinOferta(admin: SupabaseClient, userId: string, perfil: PerfilBusqueda | null, ahora: Date = new Date()): Promise<AvisoSinOferta | null> {
  return (await contarSinOferta(admin, userId, perfil, ahora))?.aviso ?? null;
}
