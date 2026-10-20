import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { PrecargaMaterialLiso } from "@/components/chrome/PrecargaMaterialLiso";
import { COOKIE_DISPOSITIVO } from "@/lib/dispositivo";
import { consentimientoDeCookie } from "@/lib/consentimiento";
import { esCargaDePagina, esRobot, eventoInvitacionVista, idPostHogDeCookies } from "@/lib/invitacion-vista";
import { CABECERA_VISITA, consultaDeParametros, esVisitaDePrueba, visitaDeCabecera } from "@/lib/vista-entrada";
import { COOKIE_PRUEBA } from "@/lib/meta/cookies";
import { capturarServidor } from "@/lib/posthog-servidor";
import { huellaDeCabeceras } from "@/lib/regalo-alta-servidor";
import { normalizarCodigo, REFERIDO_COPY } from "@/lib/referido";
import { anotarDispositivoInvitador, invitadorDePrueba, leerInvitacion } from "@/lib/referido-servidor";
import { InvitacionCliente, type ModoInvitacion } from "./invitacion-cliente";
import { portadaDeptos } from "@/lib/deptos/portada";

// ─────────────────────────────────────────────────────────────────────────────
// /i/CÓDIGO, LA PÁGINA DEL INVITADO (16-oct-2026, la puerta C): «Te invitaron a Franco. Tu primer análisis va por cuenta
// de Franco.» Las mismas preguntas de /deptos —con la puerta C y la vuelta a esta página—, o la dirección si ya trae un
// depto, que lo lleva al informe gratis (el wizard). La cookie de la invitación la deja el middleware al abrir el enlace;
// se cobra al registrarse, venga por donde venga.
// Quien invita y abre su propio enlace ve su enlace para compartir (y ese navegador queda anotado: el «mismo
// dispositivo»). Quien ya tiene cuenta, que este enlace es para quien todavía no está.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { codigo: string } }): Promise<Metadata> {
  const codigo = normalizarCodigo(params.codigo);
  const inv = codigo ? await leerInvitacion(createServiceClient(), codigo) : null;
  // La vista previa del enlace (WhatsApp, el correo): «Un amigo te invitó a Franco», o con el nombre si quien invita lo pidió.
  const titulo = REFERIDO_COPY.quien(inv?.conNombre ? inv.nombre : null);
  return {
    title: { absolute: titulo },
    description: REFERIDO_COPY.bajada,
    robots: { index: false, follow: false },
    openGraph: {
      title: titulo,
      description: REFERIDO_COPY.bajada,
      url: codigo ? `https://refranco.ai/i/${codigo}` : "https://refranco.ai",
      siteName: "Franco",
      locale: "es_CL",
      images: ["/opengraph-image"],
    },
  };
}

export default async function InvitacionPage({ params, searchParams }: { params: { codigo: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const codigo = normalizarCodigo(params.codigo);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createServiceClient();
  const inv = codigo ? await leerInvitacion(admin, codigo) : null;
  const sesion = user?.email ? { email: user.email } : null;
  // Volviendo del código o de Google, la pantalla termina el alta: es el invitado, aunque ya tenga sesión.
  const volviendo = searchParams.entro === "1" || searchParams.entro === "google";
  let modo: ModoInvitacion = "invitado";
  if (user && !volviendo) {
    if (inv && inv.userId === user.id) {
      modo = "propio";
      await anotarDispositivoInvitador(admin, user.id, huellaDeCabeceras(headers(), cookies().get(COOKIE_DISPOSITIVO)?.value ?? null).dispositivo);
    } else modo = "con_cuenta";
  }
  // LA VISITA SE MIDE ACÁ (20-oct-2026, lib/invitacion-vista.ts): en el servidor, con el código, con o sin consentimiento.
  // El navegador la perdía si la persona se iba antes de que cargara PostHog. Ni robots ni el refresco de Next.
  const cabeceras = headers();
  const agente = cabeceras.get("user-agent");
  if (esCargaDePagina(cabeceras) && !esRobot(agente)) {
    const ev = eventoInvitacionVista({
      codigo,
      ruta: `/i/${params.codigo}`,
      modo,
      conNombre: !!inv?.conNombre,
      invitadorPrueba: inv ? await invitadorDePrueba(admin, inv.userId) : false,
      userId: user?.id ?? null,
      consentimiento: consentimientoDeCookie(cabeceras.get("cookie")),
      idPostHog: idPostHogDeCookies(cookies().getAll(), process.env.NEXT_PUBLIC_POSTHOG_KEY),
      // El id de la visita lo genera el middleware: es el mismo con que arranca PostHog en el navegador (Server-Timing).
      visita: visitaDeCabecera(cabeceras.get(CABECERA_VISITA)) ?? crypto.randomUUID(),
      esCarga: true,
      agente,
      search: consultaDeParametros(searchParams),
      referer: cabeceras.get("referer"),
      prueba: esVisitaDePrueba(consultaDeParametros(searchParams), cookies().get(COOKIE_PRUEBA)?.value),
    });
    if (ev) waitUntil(capturarServidor(ev).catch(() => false));
  }
  // La misma portada que /deptos (17-oct-2026): la frase con las cifras de la noche y el número de la búsqueda por defecto.
  const portada = modo === "invitado" ? await portadaDeptos() : undefined;
  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <PrecargaMaterialLiso />
      <HeaderFranco sesion={sesion} />
      <main className="mx-auto max-w-[760px] px-4 pb-12 pt-4 sm:px-6 sm:pt-10">
        <InvitacionCliente modo={modo} codigo={codigo} nombre={inv?.conNombre ? inv.nombre : null} sesion={sesion} portada={portada} />
      </main>
      <AppFooter variant="informe" diferido />
    </div>
  );
}
