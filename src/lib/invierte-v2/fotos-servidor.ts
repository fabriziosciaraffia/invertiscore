// Cuántas fotos tiene cada depto (entrega 3 de las láminas del 19-nov-2026), para las flechas. Solo cuenta: las direcciones
// nunca salen del servidor (las sirve /api/invierte-v2/foto, fotos.ts). Sin lectura o sin fotos, 0: la tarjeta va sin foto.
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_FOTOS_VISTA } from "./fotos";

export async function fotosDe(admin: SupabaseClient, avisoIds: readonly string[]): Promise<Record<string, number>> {
  const ids = Array.from(new Set(avisoIds)).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  const out: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  if (!ids.length) return out;
  const { data } = await admin.from("publicacion_detalle").select("aviso_id, fotos").in("aviso_id", ids.slice(0, 100));
  for (const f of (data ?? []) as { aviso_id: string; fotos: string[] | null }[]) out[f.aviso_id] = Math.min((f.fotos ?? []).length, MAX_FOTOS_VISTA);
  return out;
}
