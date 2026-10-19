import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { DEPTOS_COPY } from "@/lib/deptos/respuesta";
import { hrefAnalizar } from "@/lib/cta-analizar";
import { portadaDeptos } from "@/lib/deptos/portada";
import { DeptosCliente } from "./deptos-cliente";

// ─────────────────────────────────────────────────────────────────────────────
// /deptos, LA PUERTA B (16-oct-2026, decisiones de Fabrizio): para quien no tiene un depto en la mira. Una sola pantalla,
// rápida, sin mapa ni Google Places: tres preguntas con chips, la respuesta al instante con la evaluación de la noche,
// el registro con correo y código, «Estás dentro» y sus primeros deptos antes de cerrar la pestaña. Una sola página para
// el anuncio, el retargeting y lo orgánico: las UTM distinguen (useAttributionSync), la puerta es B.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: DEPTOS_COPY.titular,
  description: "Cada noche Franco revisa los deptos en venta publicados en Santiago. Cada semana te manda los que convienen como inversión con tu pie.",
  alternates: { canonical: "/deptos" },
  openGraph: {
    title: DEPTOS_COPY.titular,
    description: "Cada noche Franco revisa los deptos en venta publicados en Santiago. Cada semana te manda los que convienen como inversión con tu pie.",
    url: "https://refranco.ai/deptos",
    siteName: "Franco",
    locale: "es_CL",
    images: ["/opengraph-image"],
  },
};

export const dynamic = "force-dynamic";

export default async function DeptosPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sesion = user?.email ? { email: user.email } : null;
  // Lo que se ve al entrar, desde el servidor (17-oct-2026): la frase con las cifras de la noche y el número de la búsqueda
  // por defecto, así el número y el correo están desde el primer segundo.
  const portada = await portadaDeptos();
  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <HeaderFranco sesion={sesion} />
      <main className="mx-auto max-w-[760px] px-4 pb-12 pt-4 sm:px-6 sm:pt-10">
        {/* Desde «Empezar gratis» de la página de planes (19-oct-2026): una línea arriba con qué hacer acá y, para quien ya
            tiene un depto en la mira, el wizard. */}
        {searchParams?.desde === "planes" && (
          <p className="mb-5 text-[15px] leading-[1.5] text-[var(--franco-text-secondary)]" style={{ fontFamily: "var(--font-ui), Inter, sans-serif" }} data-deptos="desde-planes">
            {DEPTOS_COPY.desdePlanes.antes}{" "}
            <EnlaceCarga href={hrefAnalizar("pricing")} className="font-semibold text-[var(--franco-text)] underline underline-offset-2">{DEPTOS_COPY.desdePlanes.enlace}</EnlaceCarga>
          </p>
        )}
        <DeptosCliente sesion={sesion} portada={portada} />
      </main>
      {/* El pie de los informes (16-oct-2026): el wordmark y el aviso, sin enlaces que saquen de la página. */}
      <AppFooter variant="informe" />
    </div>
  );
}
