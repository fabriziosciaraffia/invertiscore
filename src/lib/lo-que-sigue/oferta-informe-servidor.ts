// ─────────────────────────────────────────────────────────────────────────────
// La oferta del pack de un informe, leída en el servidor (08-oct-2026; reglas en `oferta-informe.ts`).
// Lee lo que el navegador no puede: si hay un pack pagado para el informe, y el correo de la cuenta
// cuando quien mira es su navegador de origen sin sesión (el caso del pago fallido: el pack crea la
// cuenta y liga el informe ANTES de ir a Flow). El cliente de servicio entra por parámetro: el tier
// lo reemplaza por uno de mentira.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { hayPackPagado, nacioAnonimo, ofertaPackDelInforme, type QuienMira } from "./oferta-informe";
import { PRODUCTO_PACK } from "./oferta-pack";

export async function leerOfertaPack(
  admin: SupabaseClient,
  p: {
    analysisId: string;
    fila: { anon_claim_token_hash?: string | null; anon_origen_hash?: string | null };
    quienMira: QuienMira;
    esDemo: boolean;
    /** El correo de la sesión, si quien mira entró con su cuenta. */
    correoSesion: string | null;
    /** El dueño de la fila (null si sigue anónima). */
    duenoId: string | null;
  },
): Promise<{ oferta: boolean; correo: string | null }> {
  const nacio = nacioAnonimo(p.fila);
  if (!nacio || p.quienMira === null || p.esDemo) return { oferta: false, correo: null };

  const { data: pagos } = await admin.from("payments").select("product, status").eq("analysis_id", p.analysisId).eq("product", PRODUCTO_PACK);
  const oferta = ofertaPackDelInforme({
    nacioAnonimo: nacio,
    quienMira: p.quienMira,
    packPagado: hayPackPagado(Array.isArray(pagos) ? (pagos as { product: string | null; status: string | null }[]) : []),
    esDemo: p.esDemo,
  });
  if (!oferta) return { oferta: false, correo: null };

  if (p.quienMira === "sesion") return { oferta, correo: p.correoSesion };
  if (p.quienMira === "origen" && p.duenoId) {
    // Su navegador, sin sesión: la cookie prueba que el informe es suyo, y el correo es el de la cuenta
    // que se creó al registrarse o al intentar pagar. Con él, el ticket no lo vuelve a pedir.
    try {
      const { data } = await admin.auth.admin.getUserById(p.duenoId);
      return { oferta, correo: data.user?.email ?? null };
    } catch {
      return { oferta, correo: null };
    }
  }
  return { oferta, correo: null };
}
