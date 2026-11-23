// ─────────────────────────────────────────────────────────────────────────────
// LO QUE MUESTRA LA TARJETA DE UN DEPTO, EN EL SERVIDOR (etapa 3, parte A, 20-nov-2026; láminas 3.3-base y 3.2-resultado): el título
// (calle y metro cercano, sin número: titulo-depto.ts), cuántas fotos tiene, su cap rate bruto y «Lo que ve Franco» si ya está. Lee
// solo lo guardado: ninguna ficha, ningún crédito. Si la lectura no está, la tarjeta la pide aparte (LoQueVeFranco) y el título queda
// con el metro o el sector hasta que llegue.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { findNearestStation } from "@/lib/metro-stations";
import type { LecturaFranco } from "./lectura-franco";
import { arriendosDeSuTamano, leerLecturas } from "./lectura-franco-servidor";
import { cifrasDeDepto, type AnalisisParaCifras } from "./cifras-motor";
import type { CifrasDepto } from "./cifras";
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
  /** La calle que confirmó Franco con quien vende (etapa 3, B1): manda sobre la que leyó la lectura. */
  calleConfirmada?: string | null;
  /** El punto de la publicación (del listado; ninguna ficha). Para el mapa chico de la página del depto (rediseño del 23-nov-2026). */
  punto?: { lat: number; lng: number } | null;
  /** LAS CUATRO CIFRAS (23-nov-2026), de una sola fuente: con la ubicación confirmada, del motor al precio publicado; si no, de la
   *  noche (cifras-motor.ts › cifrasDeDepto). `capRatePct` de arriba es el de estas cifras. */
  cifras: CifrasDepto;
}

/** Por depto: la ficha de su tarjeta. `precios`: el precio que muestra la tarjeta (el vigente), para que las cifras digan lo mismo;
 *  `flujos`: lo que deja al mes que ya trae el depto (sin ubicación confirmada, la cuarta cifra es esa). */
export async function fichasDe(admin: SupabaseClient, avisoIds: readonly string[], precios: Record<string, number | null | undefined> = {}, flujos: Record<string, number | null | undefined> = {}): Promise<Record<string, FichaDepto>> {
  const ids = Array.from(new Set(avisoIds)).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
  if (!ids.length) return {};
  const [{ data: sp }, { data: ae }, { data: cfg }, fotos, lecturas, { data: ub }] = await Promise.all([
    // Lote acotado: a lo más 100 ids (arriba), muy bajo el corte de mil de PostgREST.
    admin.from("scraped_properties").select("id, comuna, lat, lng, superficie_m2").in("id", ids).order("id").limit(100),
    admin.from("avisos_evaluados").select("aviso_id, precio_uf, arriendo, flujo_20").in("aviso_id", ids),
    admin.from("config").select("value").eq("key", "uf_value").maybeSingle(),
    fotosDe(admin, ids),
    leerLecturas(admin, ids),
    admin.from("inv_ubicaciones").select("aviso_id, direccion, analisis").in("aviso_id", ids),
  ]);
  const ubs = (ub ?? []) as { aviso_id: string; direccion: string; analisis: AnalisisParaCifras | null }[];
  const confirmada = new Map(ubs.map((x) => [x.aviso_id, x.direccion]));
  const analisis = new Map(ubs.map((x) => [x.aviso_id, x.analisis]));
  const uf = Number(cfg?.value);
  const ufOk = Number.isFinite(uf) && uf > 0 ? uf : null;
  const props = new Map(((sp ?? []) as { id: string; comuna: string | null; lat: number | null; lng: number | null; superficie_m2: number | null }[]).map((f) => [f.id, f]));
  const evals = new Map(((ae ?? []) as { aviso_id: string; precio_uf: number | null; arriendo: { monto?: number; radio?: number } | null; flujo_20: number | null }[]).map((f) => [f.aviso_id, f]));
  // Los arriendos de su tamaño (la marca gris): con la ubicación confirmada vienen contados en el análisis; si no, se cuentan acá, en
  // paralelo, cortando apenas hay MIN_ARRIENDOS_COMPARABLES.
  const comparables: Record<string, number | null> = {};
  await Promise.all(ids.map(async (id) => {
    const a = analisis.get(id);
    if (a && a.comparables != null) { comparables[id] = a.comparables; return; }
    const p = props.get(id), e = evals.get(id);
    const m2 = p?.superficie_m2 == null ? null : Number(p.superficie_m2);
    comparables[id] = p?.lat != null && p?.lng != null && m2 ? await arriendosDeSuTamano(admin, { lat: Number(p.lat), lng: Number(p.lng), radio: e?.arriendo?.radio ?? 1000, m2 }) : null;
  }));
  const out: Record<string, FichaDepto> = {};
  for (const id of ids) {
    const p = props.get(id);
    const e = evals.get(id);
    const est = p?.lat != null && p?.lng != null ? findNearestStation(Number(p.lat), Number(p.lng), "active") : null;
    const metro = est ? { estacion: est.station.name, metros: est.distance } : null;
    const lectura = lecturas[id] ?? null;
    const precio = precios[id] ?? (e?.precio_uf != null ? Number(e.precio_uf) : null);
    const a = analisis.get(id) ?? null;
    const cifras = cifrasDeDepto({
      publicadoUF: precio, arriendoNoche: e?.arriendo?.monto != null ? Number(e.arriendo.monto) : null,
      flujoNoche: flujos[id] !== undefined ? flujos[id] ?? null : e?.flujo_20 != null ? Number(e.flujo_20) : null,
      analisis: a, uf: ufOk, comparables: comparables[id],
    });
    out[id] = {
      titulo: tituloDepto({ calle: confirmada.get(id) ?? lectura?.calle ?? null, metro, comuna: p?.comuna ?? null }), calleConfirmada: confirmada.get(id) ?? null,
      metro, comuna: p?.comuna ?? null, fotos: fotos[id] ?? 0, lectura,
      capRatePct: cifras.capRatePct, cifras,
      punto: p?.lat != null && p?.lng != null ? { lat: Number(p.lat), lng: Number(p.lng) } : null,
    };
  }
  return out;
}
