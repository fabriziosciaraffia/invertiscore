import { redirect } from "next/navigation";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { PLANO, UI_PLANO } from "@/components/plano/plano";
import { createClient } from "@/lib/supabase/server";
import { FLOW_PRODUCTS } from "@/lib/flow-products";
import { fmtCLP } from "@/lib/pricing";
import { PLANES_COPY, PRODUCTO_PLAN } from "@/lib/planes";
import { CAMBIAR_TARJETA_COPY, RUTA_CAMBIAR_TARJETA } from "@/lib/subscriptions/suscripcion";
import { RegistrarTarjeta } from "./registrar-tarjeta";

// ─────────────────────────────────────────────────────────────────────────────
// CAMBIAR LA TARJETA DE UN PLAN EN LA GRACIA (05-nov-2026, auditoría de promesas parte 2, decisión de Fabrizio). «Ver cómo
// pagar» (/cuenta), «Actualiza tu método de pago» (/perfil) y el correo del cobro rechazado llevan acá, no a /pricing: de ahí
// salía una segunda suscripción con la primera viva. Registra la tarjeta nueva en Flow y register-callback cancela allá la
// anterior antes de abrir la nueva (lib/subscriptions/flow-vivas.ts). Lo fija el tier SUSCRIPCION.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export default async function CambiarTarjetaPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(RUTA_CAMBIAR_TARJETA)}`);

  const { data: fila } = await supabase.from("user_credits").select("subscription_status").eq("user_id", user.id).maybeSingle();
  const conPendiente = fila?.subscription_status === "past_due";
  const C = CAMBIAR_TARJETA_COPY;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <HeaderFranco sesion={{ email: user.email ?? "" }} />
      <main className={PLANO.main} style={{ fontFamily: UI_PLANO }} data-tarjeta={conPendiente ? "cambiar" : "sin-pendiente"}>
        <h1 className={PLANO.titulo}>{C.titulo}</h1>
        {conPendiente ? (
          <>
            <p className={PLANO.bajada}>{C.cuerpo(PLANES_COPY.plan.nombre, fmtCLP(FLOW_PRODUCTS[PRODUCTO_PLAN].amount))}</p>
            <div className={PLANO.seccion}>
              <RegistrarTarjeta />
            </div>
          </>
        ) : (
          <>
            <p className={PLANO.bajada}>{C.sinPendiente}</p>
            <div className={PLANO.seccion}>
              <EnlaceCarga href="/cuenta" className={PLANO.principal}>{C.verCuenta}</EnlaceCarga>
            </div>
          </>
        )}
      </main>
      <AppFooter variant="informe" />
    </div>
  );
}
