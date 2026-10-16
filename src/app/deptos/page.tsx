import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { DEPTOS_COPY } from "@/lib/deptos/respuesta";
import { DeptosCliente } from "./deptos-cliente";

// ─────────────────────────────────────────────────────────────────────────────
// /deptos, LA PUERTA B (16-oct-2026, decisiones de Fabrizio): para quien no tiene un depto en la mira. Una sola pantalla,
// rápida, sin mapa ni Google Places: cuatro preguntas con chips, la respuesta al instante con la evaluación de la noche,
// el registro con correo y código, «Estás dentro» y sus primeros deptos antes de cerrar la pestaña. Una sola página para
// el anuncio, el retargeting y lo orgánico: las UTM distinguen (useAttributionSync), la puerta es B.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: DEPTOS_COPY.titular,
  description: "Elige comuna, tipología y precio: Franco te dice cuántos deptos convienen como inversión hoy, y cada semana te manda los que convienen.",
  alternates: { canonical: "/deptos" },
  openGraph: {
    title: DEPTOS_COPY.titular,
    description: "Cuántos deptos convienen como inversión hoy en tu comuna, y cada semana, los que convienen.",
    url: "https://refranco.ai/deptos",
    siteName: "Franco",
    locale: "es_CL",
    images: ["/opengraph-image"],
  },
};

export const dynamic = "force-dynamic";

export default async function DeptosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sesion = user?.email ? { email: user.email } : null;
  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <HeaderFranco sesion={sesion} />
      <main className="mx-auto max-w-[760px] px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <DeptosCliente sesion={sesion} />
      </main>
      <AppFooter variant="minimal" />
    </div>
  );
}
