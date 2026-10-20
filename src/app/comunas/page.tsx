import type { Metadata } from "next";
import Link from "next/link";
import "@/components/comunas/comunas.css";
import {
  getAllComunasStats,
  fmtCLP,
  tieneArriendoPropio,
  esComunaEstimada,
  rangoArriendoComuna,
  rentabilidadTitulo,
  textoRentabilidadTitulo,
} from "@/lib/data/comunas-seo";
import { COMUNAS_ROSTER } from "@/lib/data/comunas-roster";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { CtaAnalizar } from "@/components/CtaAnalizar";
import { ChipEstimado } from "@/components/comunas/ChipEstimado";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";

export const revalidate = 86400; // ISR: 24 hours

export const metadata: Metadata = {
  // Sin «— Franco» (20-oct-2026, decisión de Fabrizio): la marca la agrega el template del root layout («%s | Franco»)
  // y el título salía «Rentabilidad por Comuna — Franco | Franco».
  title: "Rentabilidad por Comuna",
  description:
    "Datos reales de rentabilidad de departamentos en las principales comunas de Santiago. Actualizado semanalmente.",
  alternates: { canonical: "/comunas" },
  openGraph: {
    title: "Rentabilidad por Comuna — Franco",
    description:
      "¿En qué comuna conviene más invertir? Datos reales de arriendos, precios y rentabilidad en Santiago.",
    url: "https://refranco.ai/comunas",
    siteName: "Franco",
    locale: "es_CL",
    // openGraph propio reemplaza al del root → la imagen va explícita.
    images: ["/opengraph-image"],
  },
};

const n1 = (n: number) => n.toFixed(1).replace(".", ",");

export default async function ComunasIndexPage() {
  const stats = await getAllComunasStats();
  const porSlug = new Map(stats.map((c) => [c.slug, c]));

  // El índice lista SIEMPRE el roster completo: si una comuna se queda sin
  // muestra esta semana, su card queda sin cifras pero el enlace interno sigue
  // ahí. Sacarla dejaría su página huérfana justo cuando Google la acaba de
  // indexar.
  //
  // Tres bloques, en este orden:
  //  1. El RANKING: comunas con al menos una tipología con arriendos propios,
  //     ordenadas por rentabilidad y con puesto.
  //  2. Comunas con arriendo 100% ESTIMADO desde el m² comunal (±6-16% de
  //     error): su cifra informa, pero no compite por un puesto. Van aparte,
  //     sin número, con su rango y con la marca.
  //  3. Sin avisos suficientes ni para estimar: card sin cifras, link vivo.
  //
  // La cifra de cada tarjeta, y el orden, son los del TÍTULO de la página de la comuna (20-oct-2026, decisión de
  // Fabrizio, `rentabilidadTitulo`): antes el índice promediaba todas las filas, estimadas incluidas, y Puente Alto
  // salía 7,0% acá y 5,8% en su título.
  const conDatos = COMUNAS_ROSTER
    .map((c) => porSlug.get(c.slug))
    .filter((c): c is NonNullable<typeof c> => !!c);
  const ranking = conDatos
    .filter(tieneArriendoPropio)
    .sort((a, b) => rentabilidadTitulo(b).medio - rentabilidadTitulo(a).medio);
  const estimadas = conDatos
    .filter(esComunaEstimada)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const sinDatos = COMUNAS_ROSTER.filter((c) => !porSlug.has(c.slug));

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <HeaderFranco />

      <main className="cm mx-auto max-w-[1100px] px-4 pb-16 pt-8 sm:px-6 md:pt-12" data-comuna="indice">
        <h1 className="cm-titulo">¿En qué comuna conviene más invertir en un departamento?</h1>
        <p className="cm-bajada">
          Ranking de rentabilidad en {COMUNAS_ROSTER.length} comunas del Gran
          Santiago, con datos reales de mercado actualizados cada semana.
        </p>

        {/* Grid del ranking */}
        <div className="cm-grilla">
          {ranking.map((c, i) => (
            <Link key={c.slug} href={`/comunas/${c.slug}`} className="cm-comuna" data-comuna="tarjeta">
              <div className="cm-comuna-cabeza">
                <h2 className="cm-comuna-nombre">
                  <span className="cm-puesto">{String(i + 1).padStart(2, "0")}</span>
                  {c.nombre}
                </h2>
                <span className="cm-comuna-rent">{textoRentabilidadTitulo(c)}</span>
              </div>
              <p className="cm-comuna-pie">Rentabilidad bruta</p>
              {/* Una comuna con ALGUNA fila estimada lo dice también acá: el arriendo
                  promedio de la card la incluye. Las 100% estimadas van abajo. */}
              {c.tipologias.some((t) => t.referencia.fuente === "comunalPorM2") && (
                <p className="cm-comuna-pie">
                  Arriendo estimado en {c.tipologias.filter((t) => t.referencia.fuente === "comunalPorM2").length} de{" "}
                  {c.tipologias.length} tipologías
                </p>
              )}

              <div className="cm-datos">
                <div className="cm-dato">
                  Arriendo prom.
                  <b className="cm-cifra">{fmtCLP(c.arriendoRepresentativo)}/mes</b>
                </div>
                <div className="cm-dato">
                  UF/m²
                  <b className="cm-cifra">{n1(c.precioM2Promedio)}</b>
                </div>
                {c.arriendoUFm2Mes > 0 && (
                  <div className="cm-dato">
                    UF/m²/mes
                    <b className="cm-cifra">{c.arriendoUFm2Mes.toFixed(2).replace(".", ",")}</b>
                  </div>
                )}
              </div>
            </Link>
          ))}

          {/* Ni mediana propia ni muestra comunal para estimar: card sin cifras, link vivo. */}
          {sinDatos.map((c) => (
            <Link key={c.slug} href={`/comunas/${c.slug}`} className="cm-comuna" data-comuna="tarjeta">
              <div className="cm-comuna-cabeza">
                <h2 className="cm-comuna-nombre">{c.nombre}</h2>
              </div>
              <p className="cm-comuna-pie">Sin avisos suficientes esta semana, ni para estimar</p>
            </Link>
          ))}
        </div>

        {/* Comunas con arriendo 100% estimado: fuera del ranking, sin puesto. */}
        {estimadas.length > 0 && (
          <section className="cm-seccion" data-comuna="estimadas">
            <p className="cm-rotulo">Fuera del ranking</p>
            <h2 className="cm-h2">Comunas con arriendo estimado</h2>
            <p className="cm-texto" style={{ marginTop: 8 }}>
              En estas comunas ninguna tipología junta arriendos publicados propios, así que el arriendo sale del
              metro cuadrado de la comuna, con un margen de error de hasta 16%. Una cifra así te sirve para ubicarte,
              no para ordenar: por eso no compiten por un puesto con las comunas que sí tienen arriendos publicados.
            </p>

            <div className="cm-grilla" style={{ marginTop: 20 }}>
              {estimadas.map((c) => {
                const rango = rangoArriendoComuna(c);
                return (
                  <Link key={c.slug} href={`/comunas/${c.slug}`} className="cm-comuna cm-comuna-estimada" data-comuna="tarjeta">
                    <div className="cm-comuna-cabeza">
                      <h3 className="cm-comuna-nombre">
                        {c.nombre}
                        <ChipEstimado />
                      </h3>
                      <span className="cm-comuna-rent">{textoRentabilidadTitulo(c)}</span>
                    </div>
                    <p className="cm-comuna-pie">Rentabilidad bruta estimada</p>

                    <div className="cm-datos">
                      <div className="cm-dato">
                        Arriendo estimado
                        <b className="cm-cifra">
                          {rango ? `${fmtCLP(rango.min)}–${fmtCLP(rango.max)}` : fmtCLP(c.arriendoRepresentativo)}
                        </b>
                        <span className="cm-unidad">
                          rango · {c.tipologias.length} {c.tipologias.length === 1 ? "tipología" : "tipologías"}
                        </span>
                      </div>
                      <div className="cm-dato">
                        UF/m²
                        <b className="cm-cifra">{n1(c.precioM2Promedio)}</b>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Cierre. Los veredictos con su nombre de hoy (20-oct-2026): decía «comprar, negociar o seguir buscando». */}
        <section className="cm-cierre" data-comuna="cierre">
          <h2 className="cm-h2">¿Tienes un depto?</h2>
          <p className="cm-texto">
            Analízalo gratis en 2 minutos. Franco te dice si {etiquetaVeredicto("COMPRAR").toLowerCase()},{" "}
            {etiquetaVeredicto("AJUSTA SUPUESTOS").toLowerCase()} o {etiquetaVeredicto("BUSCAR OTRA").toLowerCase()}.
          </p>
          <div className="cm-acciones">
            <CtaAnalizar origen="comunas_indice" className="cm-boton cm-boton-tinta">
              Analizar gratis
            </CtaAnalizar>
          </div>
        </section>
      </main>

      <AppFooter variant="minimal" />
    </div>
  );
}
