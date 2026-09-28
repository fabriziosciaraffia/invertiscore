// ─────────────────────────────────────────────────────────────────────────────
// El perfil de inversión (28-sep-2026): presupuesto, pie, comuna, modalidad, tipología y veredicto,
// guardado con cada análisis (`perfiles_inversion`, migración 20260928) y ligado a la persona al
// registrarse (`ligarPerfiles`, desde el claim). Solo con service role. Nunca rompe la creación
// del análisis: un perfil perdido se reporta y sigue.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";

export interface PerfilInversion {
  analysisId: string;
  userId: string | null;
  anonClaimTokenHash: string | null;
  presupuestoUf: number | null;
  piePct: number | null;
  comuna: string | null;
  modalidad: "ltr" | "str";
  tipologia: string | null;
  veredicto: string | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** «2D2B», «Studio», «3D1B»: la tipología como la dice el wizard. */
export function tipologiaDe(dormitorios: unknown, banos: unknown): string | null {
  const d = num(dormitorios);
  const b = num(banos);
  if (d === null && b === null) return null;
  const dd = d === null ? "" : d === 0 ? "Studio" : `${d}D`;
  const bb = b === null ? "" : `${b}B`;
  return `${dd}${bb}` || null;
}

export function perfilDesdeLtr(body: { precio?: unknown; piePct?: unknown; comuna?: unknown; dormitorios?: unknown; banos?: unknown }, veredicto: string | null, ids: { analysisId: string; userId: string | null; anonClaimTokenHash: string | null }): PerfilInversion {
  return {
    analysisId: ids.analysisId,
    userId: ids.userId,
    anonClaimTokenHash: ids.anonClaimTokenHash,
    presupuestoUf: num(body.precio),
    piePct: num(body.piePct),
    comuna: typeof body.comuna === "string" ? body.comuna : null,
    modalidad: "ltr",
    tipologia: tipologiaDe(body.dormitorios, body.banos),
    veredicto,
  };
}

export function perfilDesdeStr(body: { precioCompraUF?: unknown; piePct?: unknown; comuna?: unknown; dormitorios?: unknown; banos?: unknown }, veredicto: string | null, ids: { analysisId: string; userId: string | null; anonClaimTokenHash: string | null }): PerfilInversion {
  return {
    analysisId: ids.analysisId,
    userId: ids.userId,
    anonClaimTokenHash: ids.anonClaimTokenHash,
    presupuestoUf: num(body.precioCompraUF),
    piePct: num(body.piePct),
    comuna: typeof body.comuna === "string" ? body.comuna : null,
    modalidad: "str",
    tipologia: tipologiaDe(body.dormitorios, body.banos),
    veredicto,
  };
}

export async function guardarPerfil(admin: SupabaseClient, p: PerfilInversion): Promise<void> {
  const { error } = await admin.from("perfiles_inversion").upsert(
    {
      analysis_id: p.analysisId,
      user_id: p.userId,
      anon_claim_token_hash: p.anonClaimTokenHash,
      presupuesto_uf: p.presupuestoUf,
      pie_pct: p.piePct,
      comuna: p.comuna,
      modalidad: p.modalidad,
      tipologia: p.tipologia,
      veredicto: p.veredicto,
      ...(p.userId ? { linked_at: new Date().toISOString() } : {}),
    },
    { onConflict: "analysis_id" },
  );
  reportarFalloQuery(error, { ruta: "lib/lo-que-sigue/perfil", operacion: "guardar-perfil", userId: p.userId ?? undefined });
}

/** Al registrarse: los perfiles de los análisis adoptados pasan a la persona. Idempotente. */
export async function ligarPerfiles(admin: SupabaseClient, userId: string, analysisIds: string[]): Promise<void> {
  if (analysisIds.length === 0) return;
  const { error } = await admin
    .from("perfiles_inversion")
    .update({ user_id: userId, anon_claim_token_hash: null, linked_at: new Date().toISOString() })
    .in("analysis_id", analysisIds)
    .is("user_id", null);
  reportarFalloQuery(error, { ruta: "lib/lo-que-sigue/perfil", operacion: "ligar-perfiles", userId });
}
