// ─────────────────────────────────────────────────────────────────────────────
// Los primeros deptos de una cuenta (16-oct-2026, la puerta B): lo que muestran «Estás dentro» al terminar y el dashboard
// de una cuenta sin informes. Si el correo del día ya eligió (sus deptos chequeados), esos, con la hora en que se vieron
// publicados; si todavía no, los mejores de la evaluación de la noche para su perfil (o de las comunas vecinas, si en las
// suyas no hay), con el día y la hora de su último chequeo si es de la última semana y «por confirmar» si no. Sin fichas:
// lo que ya se sabe.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { rangoSemanal } from "@/lib/guia/semanal";
import { comunaDeAviso } from "@/lib/guia/semanal-candidatos";
import type { ItemSemanal } from "@/lib/guia/semanal-servidor";
import { regaloAltaVivo } from "@/lib/regalo-alta-servidor";
import { MAX_PRIMEROS, primerosDeptos, type PrimerDepto } from "./servidor";
import { PIE_DEPTOS } from "./estandar";
import { MINUTOS_CUPO_DEL_DIA } from "@/lib/guia/del-dia";
import { comunasVecinas } from "@/lib/comunas-vecinas";

export interface PrimerosDeLaCuenta {
  /** El correo del día todavía está revisando fichas (la pantalla vuelve a preguntar). */
  revisando: boolean;
  items: PrimerDepto[];
  /** El token de su selección del día: «Ver y analizar» abre /semanal con él. */
  token: string | null;
  regaloVence: string | null;
  /** En sus comunas no había ninguno: estos son de las comunas vecinas (el mismo respaldo que el correo). */
  vecinas?: boolean;
}

export async function primerosDeLaCuenta(admin: SupabaseClient, userId: string, ahora: Date = new Date()): Promise<PrimerosDeLaCuenta> {
  const [{ data: fila }, regaloVence] = await Promise.all([
    admin.from("semanal_selecciones").select("id, token, estado, items, armada_at, enviada_at").eq("user_id", userId).eq("tipo", "del_dia")
      .order("armada_at", { ascending: false }).limit(1).maybeSingle(),
    regaloAltaVivo(admin, userId, ahora),
  ]);
  const items = ((fila?.items ?? []) as ItemSemanal[]).filter((i) => i.veredicto);
  const minutos = fila ? (ahora.getTime() - Date.parse(fila.armada_at as string)) / 60_000 : Infinity;
  const revisando = !!fila && fila.estado === "pendiente" && !fila.enviada_at && minutos < MINUTOS_CUPO_DEL_DIA + 15;
  if (items.length > 0) {
    const { data: pubs } = await admin.from("publicacion_avisos").select("aviso_id, chequeado_at").in("aviso_id", items.map((i) => i.avisoId)).eq("estado", "publicado");
    const at = new Map(((pubs ?? []) as Array<{ aviso_id: string; chequeado_at: string }>).map((p) => [p.aviso_id, p.chequeado_at]));
    return {
      revisando, token: (fila?.token as string | null) ?? null, regaloVence,
      items: items.slice(0, MAX_PRIMEROS).map((i) => ({
        avisoId: i.avisoId, comuna: i.comuna, tipologia: i.tipologia, m2: i.m2, precioUF: i.precioUF, veredicto: i.veredicto ?? "COMPRAR",
        score: i.score, flujo: i.flujo, vistoAt: at.get(i.avisoId) ?? null, enSeleccion: true,
      })),
    };
  }
  // Todavía sin la selección del día: los mejores de la noche para su perfil.
  const pp = await leerPerfilBusqueda(admin, userId);
  const perfil = pp.perfilLtr ?? pp.perfil;
  const rango = rangoSemanal(perfil);
  if (!perfil.completo || !rango) return { revisando, items: [], token: (fila?.token as string | null) ?? null, regaloVence };
  const buscar = (comunas: string[]) => primerosDeptos(admin, {
    comunas, dorms: perfil.dormitorios, ufMin: rango.ufMin, ufMax: rango.ufMax, pie: perfil.piePct ?? PIE_DEPTOS,
  }, ahora);
  const propias = perfil.comunas.map(comunaDeAviso);
  const deLaNoche = await buscar(propias);
  // Sin ninguno en sus comunas, las vecinas (como el correo del día, semanal.ts › el respaldo).
  const vecinas = deLaNoche.length === 0 ? await buscar(comunasVecinas(propias).filter((c) => !propias.includes(c))) : [];
  return { revisando, items: deLaNoche.length ? deLaNoche : vecinas, vecinas: deLaNoche.length === 0 && vecinas.length > 0, token: (fila?.token as string | null) ?? null, regaloVence };
}
