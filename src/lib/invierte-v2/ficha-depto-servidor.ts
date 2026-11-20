// ─────────────────────────────────────────────────────────────────────────────
// LO QUE MUESTRA LA TARJETA DE UN DEPTO, EN EL SERVIDOR (etapa 3, parte A, 20-nov-2026; láminas 3.3-base y 3.2-resultado): el título
// (calle y metro cercano, sin número: titulo-depto.ts), cuántas fotos tiene, su cap rate bruto y «Lo que ve Franco» si ya está. Lee
// solo lo guardado: ninguna ficha, ningún crédito. Si la lectura no está, la tarjeta la pide aparte (LoQueVeFranco) y el título queda
// con el metro o el sector hasta que llegue.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { capRatePct } from "@/lib/explorar/explorar";
import { findNearestStation } from "@/lib/metro-stations";
import type { LecturaFranco } from "./lectura-franco";
import { leerLecturas } from "./lectura-franco-servidor";
import { fotosDe } from "./fotos-servidor";
import { tituloDepto } from "./titulo-depto";

export interface FichaDepto {
  titulo: string;
  /** Las partes del título sin la calle, para rehacerlo cuando la lectura llegue después (en el navegador). */
  metro: { estacion: string; metros: number } | null;
  comuna: string | null;
  fotos: number;
  capRatePct: number | null;
  lectura: LecturaFranco | null;
}

/** Por depto: la ficha de su tarjeta. `precios`: el precio que muestra la tarjeta (el vigente), para que el cap rate diga lo mismo. */
export async function fichasDe(admin: SupabaseClient, avisoIds: readonly string[], precios: Record<string, number | null | undefined> = {}): Promise<Record<string, FichaDepto>> {
  const ids = Array.from(new Set(avisoIds)).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
  if (!ids.length) return {};
  const [{ data: sp }, { data: ae }, { data: cfg }, fotos, lecturas] = await Promise.all([
    // Lote acotado: a lo más 100 ids (arriba), muy bajo el corte de mil de PostgREST.
    admin.from("scraped_properties").select("id, comuna, lat, lng").in("id", ids).order("id").limit(100),
    admin.from("avisos_evaluados").select("aviso_id, precio_uf, arriendo").in("aviso_id", ids),
    admin.from("config").select("value").eq("key", "uf_value").maybeSingle(),
    fotosDe(admin, ids),
    leerLecturas(admin, ids),
  ]);
  const uf = Number(cfg?.value);
  const props = new Map(((sp ?? []) as { id: string; comuna: string | null; lat: number | null; lng: number | null }[]).map((f) => [f.id, f]));
  const evals = new Map(((ae ?? []) as { aviso_id: string; precio_uf: number | null; arriendo: { monto?: number } | null }[]).map((f) => [f.aviso_id, f]));
  const out: Record<string, FichaDepto> = {};
  for (const id of ids) {
    const p = props.get(id);
    const e = evals.get(id);
    const est = p?.lat != null && p?.lng != null ? findNearestStation(Number(p.lat), Number(p.lng), "active") : null;
    const metro = est ? { estacion: est.station.name, metros: est.distance } : null;
    const lectura = lecturas[id] ?? null;
    const precio = precios[id] ?? (e?.precio_uf != null ? Number(e.precio_uf) : null);
    out[id] = {
      titulo: tituloDepto({ calle: lectura?.calle ?? null, metro, comuna: p?.comuna ?? null }),
      metro, comuna: p?.comuna ?? null, fotos: fotos[id] ?? 0, lectura,
      capRatePct: precio ? capRatePct(e?.arriendo?.monto ?? null, precio, Number.isFinite(uf) && uf > 0 ? uf : null) : null,
    };
  }
  return out;
}
