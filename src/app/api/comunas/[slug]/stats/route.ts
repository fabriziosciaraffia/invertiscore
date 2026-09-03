import { NextResponse } from "next/server";
import { getComunaStats, UF_CLP } from "@/lib/data/comunas-seo";
import { PLUSVALIA_ESTIMADO as PLUSVALIA_HISTORICA } from "@/lib/plusvalia-estimado.gen";
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
    // Sin datos para esa comuna: ni una tipología con mediana propia ni muestra
    // comunal con que estimar (`comunas-seo` + `referencia-arriendo`). 404 y no
    // un objeto en cero: la pantalla tiene que poder distinguir "no hay dato" de
    // "el dato es cero", que significan cosas distintas y se dibujan distinto.
    if (!stats) {
      return NextResponse.json({ error: "sin_datos" }, { status: 404 });
    }
    // F4.1 — la cifra y SU período viajan juntos. Antes solo salía el número y
    // el wizard lo rotulaba con el rango del DEFAULT, así que las comunas con
    // serie GfK mostraban su anualizada real bajo un "observado 2014-2024" que
    // no era el suyo. Resolverlo en el cliente tampoco servía: si el nombre no
    // matchea exacto, el lookup cae al DEFAULT en silencio — acá el lookup ya
    // está hecho y es el mismo que produce la cifra.
    const entry = PLUSVALIA_HISTORICA[stats.nombre];
    // El arriendo de la comuna incluye filas estimadas desde el m² comunal cuando
    // una tipología no junta arriendos propios; el wizard lo rotula por esto.
    const estimadas = stats.tipologias.filter((t) => t.referencia.fuente === "comunalPorM2").length;
    const arriendoFuente =
      estimadas === 0 ? "propia" : estimadas === stats.tipologias.length ? "estimada" : "mixta";
    return NextResponse.json({
      nombre: stats.nombre,
      cubierta: isComunaDisponible(stats.nombre),
      totalPropiedades: stats.totalPropiedades,
      precioM2UF: stats.precioM2Promedio,
      precioM2CLP: Math.round(stats.precioM2Promedio * UF_CLP),
      arriendoCLP: stats.arriendoRepresentativo,
      /** "propia": medianas de tipología · "estimada": todas desde el m² comunal · "mixta": las dos. */
      arriendoFuente,
      rentabilidadBruta: stats.rentabilidadBruta,
      /** % anual observado de la comuna. `null` si no tiene trayectoria propia. */
      plusvaliaAnualizada: entry?.anualizada ?? null,
      /** Período de ESA cifra (2015-2025 / 2015-2024 / 2014-2024). `null` con la cifra. */
      plusvaliaRango: entry?.rangoHist ?? null,
    });
  } catch {
    // Fail-soft: esta pantalla es informativa y opcional. Un 500 acá no puede
    // ser un callejón sin salida — el cliente muestra el bloque vacío y deja
    // los dos caminos de salida (ver el ejemplo / volver) intactos.
    return NextResponse.json({ error: "no_disponible" }, { status: 503 });
  }
}
