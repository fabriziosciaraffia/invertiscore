import { NextResponse } from "next/server";
import { getComunaStats, UF_CLP } from "@/lib/data/comunas-seo";
import { PLUSVALIA_HISTORICA } from "@/lib/plusvalia-historica";
import { isComunaDisponible } from "@/lib/comunas-disponibles";

// ─────────────────────────────────────────────────────────────────────────────
// Referencia de mercado por comuna, para el wizard.
//
// La rama "todavía no tengo uno elegido" de la pantalla de entrada necesita
// mostrar cómo se está invirtiendo hoy en la comuna que el usuario eligió. Esos
// números YA EXISTEN: son exactamente los que alimentan `/comunas/[slug]`.
//
// CERO MOTOR NUEVO. Este endpoint no calcula nada: reexpone `getComunaStats`
// (medianas por segmento sobre `scraped_properties`) más la plusvalía histórica
// observada, que es una constante del repo. No corre `runAnalysis`, no llama a
// la IA y no toca la tabla `analisis`. Si algún día hace falta un número que no
// esté acá, el lugar de agregarlo es `comunas-seo.ts` —donde ya vive la
// metodología— y no este archivo.
//
// El cálculo pagina toda la tabla de propiedades, así que es caro por naturaleza.
// Se sirve cacheado un día, igual que la página SEO que usa la misma función
// (`/comunas/[slug]` declara `revalidate = 86400`), y encima `comunas-seo`
// memoiza los segmentos por proceso. La rama que lo consume es minoritaria por
// definición: solo la ve quien dice que todavía no tiene un depto en la mira.
// ─────────────────────────────────────────────────────────────────────────────

export const revalidate = 86400;

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const stats = await getComunaStats(params.slug);
    // Sin datos suficientes para esa comuna (`comunas-seo` exige mínimos por
    // segmento). 404 y no un objeto en cero: la pantalla tiene que poder
    // distinguir "no hay dato" de "el dato es cero", que significan cosas
    // distintas y se dibujan distinto.
    if (!stats) {
      return NextResponse.json({ error: "sin_datos" }, { status: 404 });
    }
    const plusvalia = PLUSVALIA_HISTORICA[stats.nombre]?.anualizada ?? null;
    return NextResponse.json({
      nombre: stats.nombre,
      cubierta: isComunaDisponible(stats.nombre),
      totalPropiedades: stats.totalPropiedades,
      precioM2UF: stats.precioM2Promedio,
      precioM2CLP: Math.round(stats.precioM2Promedio * UF_CLP),
      arriendoCLP: stats.arriendoRepresentativo,
      rentabilidadBruta: stats.rentabilidadBruta,
      /** % anual observado 2014-2024. `null` si la comuna no está en la serie. */
      plusvaliaAnualizada: plusvalia,
    });
  } catch {
    // Fail-soft: esta pantalla es informativa y opcional. Un 500 acá no puede
    // ser un callejón sin salida — el cliente muestra el bloque vacío y deja
    // los dos caminos de salida (ver el ejemplo / volver) intactos.
    return NextResponse.json({ error: "no_disponible" }, { status: 503 });
  }
}
