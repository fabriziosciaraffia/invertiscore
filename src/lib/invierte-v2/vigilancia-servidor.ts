// ─────────────────────────────────────────────────────────────────────────────
// LA VIGILANCIA DE LA NOCHE (etapa 2, entrega 2, 18-nov-2026; aprobado por Fabrizio). La corre el cron `invierte-vigilar`
// después de la carga y de la evaluación de la noche:
//   1. Pasa las filas nuevas del historial de precios a UF (`registrar_precios_uf()`, solo los cambios reales).
//   2. Relee la ficha de cada depto elegido como mucho una vez cada 24 horas, por el carril de Invierte (también los que estaban
//      despublicados, para saber si volvieron), hasta el tope del carril.
//   3. Compara lo que cada persona sabe de cada depto que eligió (`inv_deptos.vigente`, o lo que vio al elegirlo) con lo de hoy
//      —precio en UF, publicado, veredicto y lo que deja al mes con pie 20 % y 30 años, si le alcanza, quién publica— y anota
//      cada cambio (`inv_cambios`), su tarea interna (`inv_tareas`) y lo nuevo que sabe.
//   4. Con `correos`, un correo por persona al día con sus cambios relevantes. Mientras el modo no sea «todos», solo a la lista.
// Sin la migración de la entrega 2 aplicada, las tablas nuevas no existen: cada paso falla en silencio (queda en el registro) y
// no se escribe nada a medias.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { sendCambiosInvierte } from "@/lib/email";
import { estadoInterruptor } from "./acceso-servidor";
import { puedeRecibirCopia } from "./copias-servidor";
import { chequearPublicacionInvierte } from "./carril-servidor";
import { leidaFresca } from "./carril";
import { detectarCambios, vigenteTras, type DeptoConCambios, type TipoCambio, type Vigente } from "./cambios";

const RUTA = "lib/invierte-v2/vigilancia";

export const diaChile = (d: Date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);

interface FilaElegido {
  id: string;
  user_id: string;
  aviso_id: string;
  alcanza: boolean;
  datos: { precioUF?: number; veredicto?: string | null; flujoCLP?: number | null; comuna?: string; m2?: number | null; dormitorios?: number | null; banos?: number | null } | null;
  vigente: Vigente | null;
  publicacion_leida_at: string | null;
  es_prueba: boolean;
}

/** Lo que la persona sabe de un depto: lo último anotado o, la primera vez, lo que vio al elegirlo. */
export function vigenteDe(f: Pick<FilaElegido, "vigente" | "datos" | "alcanza">): Vigente {
  if (f.vigente) return f.vigente;
  const d = f.datos ?? {};
  return { precioUF: d.precioUF ?? null, publicado: true, veredicto: d.veredicto ?? null, flujoCLP: d.flujoCLP ?? null, alcanza: f.alcanza, publicadorId: null };
}

export async function vigilarElegidos(admin: SupabaseClient, opts: { ahora?: Date; leer?: boolean } = {}): Promise<{ precios: unknown; deptos: number; leidos: number; cambios: number; tareas: number; error?: string }> {
  const ahora = opts.ahora ?? new Date();
  const fecha = diaChile(ahora);
  // 1. El historial en UF.
  const precios = await admin.rpc("registrar_precios_uf").then((r) => (r.error ? { error: r.error.message } : r.data), (e) => ({ error: String(e) }));
  // 1b. Los republicados (23-nov-2026): los gemelos de lo que apareció los últimos 3 días, para heredar días y rebajas. Sin la
  // migración 20261201 aplicada, falla en silencio (queda en el registro).
  const gemelos = await admin.rpc("registrar_gemelos").then((r) => (r.error ? { error: r.error.message } : r.data), (e) => ({ error: String(e) }));
  if (gemelos && typeof gemelos === "object" && "error" in gemelos) console.warn("[inv2] gemelos:", (gemelos as { error: string }).error);

  // 2. Los elegidos.
  const { data, error } = await admin.from("inv_deptos").select("id, user_id, aviso_id, alcanza, datos, vigente, publicacion_leida_at, es_prueba").eq("estado", "elegido");
  reportarFalloQuery(error, { ruta: RUTA, operacion: "elegidos" });
  if (error) return { precios, deptos: 0, leidos: 0, cambios: 0, tareas: 0, error: error.message };
  const filas = (data ?? []) as FilaElegido[];
  const avisos = Array.from(new Set(filas.map((f) => f.aviso_id)));
  if (!avisos.length) return { precios, deptos: 0, leidos: 0, cambios: 0, tareas: 0 };

  // La relectura, por depto, los más viejos primero, hasta que el carril diga basta.
  const publicado = new Map<string, boolean | null>();
  let leidos = 0;
  if (opts.leer !== false) {
    const ultima = new Map<string, number>();
    for (const f of filas) ultima.set(f.aviso_id, Math.max(ultima.get(f.aviso_id) ?? 0, f.publicacion_leida_at ? new Date(f.publicacion_leida_at).getTime() : 0));
    const orden = avisos.slice().sort((a, b) => (ultima.get(a) ?? 0) - (ultima.get(b) ?? 0));
    for (const a of orden) {
      const at = ultima.get(a) ? new Date(ultima.get(a)!) : null;
      if (leidaFresca(at, ahora)) continue;
      const r = await chequearPublicacionInvierte(admin, { avisoId: a, userId: null, origen: "noche" });
      if (r.lectura?.leida) leidos++;
      publicado.set(a, r.estado === "publicado" ? true : r.estado === "despublicado" ? false : null);
      if (r.sinLeer === "tope" || r.sinLeer === "fusible") break;
    }
  }
  // Lo que se sabe de los que no se leyeron esta noche: la memoria de la publicación.
  const faltan = avisos.filter((a) => !publicado.has(a));
  if (faltan.length) {
    const { data: pub } = await admin.from("publicacion_avisos").select("aviso_id, estado").in("aviso_id", faltan);
    for (const p of (pub ?? []) as Array<{ aviso_id: string; estado: string }>) publicado.set(p.aviso_id, p.estado === "publicado" ? true : p.estado === "despublicado" ? false : null);
  }

  // 3. Lo de hoy: el último precio en UF (solo cambios reales), el veredicto y el flujo de la noche, quién publica, y el tope.
  const [pu, ev, ap, pf] = await Promise.all([
    admin.from("precios_uf").select("property_id, precio_uf, visto_en").in("property_id", avisos).order("visto_en", { ascending: false }),
    admin.from("avisos_evaluados").select("aviso_id, veredicto_20, flujo_20").in("aviso_id", avisos),
    admin.from("avisos_publicador").select("aviso_id, publicador_id").in("aviso_id", avisos),
    admin.from("inv_perfiles").select("user_id, tope_uf").in("user_id", Array.from(new Set(filas.map((f) => f.user_id)))),
  ]);
  reportarFalloQuery(pu.error, { ruta: RUTA, operacion: "precios-uf" });
  const precio = new Map<string, number>();
  for (const r of (pu.data ?? []) as Array<{ property_id: string; precio_uf: number }>) if (!precio.has(r.property_id)) precio.set(r.property_id, Number(r.precio_uf));
  const evaluado = new Map(((ev.data ?? []) as Array<{ aviso_id: string; veredicto_20: string | null; flujo_20: number | null }>).map((r) => [r.aviso_id, r]));
  const publicador = new Map(((ap.data ?? []) as Array<{ aviso_id: string; publicador_id: number | null }>).map((r) => [r.aviso_id, r.publicador_id]));
  const tope = new Map(((pf.data ?? []) as Array<{ user_id: string; tope_uf: number | null }>).map((r) => [r.user_id, r.tope_uf == null ? null : Number(r.tope_uf)]));

  let cambios = 0;
  let tareas = 0;
  for (const f of filas) {
    const v = vigenteDe(f);
    const p = precio.get(f.aviso_id) ?? null;
    const t = tope.get(f.user_id) ?? null;
    const e = evaluado.get(f.aviso_id);
    const hoy = {
      precioUF: p,
      publicado: publicado.get(f.aviso_id) ?? null,
      veredicto: e?.veredicto_20 ?? null,
      flujoCLP: e?.flujo_20 ?? null,
      alcanza: p != null && t != null ? p <= t + 0.5 : null,
      publicadorId: publicador.get(f.aviso_id) ?? null,
    };
    const cs = detectarCambios(v, hoy);
    const nuevo = vigenteTras(v, hoy);
    if (cs.length) {
      const { error: ec } = await admin.from("inv_cambios").upsert(
        cs.map((c) => ({ user_id: f.user_id, aviso_id: f.aviso_id, tipo: c.tipo, antes: c.antes, despues: c.despues, fecha, en_base: c.enBase, relevante: c.relevante, es_prueba: f.es_prueba })),
        { onConflict: "user_id,aviso_id,tipo,fecha", ignoreDuplicates: true },
      );
      reportarFalloQuery(ec, { ruta: RUTA, operacion: "anotar-cambios" });
      if (ec) continue; // sin el cambio anotado, lo que sabe la persona no se mueve: se reintenta mañana
      cambios += cs.length;
      for (const tipo of [cs.some((c) => c.relevante) ? "cambio_publicacion" : null, cs.some((c) => c.tipo === "publicador") ? "cambio_publicador" : null]) {
        if (!tipo) continue;
        const detalle = { fecha, cambios: cs.filter((c) => (tipo === "cambio_publicador" ? c.tipo === "publicador" : c.relevante)).map((c) => ({ tipo: c.tipo, antes: c.antes, despues: c.despues })) };
        const { error: et } = await admin.from("inv_tareas").insert({ user_id: f.user_id, tipo, aviso_id: f.aviso_id, detalle, es_prueba: f.es_prueba });
        if (!et) tareas++;
        else if (et.code !== "23505") reportarFalloQuery(et, { ruta: RUTA, operacion: "tarea" });
      }
    }
    if (JSON.stringify(nuevo) !== JSON.stringify(f.vigente)) {
      const { error: ev2 } = await admin.from("inv_deptos").update({ vigente: nuevo }).eq("id", f.id);
      reportarFalloQuery(ev2, { ruta: RUTA, operacion: "vigente" });
    }
  }
  return { precios, deptos: filas.length, leidos, cambios, tareas };
}

/** El correo del día: a cada persona con cambios relevantes sin avisar, uno al día como mucho. */
export async function correosDeCambios(admin: SupabaseClient, ahora: Date = new Date()): Promise<{ personas: number; enviados: number; fuera: number }> {
  const hoy = diaChile(ahora);
  const { data, error } = await admin.from("inv_cambios").select("id, user_id, aviso_id, tipo, antes, despues, fecha").eq("relevante", true).is("correo_at", null).order("created_at");
  reportarFalloQuery(error, { ruta: RUTA, operacion: "pendientes" });
  const filas = (data ?? []) as Array<{ id: string; user_id: string; aviso_id: string; tipo: TipoCambio; antes: Record<string, unknown>; despues: Record<string, unknown>; fecha: string }>;
  const porPersona = new Map<string, typeof filas>();
  for (const f of filas) porPersona.set(f.user_id, [...(porPersona.get(f.user_id) ?? []), f]);
  if (!porPersona.size) return { personas: 0, enviados: 0, fuera: 0 };
  const { modo, lista } = await estadoInterruptor();
  // Hoy ya salió uno: espera a mañana.
  const desde = new Date(ahora.getTime() - 36 * 60 * 60 * 1000).toISOString();
  const { data: hoyYa } = await admin.from("inv_cambios").select("user_id, correo_at").gte("correo_at", desde).in("user_id", Array.from(porPersona.keys()));
  const yaHoy = new Set(((hoyYa ?? []) as Array<{ user_id: string; correo_at: string }>).filter((r) => diaChile(new Date(r.correo_at)) === hoy).map((r) => r.user_id));
  let enviados = 0;
  let fuera = 0;
  for (const [userId, cs] of Array.from(porPersona.entries())) {
    if (yaHoy.has(userId)) continue;
    const { data: o } = await admin.from("inv_ordenes").select("email, nombre").eq("user_id", userId).order("firmado_at", { ascending: false }).limit(1);
    const orden = (o?.[0] ?? null) as { email?: string; nombre?: string } | null;
    if (!orden?.email || !puedeRecibirCopia(modo, lista, orden.email)) { fuera++; continue; }
    const ids = Array.from(new Set(cs.map((c) => c.aviso_id)));
    const { data: dd } = await admin.from("inv_deptos").select("aviso_id, datos").eq("user_id", userId).in("aviso_id", ids);
    const datos = new Map(((dd ?? []) as Array<{ aviso_id: string; datos: FilaElegido["datos"] }>).map((r) => [r.aviso_id, r.datos ?? {}]));
    const deptos: DeptoConCambios[] = ids.map((a) => {
      const d = datos.get(a) ?? {};
      const desc = [d.dormitorios != null ? `${d.dormitorios}D${d.banos ?? 1}B` : null, d.m2 ? `${Math.round(d.m2)} m²` : null].filter(Boolean).join(" · ");
      return { avisoId: a, comuna: d.comuna ?? "tu comuna", descripcion: desc, cambios: cs.filter((c) => c.aviso_id === a).map((c) => ({ tipo: c.tipo, antes: c.antes, despues: c.despues, fecha: c.fecha })) };
    });
    const ok = await sendCambiosInvierte({ to: orden.email, userId, nombre: orden.nombre ?? null, deptos, dia: hoy });
    if (!ok) continue;
    enviados++;
    const { error: em } = await admin.from("inv_cambios").update({ correo_at: ahora.toISOString() }).in("id", cs.map((c) => c.id));
    reportarFalloQuery(em, { ruta: RUTA, operacion: "marcar-correo" });
  }
  return { personas: porPersona.size, enviados, fuera };
}
