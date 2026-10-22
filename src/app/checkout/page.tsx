import type { Metadata } from "next";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { createClient } from "@/lib/supabase/server";
import { PLANO, UI_PLANO } from "@/components/plano/plano";
import { resumenCompra } from "@/lib/compra/compra";
import { leerReanalisis } from "@/lib/reanalisis";
import { direccionCorta } from "@/components/entrada/llegada";
import { PRODUCTO_PLAN } from "@/lib/planes";
import { PRODUCTO_PACK, venceEl } from "@/lib/lo-que-sigue/oferta-pack";
import { PRODUCTO_TRES, esOrigenTres, volverSeguro } from "@/lib/tres-analisis";
import { deptoDeVolver } from "@/lib/guia/compra-desde-depto";
import { ticketDeCuentaDisponible } from "@/lib/lo-que-sigue/ticket-cuenta-servidor";
import { seleccionPorToken } from "@/lib/guia/semanal-servidor";
import { createServiceClient } from "@/lib/supabase/service";
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
// DESDE UN DEPTO DE LA SELECCIÓN (21-oct-2026, lib/guia/compra-desde-depto.ts): el pack —al precio del ticket si la cuenta
// tiene menos de 24 horas— y el suelto llegan con la vuelta a ese depto, y la pantalla dice cuál es.
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
  const conVuelta = esTres || ((productKey === PRODUCTO_PACK || productKey === "single") && !analysisId);
  const volver = conVuelta ? volverSeguro(uno(searchParams, "volver")) : null;
  const varianteParam = uno(searchParams, "variante");
  const varianteCorreo = origen === "semanal" && (varianteParam === "banda" || varianteParam === "tarjetas") ? varianteParam : null;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // La comuna del análisis atado (el paso 4 del wizard): «Tu análisis en Providencia». Si es el re-análisis al precio
  // recomendado (21-oct-2026, lib/reanalisis.ts), el depto y el precio.
  const atado = analysisId && productKey === "single"
    ? (await supabase.from("analisis").select("comuna, input_data").eq("id", analysisId).maybeSingle()).data
    : null;
  const comuna = (atado?.comuna as string | undefined) ?? null;
  const marca = leerReanalisis((atado?.input_data as Record<string, unknown> | null)?.reanalisis);
  const dirAtado = (atado?.input_data as Record<string, unknown> | null)?.direccion;
  const reanalisis = marca ? { direccion: typeof dirAtado === "string" && dirAtado.trim() ? direccionCorta(dirAtado) : null, precioUF: marca.precioRecomendadoUF } : null;
  const resumen = resumenCompra(productKey, { analysisId, companionStrId, comuna, reanalisis });

  // El depto de la vuelta, si es de su selección: «Para analizar Santiago · 2D · 54 m² · UF 3.450».
  const deVuelta = user ? deptoDeVolver(volver) : null;
  const admin = deVuelta || (user && productKey === PRODUCTO_PACK && !analysisId) ? createServiceClient() : null;
  const sel = deVuelta && admin ? await seleccionPorToken(admin, deVuelta.t) : null;
  const itemDepto = sel && sel.user_id === user?.id ? [...sel.items, ...(sel.corto?.items ?? [])].find((i) => i.avisoId === deVuelta?.a) ?? null : null;
  const depto = itemDepto
    ? [itemDepto.comuna, itemDepto.tipologia, itemDepto.m2 > 0 ? `${Math.round(itemDepto.m2).toLocaleString("es-CL")} m²` : null, `UF ${Math.round(itemDepto.precioUF).toLocaleString("es-CL")}`].filter(Boolean).join(" · ")
    : null;
  // El pack sin informe atado es el ticket de la cuenta nueva: la vigencia la dice el servidor, desde la cuenta.
  const packCuenta = user && admin && productKey === PRODUCTO_PACK && !analysisId
    ? { vigente: await ticketDeCuentaDisponible(admin, user), venceAt: venceEl(user.created_at).toISOString() }
    : null;

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
          packCuenta={packCuenta}
          depto={depto}
          sesionEmail={user?.email ?? null}
          conPlan={conPlan}
          pagarAlEntrar={uno(searchParams, "pagar") === "1"}
          // «Volver» vuelve adonde estaba: desde planes, a planes (el `volver` de la compra es adónde ir DESPUÉS de pagar).
          // Desde un depto, «Volver» lo deja en la selección sin analizarlo.
          volverHref={origen === "planes" || (!esTres && !volver) ? "/pricing" : !volver ? "/dashboard" : deVuelta ? volver.replace(/&analizar=1/, "") : volver}
        />
      </main>
      <AppFooter variant="informe" />
    </div>
  );
}
