// ─────────────────────────────────────────────────────────────────────────────
// La oferta del pack de un informe, leída en el servidor (08-oct-2026; reglas en `oferta-informe.ts`).
// Lee lo que el navegador no puede: si hay un pack pagado para el informe, y el correo de la cuenta
// cuando quien mira es su navegador de origen sin sesión (el caso del pago fallido: el pack crea la
// cuenta y liga el informe ANTES de ir a Flow). El cliente de servicio entra por parámetro: el tier
// lo reemplaza por uno de mentira.
// EL TICKET DE LA CUENTA NUEVA (21-oct-2026, recorrido real de Fabrizio por la puerta B): el ticket es de toda cuenta nueva,
// por cualquier puerta. Todo informe de una cuenta que nació en sus primeras 24 horas lo lleva igual que el informe anónimo
// —desde el 22-oct-2026 no solo el primero: una compra suelta no lo apaga—; la ventana es la de la cuenta (`desde`), la
// misma del precio del pack en el pop-up sin saldo (lib/guia/compra-desde-depto.ts).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { hayPackPagado, nacioAnonimo, ofertaPackDelInforme, type QuienMira } from "./oferta-informe";
import { PRODUCTO_PACK } from "./oferta-pack";
import type { MotivoOferta } from "./diagnostico-ticket";
import { ticketEnElInforme } from "@/lib/guia/compra-desde-depto";
import { packPagadoPorCuenta } from "./ticket-cuenta-servidor";

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
    /** Para el ticket de la cuenta nueva: cuándo nació la cuenta de quien mira con su sesión, y el informe. */
    cuenta?: { creadaAt: string | null; informeCreadoAt: string | null; ambasGroupId?: string | null } | null;
  },
): Promise<{ oferta: boolean; correo: string | null; motivo: MotivoOferta; desde: string | null }> {
  // El motivo va al diagnóstico de `?lqs=1` (12-oct-2026): por qué hay o no hay oferta, en este orden. `desde`: desde
  // cuándo corren las 24 horas del ticket; null = desde que nació el informe (el anónimo).
  const nacio = nacioAnonimo(p.fila);
  if (p.esDemo) return { oferta: false, correo: null, motivo: "demo", desde: null };
  if (p.quienMira === null) return { oferta: false, correo: null, motivo: "no-dueno", desde: null };
  if (!nacio) {
    const c = p.cuenta;
    if (p.quienMira === "sesion" && p.duenoId && c?.creadaAt && c.informeCreadoAt) {
      const packPagado = await packPagadoPorCuenta(admin, p.duenoId);
      if (ticketEnElInforme({ cuentaCreadaAt: c.creadaAt, informeCreadoAt: c.informeCreadoAt, packPagado })) {
        return { oferta: true, correo: p.correoSesion, motivo: "cuenta-nueva", desde: c.creadaAt };
      }
    }
    return { oferta: false, correo: null, motivo: "no-nacio-anonimo", desde: null };
  }

  const { data: pagos } = await admin.from("payments").select("product, status").eq("analysis_id", p.analysisId).eq("product", PRODUCTO_PACK);
  const oferta = ofertaPackDelInforme({
    nacioAnonimo: nacio,
    quienMira: p.quienMira,
    packPagado: hayPackPagado(Array.isArray(pagos) ? (pagos as { product: string | null; status: string | null }[]) : []),
    esDemo: p.esDemo,
  });
  if (!oferta) return { oferta: false, correo: null, motivo: "pack-pagado", desde: null };

  if (p.quienMira === "sesion") return { oferta, correo: p.correoSesion, motivo: "ofrecida", desde: null };
  if (p.quienMira === "origen" && p.duenoId) {
    // Su navegador, sin sesión: la cookie prueba que el informe es suyo, y el correo es el de la cuenta
    // que se creó al registrarse o al intentar pagar. Con él, el ticket no lo vuelve a pedir.
    try {
      const { data } = await admin.auth.admin.getUserById(p.duenoId);
      return { oferta, correo: data.user?.email ?? null, motivo: "ofrecida", desde: null };
    } catch {
      return { oferta, correo: null, motivo: "ofrecida", desde: null };
    }
  }
  return { oferta, correo: null, motivo: "ofrecida", desde: null };
}
