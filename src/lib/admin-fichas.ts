// Las lecturas de ficha de las últimas 24 horas, por motivo (01-oct-2026), para el panel de operación.
// Cada GET queda en `lecturas_ficha` con su código y su motivo (src/lib/guia/publicacion.ts); un chequeo
// son dos —«redirige» de la ficha vieja a la nueva, y el resultado—. El tope es de 30 por hora, así que
// 24 horas no pasan de 720 filas: bajo el corte de 1.000 de PostgREST.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MotivoFicha } from "@/lib/guia/publicacion";

export const MOTIVOS_FICHA: MotivoFicha[] = ["redirige", "publicado", "despublicado", "bloqueo", "error", "tiempo"];
const ROTULO: Record<MotivoFicha, string> = { redirige: "salto", publicado: "pub", despublicado: "desp", bloqueo: "bloq", error: "err", tiempo: "tiempo" };

export interface LecturasFicha {
  total: number;
  porMotivo: Record<MotivoFicha, number>;
  ultimoBloqueo: { leidoAt: string; codigo: number | null } | null;
  falla: boolean;
}

export async function leerLecturasFicha(sb: SupabaseClient): Promise<LecturasFicha> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb.from("lecturas_ficha").select("motivo, codigo, leido_at").gte("leido_at", desde).order("leido_at", { ascending: false }).limit(1000);
  const porMotivo = Object.fromEntries(MOTIVOS_FICHA.map((m) => [m, 0])) as Record<MotivoFicha, number>;
  let ultimoBloqueo: LecturasFicha["ultimoBloqueo"] = null;
  for (const f of (data ?? []) as Array<{ motivo: MotivoFicha; codigo: number | null; leido_at: string }>) {
    if (f.motivo in porMotivo) porMotivo[f.motivo]++;
    if (f.motivo === "bloqueo" && !ultimoBloqueo) ultimoBloqueo = { leidoAt: f.leido_at, codigo: f.codigo };
  }
  return { total: data?.length ?? 0, porMotivo, ultimoBloqueo, falla: !!error };
}

/** La pastilla: un bloqueo es rojo (y alertó por correo); errores o tiempo agotado, gris oscuro; un
 *  despublicado es lo esperable y no cambia el color. */
export function pastillaFichas(l: LecturasFicha): { value: string; estado: "ok" | "warn" | "error" } {
  if (l.falla) return { value: "sin lectura", estado: "warn" };
  const partes = MOTIVOS_FICHA.filter((m) => l.porMotivo[m] > 0).map((m) => `${l.porMotivo[m]} ${ROTULO[m]}`);
  return {
    value: l.total === 0 ? "sin lecturas" : `${l.total} · ${partes.join(" · ")}`,
    estado: l.porMotivo.bloqueo > 0 ? "error" : l.porMotivo.error + l.porMotivo.tiempo > 0 ? "warn" : "ok",
  };
}
