import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { etiquetaAnalisis } from "@/lib/format-direccion";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { normalizeLegacyVerdict } from "@/lib/types";
import { conOcupacionRealizadaDelCache } from "@/lib/airbnb/ocupacion-realizada-cache";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { recomputeShortTermForLegacy } from "@/lib/analysis/recompute-short-term-for-legacy";
import { InformeStr } from "./informe-str";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase
    .from("analisis")
    // `input_data` y `created_at` entran para poder RECOMPUTAR el veredicto (ver abajo). Esta
    // query es propia de la metadata —no comparte nada con el cuerpo de la página— así que
    // sumarle dos columnas a un SELECT que ya se hace no agrega un viaje a la base.
    .select("nombre, comuna, results, input_data, created_at, mediana_comuna_snapshot")
    .eq("id", params.id)
    .single();

  if (!data) {
    return {
      title: "Franco — Análisis de renta corta",
      robots: { index: false, follow: false },
    };
  }

  // La demanda de la zona del score: las filas que no la guardaron la leen del caché de AirROI,
  // igual que el cuerpo de la página (si no, el título diría otro veredicto).
  const results = await conOcupacionRealizadaDelCache(data.input_data as Record<string, unknown> | null, data.results as ShortTermResult | null);
  // ⛔ EL TÍTULO RECOMPUTA, COMO EL CUERPO (17-sep-2026).
  //
  // Citaba `data.results.veredicto`, la columna persistida, mientras el cuerpo de la MISMA
  // página corre `recomputeShortTermForLegacy`. Los dos números salen de motores distintos en
  // momentos distintos, y cada vez que el motor se recalibra el persistido se queda donde
  // estaba. Medido sobre el parque el 17-sep: **8 de 251 filas (3,2%)** con el persistido
  // distinto del recomputado, y las 8 cambian la ETIQUETA que se imprime —5 BUSCAR OTRO →
  // AJUSTAR, 2 AJUSTAR → COMPRAR, 1 BUSCAR OTRO → COMPRAR—. O sea: la pestaña del navegador y
  // el preview del link decían COMPRAR sobre un informe que adentro dice AJUSTAR, y quien
  // comparte el link comparte la versión vieja.
  //
  // La UF es la CONGELADA, igual que en el cuerpo (`precioCompra / precioCompraUF`), y la
  // fecha es `created_at`: si la metadata usara la UF viva daría otro veredicto que la página.
  // Desde el 25-sep-2026 usa `recomputeShortTermForLegacy`, EL MISMO recompute del cuerpo: el
  // veredicto final sale del filtro del descuento (`ajustar-sin-camino.ts`), que necesita el
  // hallazgo de distancia, y `veredictoStrRecomputado` no arma hallazgos — con él el título decía
  // «Ajustar» en las filas que el cuerpo muestra como Buscar otro. Desde el 22-sep-2026 (variante B) el exit descuenta el sobreprecio contra
  // la mediana comunal, así que la mediana SÍ entra: la del snapshot persistido, sin segundo
  // viaje. Filas sin snapshot recomputan sin descuento acá y con él en el cuerpo (que la
  // prefetchea): en el parque del 22-sep ninguna cambia de veredicto por eso.
  //
  // Si el recompute no puede (legacy sin `airbnbRaw`, o sin los dos campos de precio) cae al
  // persistido — que es exactamente lo que hace el cuerpo, así que los dos siguen coincidiendo.
  const inputStr = data.input_data as Record<string, unknown> | null;
  const precioCompraUF = Number(inputStr?.precioCompraUF) || 0;
  const precioCompraCLP = Number(inputStr?.precioCompra) || 0;
  const recomputado =
    precioCompraUF > 0 && precioCompraCLP > 0
      ? recomputeShortTermForLegacy(
          inputStr,
          results as { airbnbRaw?: unknown } | null,
          precioCompraCLP / precioCompraUF,
          new Date(data.created_at ?? new Date().toISOString()),
          (() => { const snap = data.mediana_comuna_snapshot as { mediana?: number | null; n?: number } | null; return snap ? { mediana: snap.mediana ?? null, n: snap.n ?? 0 } : { mediana: null, n: 0 }; })(),
        )
      : null;
  // Commit 1 · 2026-05-11: normalizar veredicto legacy en metadata.
  // Goal 10a: en <title> y meta va la etiqueta (BUSCAR OTRO / AJUSTAR / COMPRAR), no el valor.
  const veredicto = etiquetaVeredicto(
    normalizeLegacyVerdict(recomputado?.francoScore?.veredicto ?? results?.veredicto),
    "banda",
    "Análisis",
  );
  // Misma regla que el título LTR: la comuna autoritativa se pega si el nombre
  // libre no la nombra (ver `etiquetaAnalisis`).
  // T3 (05-sep-2026): el nombre libre de las filas STR ya empieza con "Renta Corta - …", así
  // que el título salía "Renta Corta: Renta Corta - …". Se quita ese prefijo antes de la etiqueta.
  const nombreSinPrefijo = (data.nombre ?? "").replace(/^\s*renta\s+corta\s*[-–·:]\s*/i, "");
  const title = `Renta Corta: ${etiquetaAnalisis(nombreSinPrefijo, data.comuna)} — ${veredicto}`;
  const description = `Análisis de renta corta en ${data.comuna}. Veredicto: ${veredicto}.`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

  return {
    title,
    description,
    // Informes de usuarios: nunca indexables (misma regla que el LTR).
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "article",
      url: `${siteUrl}/analisis/renta-corta/${params.id}`,
      siteName: "Franco",
      // El informe STR no tiene OG personalizado (el /api/og es solo LTR):
      // va la imagen de marca para que el share en WhatsApp no salga pelado.
      images: ["/opengraph-image"],
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function STRResultPage({
  params,
}: {
  params: { id: string };
}) {
  // El informe vive en `informe-str.tsx`: lo dibujan esta ruta y el demo público.
  return <InformeStr id={params.id} />;
}
