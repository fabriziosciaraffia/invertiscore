// ─────────────────────────────────────────────────────────────────────────────
// Landing v14 (07-sep-2026; sobre master el 27-sep-2026) — cinco pantallas, un solo
// CTA (el campo de dirección) repetido al inicio y al final. La página vende una
// respuesta, no un producto.
//
// Server component con ISR de 10 minutos: la hora del último scrape, el último
// análisis emitido y los tres ejemplos se leen en cada revalidación
// (`leerDatosLanding`). Las piezas con estado (hero, campo, rotación, telemetría) son
// islas cliente que reciben los datos por props.
//
// EL HEADER ES EL ÚNICO DEL SITIO (`HeaderFranco`, sobre el material del hero, sin
// botón: el principal de la pantalla es el campo, como en la portada del wizard). Lo
// monta esta página y se lo pasa al hero, que es el de la entrada.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import "@/components/landing-v14/landing.css";
import { leerDatosLanding } from "@/lib/landing-vivo";
import { COMPARABLES_TEXTO } from "@/lib/stats";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { Hero, LaRespuesta, LoQueHaria, PorQueCreerle, Cierre } from "@/components/landing-v14/Secciones";
import { RotacionEjemplos } from "@/components/landing-v14/Rotacion";
import { LandingViewed } from "@/components/landing-v14/Telemetria";
import { SuaveScroll } from "@/components/landing-v14/SuaveScroll";

export const revalidate = 600;

export const metadata: Metadata = {
  title: { absolute: "¿Ese depto es buena inversión? — Franco" },
  description: `Escribe la dirección y Franco te dice si comprar, ajustar o buscar otro: un modelo financiero y un veredicto, contra ${COMPARABLES_TEXTO} deptos comparables de Santiago.`,
  alternates: { canonical: "/" },
  openGraph: {
    title: "¿Ese depto es buena inversión? — Franco",
    description: "Escribe la dirección y Franco te dice si comprar, ajustar o buscar otro. Contra toda la oferta de Santiago.",
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
    // `data-theme="light"` en la raíz: la landing es de material fijo, y las piezas del informe que
    // monta (la matriz y el pop-up de combinaciones) leen sus tokens del tema. Sin esto, con el
    // sitio en oscuro saldrían oscuras sobre el papel.
    <div className="lv-root" data-theme="light" data-franco-root data-landing="v14">
      <LandingViewed />
      <SuaveScroll />
      <main>
        <Hero cabecera={<HeaderFranco contexto="wizard" sobreMaterial />} />
        {/* las secciones 2 y 3 muestran el MISMO ejemplo: la rotación es una sola */}
        <RotacionEjemplos ejemplos={datos.ejemplos}>
          <LaRespuesta />
          <LoQueHaria />
        </RotacionEjemplos>
        <PorQueCreerle />
        <Cierre datos={datos} ahora={ahora} />
      </main>
    </div>
  );
}
