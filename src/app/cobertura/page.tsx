import type { Metadata } from "next";
import Link from "next/link";
import "@/components/comunas/comunas.css";
import { COMUNAS_ROSTER } from "@/lib/data/comunas-roster";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { CtaAnalizar } from "@/components/CtaAnalizar";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";

export const metadata: Metadata = {
  title: "¿Dónde está disponible Franco?",
  description:
    "Franco analiza departamentos como inversión en las comunas de Gran Santiago. Mira en qué comunas hoy tienes el análisis con datos reales.",
  alternates: { canonical: "/cobertura" },
  openGraph: {
    title: "¿Dónde está disponible Franco?",
    description:
      "Las comunas de Gran Santiago donde Franco analiza departamentos con datos reales.",
    url: "https://refranco.ai/cobertura",
    siteName: "Franco",
    locale: "es_CL",
    // openGraph propio reemplaza al del root → la imagen va explícita.
    images: ["/opengraph-image"],
  },
};

// La lista sale del ROSTER de comunas publicadas (25), no de COMUNAS_DISPONIBLES:
// esa lista valida el wizard y quedó en 24 (sin Renca), así que esta página
// prometía cobertura distinta de la que /comunas publica. Una sola fuente para
// "dónde hay página", y cada chip enlaza a la suya — antes eran texto plano y
// la página de cobertura no aportaba ningún enlace interno.
// (20-oct-2026: Renca entró a COMUNAS_DISPONIBLES; las dos listas tienen hoy las mismas 25.)
// Orden alfabético chileno (respeta acentos y la Ñ).
const comunas = [...COMUNAS_ROSTER].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

// Diseño plano (20-oct-2026, comunas.css): el mismo de las páginas de comuna, de planes y del semanal.
export default function CoberturaPage() {
  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <HeaderFranco />

      <main className="cm mx-auto max-w-[1100px] px-4 pb-16 pt-8 sm:px-6 md:pt-12" data-comuna="cobertura">
        <h1 className="cm-titulo">¿Dónde está disponible Franco?</h1>
        <p className="cm-bajada">
          Franco analiza departamentos en estas {COMUNAS_ROSTER.length} comunas de Gran Santiago.
          Cada una tiene su página con precios, arriendos y rentabilidad por tipología.
        </p>

        {/* Chips de comunas, cada uno enlaza a su página */}
        <ul className="cm-lista">
          {comunas.map((c) => (
            <li key={c.slug}>
              <Link href={`/comunas/${c.slug}`}>{c.nombre}</Link>
            </li>
          ))}
        </ul>

        {/* Cierre — comuna fuera de cobertura */}
        <p className="cm-texto" style={{ marginTop: 28 }}>
          ¿Tu comuna no está?{" "}
          <a href="mailto:hola@refranco.ai" className="cm-enlace">
            Escríbenos a hola@refranco.ai
          </a>
        </p>

        {/* Los veredictos con su nombre de hoy (20-oct-2026): decía «comprar, negociar o seguir buscando». */}
        <section className="cm-cierre" data-comuna="cierre">
          <h2 className="cm-h2">¿Tu depto está en una de estas comunas?</h2>
          <p className="cm-texto">
            Analízalo en 2 minutos. Franco te dice si {etiquetaVeredicto("COMPRAR").toLowerCase()},{" "}
            {etiquetaVeredicto("AJUSTA SUPUESTOS").toLowerCase()} o {etiquetaVeredicto("BUSCAR OTRA").toLowerCase()}.
          </p>
          <div className="cm-acciones">
            <CtaAnalizar origen="cobertura" className="cm-boton cm-boton-tinta">
              Analiza tu departamento
            </CtaAnalizar>
          </div>
        </section>
      </main>

      <AppFooter variant="minimal" />
    </div>
  );
}
