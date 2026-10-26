// ─────────────────────────────────────────────────────────────────────────────
// El aviso de «sin oferta» del dashboard, desde la base (26-oct-2026): una lectura de `deptos_conteo` —la de /deptos y la
// del correo vacío— con sus comunas y las vecinas, sus dormitorios y el rango del semanal. La regla vive en sin-oferta.ts.
// Una falla no muestra aviso (lo dice Sentry): mejor nada que un «no hay» sin verificar.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { comunasVecinas } from "@/lib/comunas-vecinas";
import { comunaDeAviso } from "@/lib/guia/semanal-candidatos";
import { rangoSemanal, VENTANA_SEMANAL_DIAS } from "@/lib/guia/semanal";
import { reportarFalloQuery } from "@/lib/observabilidad";
import type { ConteoComuna } from "@/lib/deptos/respuesta";
import type { PerfilBusqueda } from "@/lib/perfil-busqueda";
import { avisoSinOferta, type AvisoSinOferta } from "./sin-oferta";

export async function leerAvisoSinOferta(admin: SupabaseClient, userId: string, perfil: PerfilBusqueda | null, ahora: Date = new Date()): Promise<AvisoSinOferta | null> {
  if (!perfil?.completo) return null;
  const rango = rangoSemanal(perfil);
  if (!rango) return null;
  const comunas = Array.from(new Set(perfil.comunas.map(comunaDeAviso)));
  const vecinas = comunasVecinas(comunas).filter((c) => !comunas.includes(c));
  const desde = new Date(ahora.getTime() - VENTANA_SEMANAL_DIAS * 864e5).toISOString().replace("Z", "");
  const { data, error } = await admin.rpc("deptos_conteo", {
    comunas: [...comunas, ...vecinas], dorms: perfil.dormitorios, uf_min: rango.ufMin, uf_max: rango.ufMax, desde,
  });
  reportarFalloQuery(error, { ruta: "lib/casa/sin-oferta", operacion: "deptos-conteo", userId });
  if (error) return null;
  const filas = ((data ?? []) as Array<{ comuna: string; total: number; comprar_20: number; comprar_30: number }>)
    .map((f): ConteoComuna => ({ comuna: f.comuna, total: Number(f.total) || 0, comprar20: Number(f.comprar_20) || 0, comprar30: Number(f.comprar_30) || 0 }));
  return avisoSinOferta({ piePct: perfil.piePct, comunas }, filas.filter((f) => comunas.includes(f.comuna)), filas.filter((f) => vecinas.includes(f.comuna)));
}
