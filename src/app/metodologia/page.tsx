// Página de metodología v2 (F2) — contraparte pública del campo `metodo` de la
// tabla derivada plusvalia_estimado, más las fuentes de precio y el Franco Score.
//
// Diferida desde F1 a propósito: en /comunas quedó UNA línea de fuente y el
// detalle metodológico vive acá, en un solo lugar. Los textos de método NO se
// redactan en esta página: se leen tal cual del módulo generado
// (METODOS_ESTIMADO), que los trae de la derivada. Si el método cambia, cambia
// la tabla, se regenera el módulo y esta página lo refleja sola — cero copias.

import type { Metadata } from "next";
import Link from "next/link";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { AppFooter } from "@/components/chrome/AppFooter";
import { METODOS_ESTIMADO, ANIO_ESTIMADO, GFK_SERIE } from "@/lib/plusvalia-estimado.gen";

export const metadata: Metadata = {
  title: "Metodología — de dónde salen los números de Franco",
  description:
    "Qué fuentes usa Franco para los precios por comuna, cómo compone el estimado anual y cómo se calcula el Franco Score.",
  alternates: { canonical: "/metodologia" },
  openGraph: {
    title: "Metodología — de dónde salen los números de Franco",
    description: "Fuentes de precio por comuna, método del estimado anual y cálculo del Franco Score.",
    url: "https://refranco.ai/metodologia",
    siteName: "Franco",
    locale: "es_CL",
    images: ["/opengraph-image"],
  },
};

export const revalidate = 86400;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--franco-text-tertiary)]">
      {children}
    </p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6">{children}</div>
  );
}

const FUENTES = [
  {
    nombre: "GfK / NielsenIQ",
    que: "Precios de oferta de departamentos nuevos del Gran Santiago, por comuna y por trimestre. Es la serie más larga que usamos: cubre de 2015 en adelante.",
  },
  {
    nombre: "Tinsa (informe INCOIN)",
    que: "Precios trimestrales agrupados en tres zonas de la Región Metropolitana. La zona centro es 100% departamentos; oriente y periferia mezclan casas y departamentos, y por eso solo usamos su variación relativa, nunca su nivel.",
  },
  {
    nombre: "Colliers",
    que: "Precio pedido (asking price) trimestral de un grupo acotado de comunas y del promedio del Gran Santiago.",
  },
  {
    nombre: "Arenas & Cayo (con Tinsa, Propital y Activo Más)",
    que: "Estudio de precio promedio de departamentos vendidos que compara dos puntos: 2014 y 2024. Es la referencia histórica de las comunas que no tienen serie anual propia.",
  },
  {
    nombre: "Base propia de Franco",
    que: "Avisos reales de venta y arriendo publicados en cada comuna, actualizados cada semana. De acá salen los precios, arriendos y rentabilidades que ves en las páginas de comuna y en cada análisis.",
  },
];

/**
 * Los textos de método son el mismo método con una sola frase distinta (el
 * caveat de la zona INCOIN de cada comuna). Mostrarlos completos tres veces
 * hace ilegible la página, así que se factorizan: prefijo y sufijo comunes van
 * una vez, y las frases que difieren van como variantes. Sigue siendo el texto
 * VERBATIM de la derivada — se parte, no se reescribe.
 */
function factorizarMetodos(metodos: string[]): { comunPrefijo: string; variantes: string[]; comunSufijo: string } {
  if (metodos.length <= 1) return { comunPrefijo: metodos[0] ?? "", variantes: [], comunSufijo: "" };
  // Se compara por ORACIONES, no por caracteres: cortar a mitad de frase dejaba
  // el texto partido en "…de esta comuna (" + "centro) es 100%…".
  const oraciones = metodos.map((m) => m.split(/(?<=\.)\s+/).filter(Boolean));
  const base = oraciones[0];
  let p = 0;
  while (p < base.length && oraciones.every((o) => o[p] === base[p])) p++;
  let s = 0;
  while (
    s < base.length - p &&
    oraciones.every((o) => o[o.length - 1 - s] === base[base.length - 1 - s])
  ) s++;
  return {
    comunPrefijo: base.slice(0, p).join(" "),
    variantes: oraciones.map((o) => o.slice(p, o.length - s).join(" ")).filter((v) => v.trim().length > 0),
    comunSufijo: base.slice(base.length - s).join(" "),
  };
}

export default function MetodologiaPage() {
  const comunasConSerie = Object.keys(GFK_SERIE).length;
  const { comunPrefijo, variantes, comunSufijo } = factorizarMetodos(METODOS_ESTIMADO);

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <UnifiedNav variant="marketing" />

      <main className="mx-auto max-w-[820px] px-6 py-16">
        <h1 className="font-heading text-3xl font-bold text-[var(--franco-text)] sm:text-4xl">
          De dónde salen los números
        </h1>
        <p className="mt-3 font-body text-base leading-relaxed text-[var(--franco-text-secondary)]">
          Franco no te pide que le creas. Acá está qué fuente alimenta cada cifra, cómo se compone
          el precio estimado de un año y cómo se calcula el Franco Score.
        </p>

        <section className="mt-14">
          <Eyebrow>Fuentes de precio por comuna</Eyebrow>
          <h2 className="mt-2 font-heading text-2xl font-bold text-[var(--franco-text)]">
            Cinco fuentes que miden cosas distintas
          </h2>
          <Card>
            <p className="font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
              Cada fuente mide algo propio, con su canasta y su método. Eso significa que sus cifras{" "}
              <b>no son empalmables entre sí</b>: el mismo trimestre puede diferir hasta 15% entre una y
              otra. Por eso ninguna cifra de Franco mezcla dos fuentes, y cada una declara de dónde sale
              y a qué período corresponde.
            </p>
            <dl className="mt-5 space-y-4">
              {FUENTES.map((f) => (
                <div key={f.nombre}>
                  <dt className="font-body text-sm font-semibold text-[var(--franco-text)]">{f.nombre}</dt>
                  <dd className="mt-1 font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">{f.que}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>

        <section className="mt-14">
          <Eyebrow>El estimado de cierre de año</Eyebrow>
          <h2 className="mt-2 font-heading text-2xl font-bold text-[var(--franco-text)]">
            Cómo se compone el {ANIO_ESTIMADO} estimado
          </h2>
          <Card>
            {METODOS_ESTIMADO.length > 0 ? (
              <>
                <p className="font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                  {ANIO_ESTIMADO} es un año terminado, pero su promedio anual por comuna todavía no se
                  publica. Franco lo compone con los trimestres que sí se publicaron de ese mismo año —
                  no lo proyecta. Este es el método exacto, tal como queda registrado junto a cada cifra:
                </p>
                <p className="mt-4 border-l-2 border-[var(--franco-border)] pl-4 font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                  {comunPrefijo} {comunSufijo}
                </p>
                {variantes.length > 0 && (
                  <>
                    <p className="mt-4 font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                      Lo único que cambia entre comunas es la zona de la que sale esa trayectoria intra-año:
                    </p>
                    <ul className="mt-2 space-y-2">
                      {variantes.map((v, i) => (
                        <li key={i} className="border-l-2 border-[var(--franco-border)] pl-4 font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                          {v}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="mt-4 font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                  Las comunas que no pasan esas guardas <b>no llevan estimado</b>: se muestran con el
                  último dato observado y nada más. Antes que rellenar con el promedio de otras comunas,
                  Franco prefiere decir que no sabe.
                </p>
              </>
            ) : (
              <p className="font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                Hoy Franco publica solo cifras observadas por comuna: cuando exista un cierre estimado, su
                método completo aparece acá, con las guardas que lo descartan cuando el dato no se sostiene.
              </p>
            )}
          </Card>
        </section>

        <section className="mt-14">
          <Eyebrow>Historia de precios por comuna</Eyebrow>
          <h2 className="mt-2 font-heading text-2xl font-bold text-[var(--franco-text)]">
            Qué tan atrás llega el dato
          </h2>
          <Card>
            <p className="font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
              {comunasConSerie} comunas tienen serie anual propia desde 2015: para esas, la trayectoria que ves
              es la de la comuna misma. El resto se apoya en el estudio 2014-2024, que compara dos puntos en
              vez de una serie año a año, y algunas solo tienen precio actual sin ninguna historia propia. En
              cada página de comuna decimos cuál de los tres casos es — nunca le atribuimos a una comuna la
              historia de otra ni el promedio del Gran Santiago.
            </p>
            <p className="mt-4 font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
              Una advertencia que vale para todas: la valorización pasada no garantiza la futura. La década
              2014-2024 cruza tramos muy distintos del mercado, así que sirve como contexto de riesgo, no
              como pronóstico.
            </p>
          </Card>
        </section>

        <section className="mt-14">
          <Eyebrow>Franco Score</Eyebrow>
          <h2 className="mt-2 font-heading text-2xl font-bold text-[var(--franco-text)]">
            Cómo se calcula el puntaje
          </h2>
          <Card>
            <p className="font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
              El Franco Score va de 1 a 100 y resume cuatro dimensiones del negocio: rentabilidad, flujo de
              caja, plusvalía y riesgo. Sobre ese puntaje corren reglas duras que pueden bajar el veredicto
              aunque el puntaje sea alto — por ejemplo, cuando el arriendo no alcanza a cubrir la cuota y ni
              la valorización ni la amortización compensan ese esfuerzo. Por eso un score alto con veredicto
              AJUSTA SUPUESTOS no es una contradicción: el puntaje mide la calidad del depto y el veredicto
              incorpora si la operación se sostiene.
            </p>
            <p className="mt-4 font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
              Dentro de la dimensión de plusvalía, el peso mayor lo llevan la cercanía a metro y la
              trayectoria histórica de la comuna. Las proyecciones a diez años del informe usan una tasa
              pareja de 3% real anual para todas las comunas: es un supuesto declarado, no una predicción
              por comuna.
            </p>
          </Card>
        </section>

        <section className="mt-14">
          <Card>
            <p className="font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
              ¿Quieres ver esto aplicado? Mira los{" "}
              <Link href="/comunas" className="underline hover:text-[var(--franco-text)]">
                datos por comuna
              </Link>{" "}
              o revisa las{" "}
              <Link href="/faq" className="underline hover:text-[var(--franco-text)]">
                preguntas frecuentes
              </Link>
              .
            </p>
            <p className="mt-4 font-body text-[11px] italic text-[var(--franco-text-muted)]">
              Análisis informativo, no constituye asesoría de inversión. Las cifras observadas corresponden a
              los períodos declarados en cada página.
            </p>
          </Card>
        </section>
      </main>

      <AppFooter variant="minimal" />
    </div>
  );
}
