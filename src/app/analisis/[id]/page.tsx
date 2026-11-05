import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import { etiquetaAnalisis } from "@/lib/format-direccion";
import { InformeLtr } from "./informe-ltr";
import { informeBloqueado, INFORME_BLOQUEADO_COPY } from "@/lib/informe-bloqueado";
import { puntajeDe, resultadosPorId } from "@/lib/analysis/resultados-del-informe";
import { getUFValue } from "@/lib/uf";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  // Con la llave de servicio (04-nov-2026): `analisis` ya no se lee con la pública. Ver informe-ltr.tsx.
  const { data } = await createServiceClient()
    .from("analisis")
    .select("nombre, score, comuna, creator_name, pending_payment")
    .eq("id", params.id)
    .single();

  if (!data) {
    return {
      title: "Franco — Análisis de inversión inmobiliaria",
      robots: { index: false, follow: false },
    };
  }

  // Pendiente de pago (04-nov-2026, lib/informe-bloqueado.ts): sin puntaje ni veredicto en la vista previa.
  if (informeBloqueado(data, false)) {
    return { title: `Análisis Franco: ${etiquetaAnalisis(data.nombre, data.comuna)}`, description: INFORME_BLOQUEADO_COPY.metaDescripcion, robots: { index: false, follow: false } };
  }

  // La comuna manda: `nombre` es texto libre y editable, así que el título se
  // arma con `etiquetaAnalisis`, que le pega la comuna autoritativa cuando el
  // nombre no la nombra. Sin esto, una fila con el nombre desincronizado
  // rotularía la pestaña con otra comuna que la del análisis.
  const title = `Análisis Franco: ${etiquetaAnalisis(data.nombre, data.comuna)}`;
  const creatorText = data.creator_name ? `Análisis de ${data.creator_name} — ` : "";
  // EL PUNTAJE DE LA PORTADA (05-nov-2026, lib/analysis/resultados-del-informe.ts): el mismo recálculo que el informe (una vez
  // por pedido); la columna `score` es la del motor del día en que se creó.
  const puntaje = puntajeDe((await resultadosPorId(params.id, await getUFValue()))?.results) ?? data.score;
  const description = `${creatorText}Franco Score: ${puntaje}/100. Análisis de inversión inmobiliaria en ${data.comuna}.`;
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
