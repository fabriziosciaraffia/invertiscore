import type { Metadata } from "next";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { createClient } from "@/lib/supabase/server";
import { PLANO, UI_PLANO } from "@/components/plano/plano";
import { resumenCompra } from "@/lib/compra/compra";
import { PRODUCTO_PLAN } from "@/lib/planes";
import { PRODUCTO_PACK } from "@/lib/lo-que-sigue/oferta-pack";
import { PRODUCTO_TRES, esOrigenTres, volverSeguro } from "@/lib/tres-analisis";
import { CompraCliente } from "./compra-cliente";

// ─────────────────────────────────────────────────────────────────────────────
// /checkout, LA PANTALLA DE COMPRA (19-oct-2026, decisión de Fabrizio): una sola pantalla antes de Flow, en el diseño
// actual. El producto, el precio y lo que incluye en una línea; sin sesión, el correo («o con Google») y «Pagar $19.990»,
// que manda el código y, al confirmarlo, va directo a Flow; con sesión, el correo puesto y solo el botón de pagar. Ya no
// manda a /registro ni a /entrar: el código se pide acá (compra-cliente.tsx). La sesión y el plan se leen en el servidor,
// así la pantalla llega con el correo puesto, sin un «Cargando...» antes.
// Llegan acá: la página de planes (pack, suelto y plan), «Analizar este» sin saldo de la página semanal y de la guía (el
// pack de tres, con su origen y su vuelta), el dashboard, los correos, el paso 4 del wizard (un análisis atado) y el
// ticket del primer informe (el pack de 24 horas). Lo fija el tier COMPRA.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Comprar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Busqueda = Record<string, string | string[] | undefined>;
const uno = (sp: Busqueda, k: string): string | null => {
  const v = sp[k];
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? null : null;
};

export default async function CheckoutPage({ searchParams }: { searchParams: Busqueda }) {
  const productKey = uno(searchParams, "product") || "single";
  const analysisId = uno(searchParams, "analysisId");
  // Flujo AMBAS pre-pago: el STR companion viaja junto al LTR (analysisId); confirm desbloquea las dos filas.
  const companionStrId = uno(searchParams, "companionStrId");
  // La compra que viene del correo semanal (02-oct-2026) o del aviso inmediato (05-oct-2026): viaja a payment_data para
  // medirla. Y el pack de tres (13-oct-2026), con su origen y adónde volver.
  const esTres = productKey === PRODUCTO_TRES;
  const origenParam = uno(searchParams, "origen");
  const origen = origenParam === "semanal" ? "semanal" : origenParam === "inmediato" ? "inmediato" : esTres && esOrigenTres(origenParam) ? origenParam : null;
  const volver = esTres ? volverSeguro(uno(searchParams, "volver")) : null;
  const varianteParam = uno(searchParams, "variante");
  const varianteCorreo = origen === "semanal" && (varianteParam === "banda" || varianteParam === "tarjetas") ? varianteParam : null;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // La comuna del análisis atado (el paso 4 del wizard): «Tu análisis en Providencia».
  const comuna = analysisId && productKey === "single"
    ? ((await supabase.from("analisis").select("comuna").eq("id", analysisId).maybeSingle()).data?.comuna as string | undefined) ?? null
    : null;
  const resumen = resumenCompra(productKey, { analysisId, companionStrId, comuna });

  // Un producto que no existe o ya no se vende (19-oct-2026): «Plan no encontrado», sin pedir nada.
  if (!resumen) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--franco-bg)] text-[var(--franco-text)]">
        <HeaderFranco sesion={user ? { email: user.email ?? "" } : null} />
        <main className={PLANO.main} style={{ fontFamily: UI_PLANO }} data-compra="no-encontrado">
          <h1 className={PLANO.titulo}>Plan no encontrado</h1>
          <p className={PLANO.bajada}>El plan que buscas no existe o ya no está disponible.</p>
          <div className={PLANO.seccion}>
            <EnlaceCarga href="/pricing" className={PLANO.principal}>Ver los planes</EnlaceCarga>
          </div>
        </main>
        <AppFooter variant="informe" />
      </div>
    );
  }

  // Quien ya tiene un plan vigente no vuelve a contratarlo (el servidor lo rechazaría igual).
  const { data: cuenta } = user && productKey === PRODUCTO_PLAN
    ? await supabase.from("user_credits").select("subscription_status, is_unlimited").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const conPlan = !!cuenta && (cuenta.is_unlimited === true || cuenta.subscription_status === "active");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--franco-bg)] text-[var(--franco-text)]">
      {/* Sin sesión, el header no ofrece «Entrar»: la compra pide el correo acá mismo. */}
      <HeaderFranco sesion={user ? { email: user.email ?? "" } : null} contexto={user ? "sitio" : "auth"} />
      <main className={PLANO.main} style={{ fontFamily: UI_PLANO }}>
        <CompraCliente
          productKey={productKey}
          resumen={resumen}
          analysisId={analysisId}
          companionStrId={companionStrId}
          origen={origen}
          varianteCorreo={varianteCorreo}
          volver={volver}
          esTres={esTres}
          esPack={productKey === PRODUCTO_PACK}
          sesionEmail={user?.email ?? null}
          conPlan={conPlan}
          pagarAlEntrar={uno(searchParams, "pagar") === "1"}
          // «Volver» vuelve adonde estaba: desde planes, a planes (el `volver` de la compra es adónde ir DESPUÉS de pagar).
          volverHref={origen === "planes" || !esTres ? "/pricing" : volver ?? "/dashboard"}
        />
      </main>
      <AppFooter variant="informe" />
    </div>
  );
}
