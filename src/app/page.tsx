// ─────────────────────────────────────────────────────────────────────────────
// Landing v14 (07-sep-2026) — cuatro pantallas, un solo CTA (el campo de
// dirección) repetido al inicio y al final. La página vende una respuesta, no un
// producto. Reemplaza completa a la landing anterior; no recicla secciones.
//
// Server component con ISR de 10 minutos: el contador de avisos, la hora del
// último scrape, el último análisis emitido y los tres ejemplos se leen en cada
// revalidación (`leerDatosLanding`). Las piezas con estado (campo, rotación,
// telemetría) son islas cliente que reciben los datos por props.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import "@/components/landing-v14/landing.css";
import { leerDatosLanding } from "@/lib/landing-vivo";
import { Hero, LaRespuesta, PorQueCreerle, Cierre } from "@/components/landing-v14/Secciones";
import { LandingViewed } from "@/components/landing-v14/Telemetria";
import { SuaveScroll } from "@/components/landing-v14/SuaveScroll";

export const revalidate = 600;

export const metadata: Metadata = {
  title: { absolute: "¿Ese depto es buena inversión? — Franco" },
  description:
    "Escribe la dirección y Franco te dice si comprar, ajustar o buscar otro: un modelo financiero, una lectura con IA y un veredicto, contra toda la oferta de Santiago.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "¿Ese depto es buena inversión? — Franco",
    description:
      "Escribe la dirección y Franco te dice si comprar, ajustar o buscar otro. Contra toda la oferta de Santiago.",
    url: "https://refranco.ai",
    siteName: "Franco",
    locale: "es_CL",
    type: "website",
  },
};

export default async function LandingPage() {
  const datos = await leerDatosLanding();
  const ahora = new Date();
  return (
    <div className="lv-root" data-franco-root data-landing="v14">
      <LandingViewed />
      <SuaveScroll />
      <main>
        <Hero />
        <LaRespuesta datos={datos} />
        <PorQueCreerle datos={datos} ahora={ahora} />
        <Cierre datos={datos} ahora={ahora} />
      </main>
    </div>
  );
}
