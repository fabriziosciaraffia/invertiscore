import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { etiquetaAnalisis } from "@/lib/format-direccion";
import { InformeLtr } from "./informe-ltr";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase
    .from("analisis")
    .select("nombre, score, comuna, creator_name")
    .eq("id", params.id)
    .single();

  if (!data) {
    return {
      title: "Franco — Análisis de inversión inmobiliaria",
      robots: { index: false, follow: false },
    };
  }

  // La comuna manda: `nombre` es texto libre y editable, así que el título se
  // arma con `etiquetaAnalisis`, que le pega la comuna autoritativa cuando el
  // nombre no la nombra. Sin esto, una fila con el nombre desincronizado
  // rotularía la pestaña con otra comuna que la del análisis.
  const title = `Análisis Franco: ${etiquetaAnalisis(data.nombre, data.comuna)}`;
  const creatorText = data.creator_name ? `Análisis de ${data.creator_name} — ` : "";
  const description = `${creatorText}Franco Score: ${data.score}/100. Análisis de inversión inmobiliaria en ${data.comuna}.`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";
  const ogImageUrl = `${siteUrl}/api/og?id=${params.id}`;

  return {
    title,
    description,
    // Informes de usuarios: nunca indexables. robots.txt bloquea el crawl de
    // /analisis/, pero el noindex por página es la garantía real para URLs
    // descubiertas por links compartidos.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "article",
      url: `${siteUrl}/analisis/${params.id}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
      siteName: "Franco",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function AnalisisDetallePage({
  params,
}: {
  params: { id: string };
}) {
  // El informe vive en `informe-ltr.tsx`: lo dibujan esta ruta y el demo público.
  return <InformeLtr id={params.id} />;
}
