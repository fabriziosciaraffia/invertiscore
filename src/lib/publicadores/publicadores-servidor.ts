// ─────────────────────────────────────────────────────────────────────────────
// Lo que se guarda de quien publica cada aviso (12-nov-2026), con el service role. USO INTERNO: `publicadores` y
// `avisos_publicador` tienen RLS sin políticas, así que la llave pública recibe cero filas; ningún componente de cliente ni
// ruta pública importa este archivo (lo fija el tier PUBLICADORES). Las reglas, en publicador.ts.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { claseDelPublicador, type ClasePublicador, type PublicadorFicha, type TipoPublicador } from "./publicador";

const RUTA = "lib/publicadores";

/**
 * Guarda quién publica el aviso: la marca de leído en `avisos_publicador` (con o sin publicador) y el publicador en
 * `publicadores`. De un dueño directo se guarda el tipo y el id, nunca el nombre: es una persona particular.
 * No pisa la clase, los conteos ni el contacto: esos los escribe el recuento.
 */
export async function guardarPublicadorEn(admin: SupabaseClient, avisoId: string, p: PublicadorFicha | null, tipo: TipoPublicador | null): Promise<void> {
  const ahora = new Date().toISOString();
  if (p) {
    const fila = {
      id: p.id,
      tipo,
      id_tipo: p.idType,
      nombre: tipo === "dueno" ? null : p.nombre,
      logo: tipo === "dueno" ? null : p.logo,
      visto_at: ahora,
    };
    const { error } = await admin.from("publicadores").upsert(fila, { onConflict: "id" });
    reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar-publicador" });
  }
  const { error } = await admin.from("avisos_publicador").upsert(
    { aviso_id: avisoId, publicador_id: p?.id ?? null, tipo, leido_at: ahora },
    { onConflict: "aviso_id" },
  );
  reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar-aviso-publicador" });
}

/**
 * Recuenta cuántos avisos activos tiene cada publicador y cuántos convienen (la función `recontar_publicadores`) y, con esos
 * números, la clase (franquicia, corredora, independiente) donde cambió. Devuelve cuántos publicadores cambiaron de clase.
 */
export async function recontarPublicadores(admin: SupabaseClient): Promise<{ ok: boolean; clases: number }> {
  const { error } = await admin.rpc("recontar_publicadores");
  reportarFalloQuery(error, { ruta: RUTA, operacion: "recontar" });
  if (error) return { ok: false, clases: 0 };
  let clases = 0;
  // Paginado: PostgREST corta en 1.000 filas sin avisar (CLAUDE.md).
  for (let desde = 0; ; desde += 1000) {
    const { data, error: e2 } = await admin.from("publicadores").select("id, tipo, nombre, avisos_activos, clase").order("id").range(desde, desde + 999);
    reportarFalloQuery(e2, { ruta: RUTA, operacion: "leer-para-clase" });
    if (e2 || !data?.length) break;
    for (const f of data) {
      const clase: ClasePublicador | null = claseDelPublicador({ tipo: f.tipo as TipoPublicador | null, nombre: f.nombre as string | null, avisosActivos: Number(f.avisos_activos ?? 0) });
      if (clase === f.clase) continue;
      const { error: e3 } = await admin.from("publicadores").update({ clase }).eq("id", f.id);
      reportarFalloQuery(e3, { ruta: RUTA, operacion: "guardar-clase" });
      if (!e3) clases++;
    }
    if (data.length < 1000) break;
  }
  return { ok: true, clases };
}

/** El publicador de un depto, para el panel de /admin/invierte. */
export interface PublicadorDelAviso {
  tipo: TipoPublicador | null;
  nombre: string | null;
  clase: ClasePublicador | null;
  sitioWeb: string | null;
  telefono: string | null;
  correo: string | null;
  avisosActivos: number | null;
  avisosConvienen: number | null;
  /** La ficha del aviso en la fuente: hoy la única puerta de contacto que la fuente deja abierta. */
  url: string | null;
  leido: boolean;
}

/** Los publicadores de varios avisos (los de las inscripciones). Un aviso sin leer vuelve con `leido: false` y el tipo de su URL. */
export async function publicadoresDeAvisos(admin: SupabaseClient, avisoIds: string[]): Promise<Map<string, PublicadorDelAviso>> {
  const out = new Map<string, PublicadorDelAviso>();
  const ids = Array.from(new Set(avisoIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x)))).slice(0, 500);
  if (!ids.length) return out;
  const [{ data: props, error: e1 }, { data: links, error: e2 }] = await Promise.all([
    admin.from("scraped_properties").select("id, url, publicador_tipo").in("id", ids).order("id").limit(500),
    admin.from("avisos_publicador").select("aviso_id, publicador_id, tipo").in("aviso_id", ids),
  ]);
  reportarFalloQuery(e1 ?? e2, { ruta: RUTA, operacion: "leer-publicadores-de-avisos" });
  const pubIds = Array.from(new Set((links ?? []).map((l) => l.publicador_id).filter((x): x is number => x != null)));
  const { data: pubs, error: e3 } = pubIds.length
    ? await admin.from("publicadores").select("id, nombre, clase, sitio_web, telefono, correo, avisos_activos, avisos_convienen").in("id", pubIds)
    : { data: [], error: null };
  reportarFalloQuery(e3, { ruta: RUTA, operacion: "leer-publicadores" });
  const porPub = new Map((pubs ?? []).map((p) => [p.id as number, p]));
  const porAviso = new Map((links ?? []).map((l) => [l.aviso_id as string, l]));
  for (const pr of props ?? []) {
    const l = porAviso.get(pr.id as string);
    const p = l?.publicador_id != null ? porPub.get(l.publicador_id as number) : undefined;
    out.set(pr.id as string, {
      tipo: ((l?.tipo ?? pr.publicador_tipo) as TipoPublicador | null) ?? null,
      nombre: (p?.nombre as string | null) ?? null,
      clase: (p?.clase as ClasePublicador | null) ?? null,
      sitioWeb: (p?.sitio_web as string | null) ?? null,
      telefono: (p?.telefono as string | null) ?? null,
      correo: (p?.correo as string | null) ?? null,
      avisosActivos: p?.avisos_activos != null ? Number(p.avisos_activos) : null,
      avisosConvienen: p?.avisos_convienen != null ? Number(p.avisos_convienen) : null,
      url: (pr.url as string | null) ?? null,
      leido: !!l,
    });
  }
  return out;
}
