// ─────────────────────────────────────────────────────────────────────────────
// /metodologia — «Cómo decide Franco» (27-sep-2026, estructura aprobada por Fabrizio).
//
// Una página corta que responde tres cosas: qué mide Franco —las tres respuestas y qué pesa en
// cada una—, de dónde salen los datos, y qué no hace. Sin fórmulas ni pesos: el detalle vive en
// «Cómo se calcula», dentro del informe, y la página enlaza ahí (`/demo?calculo=1` lo abre al
// llegar). Reemplaza a la metodología de siete secciones, que publicaba los pesos viejos del
// puntaje, el horizonte a 20 años y la regla del reglamento de renta corta.
//
// LO QUE AFIRMA DEL MOTOR SE LEE DEL MOTOR (src/lib/metodologia.ts): las dimensiones del puntaje,
// las reglas que pasan por encima de él, el filtro del descuento, el horizonte y la plusvalía
// proyectada. Lo vigila el tier METODOLOGÍA. La cifra de comparables, de la fuente única.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import "@/components/landing-v14/landing.css";
import "@/components/metodologia/metodologia.css";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { DISCLAIMER_CANONICO } from "@/components/chrome/AppFooter";
import { FondoMaterial, Glifo, PieLanding } from "@/components/landing-v14/Marca";
import { CampoLanding } from "@/components/landing-v14/Entrada";
import { EXPLICACION_VEREDICTO } from "@/components/landing-v14/explicaciones";
import { COMPARABLES_TEXTO } from "@/lib/stats";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { DIMENSIONES_LTR, DIMENSIONES_STR, HORIZONTE, PLUSVALIA_PCT, REGLAS } from "@/lib/metodologia";
import type { Veredicto } from "@/lib/types";

export const metadata: Metadata = {
  title: "Cómo decide Franco",
  description: "Qué mide Franco para decir comprar, ajustar o buscar otro, de dónde salen sus datos y qué no hace.",
  alternates: { canonical: "/metodologia" },
  openGraph: {
    title: "Cómo decide Franco",
    description: "Qué mide, de dónde salen los datos y qué no hace.",
    url: "https://refranco.ai/metodologia",
    siteName: "Franco",
    locale: "es_CL",
    images: ["/opengraph-image"],
  },
};

export const revalidate = 86400;

/** Qué pesa en cada respuesta, en palabras: la banda del puntaje y las reglas que la mueven. */
const QUE_PESA: Record<Veredicto, string> = {
  COMPRAR: "El puntaje en su banda alta y ninguna regla en contra. También sube a Comprar cuando el arriendo cubre todo, la rentabilidad neta es buena y no pagas sobre el valor de la zona.",
  "AJUSTA SUPUESTOS": "El puntaje en su banda del medio, o una regla que lo baja de Comprar. Y siempre con un camino a Comprar que se pueda recorrer.",
  "BUSCAR OTRA": "El puntaje en su banda baja, o una de las reglas que bajan a Buscar otro sin importar el puntaje, o un camino a Comprar que pide demasiado.",
};

const ORDEN: Veredicto[] = ["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"];

export default function MetodologiaPage() {
  return (
    <>
      <HeaderFranco />
      <div className="lv-root mtd" data-theme="light">
        <main className="lv-col mtd-col">
          <p className="lv-idx">Metodología</p>
          <h1 className="mtd-h1">Cómo decide Franco</h1>
          <p className="mtd-bajada">
            Escribes la dirección y los datos del depto. Franco lo compara con los avisos de su zona, proyecta cómo le va a tu
            plata a {HORIZONTE} años y te da una de tres respuestas.
          </p>

          <section className="mtd-sec" id="que-mide">
            <h2 className="mtd-h2">Qué mide</h2>
            <div className="mtd-tres">
              {ORDEN.map((v) => (
                <article key={v} className="mtd-resp" data-verdict={v}>
                  <span className="lv-pill mtd-pill"><Glifo veredicto={v} />{etiquetaVeredicto(v, "banda")}</span>
                  <p className="mtd-resp-que">{EXPLICACION_VEREDICTO[v]}</p>
                  <p className="mtd-resp-pesa"><b>Qué pesa.</b> {QUE_PESA[v]}</p>
                </article>
              ))}
            </div>

            <h3 className="mtd-h3">Qué entra al puntaje</h3>
            <div className="mtd-dos">
              <div>
                <p className="mtd-mod">Renta larga</p>
                <ul className="mtd-lista">
                  {Object.values(DIMENSIONES_LTR).map((d) => <li key={d}>{d}</li>)}
                </ul>
              </div>
              <div>
                <p className="mtd-mod">Renta corta</p>
                <ul className="mtd-lista">
                  {Object.values(DIMENSIONES_STR).map((d) => <li key={d}>{d}</li>)}
                </ul>
              </div>
            </div>

            <h3 className="mtd-h3">Lo que pasa por encima del puntaje</h3>
            <p>El puntaje mide la calidad del depto; el veredicto responde si la operación se sostiene. Por eso hay reglas que mandan sobre él.</p>
            <ul className="mtd-lista">
              <li>
                <b>Buscar otro, aunque el puntaje dé</b>, cuando {REGLAS.ltrABuscarOtra.join("; cuando ")}.
              </li>
              <li>
                <b>De Comprar baja a Ajustar</b> cuando {REGLAS.ltrDeComprarAAjustar}.
              </li>
              <li>
                <b>En renta corta</b>, Buscar otro cuando {REGLAS.strABuscarOtra.join(", o cuando ")}.
              </li>
              <li>{REGLAS.filtroDescuento}</li>
            </ul>
          </section>

          <section className="mtd-sec" id="datos">
            <h2 className="mtd-h2">De dónde salen los datos</h2>
            <ul className="mtd-lista">
              <li>
                <b>Los avisos de venta y arriendo</b> del Gran Santiago: {`${COMPARABLES_TEXTO} deptos comparables`}, que Franco
                recolecta y actualiza todas las semanas. De ahí salen el precio por metro y el arriendo de cada zona.
              </li>
              <li><b>En renta corta</b>, los avisos cercanos: la tarifa por noche y la ocupación de lo que hay alrededor.</li>
              <li><b>La historia de precios</b> de cada comuna, de estudios de mercado publicados.</li>
              <li><b>La UF del día</b>, el valor del Banco Central, y la tasa hipotecaria de referencia del mercado, que puedes cambiar por la tuya.</li>
              <li>
                <b>Tus datos mandan.</b> Lo que declaras —precio, arriendo, pie, plazo— es lo que se calcula. Si no sabes el arriendo,
                Franco usa el de la zona y lo dice.
              </li>
            </ul>
          </section>

          <section className="mtd-sec" id="que-no-hace">
            <h2 className="mtd-h2">Qué no hace</h2>
            <ul className="mtd-lista">
              <li><b>No es asesoría financiera.</b> {DISCLAIMER_CANONICO}</li>
              <li><b>No tasa.</b> Compara con precios publicados, no con escrituras: por eso habla de negociar.</li>
              <li>
                <b>No adivina cuánto va a subir tu depto.</b> Proyecta con un {String(PLUSVALIA_PCT).replace(".", ",")}% anual parejo
                para todas las comunas; la historia de la comuna entra en el puntaje, no en la proyección.
              </li>
              <li><b>No revisa el edificio ni los papeles:</b> ni sus normas internas, ni deudas, ni el estado legal del depto.</li>
              <li><b>No modela los seguros del crédito</b> ni los impuestos a la renta o a la ganancia de capital.</li>
            </ul>
          </section>
        </main>

        {/* el cierre: el detalle de cada cifra vive en el informe; y el campo, sobre el material */}
        <div className="lv-cierre-wrap mtd-cierre-wrap">
          <FondoMaterial />
          <section className="lv-col mtd-cierre">
            <h2 className="mtd-cierre-h">El detalle de cada cifra está en el informe.</h2>
            <p>
              Cada análisis trae «Cómo se calcula»: la cuenta de cada número, con los datos que usó.{" "}
              <Link href="/demo?calculo=1" className="mtd-link">Verlo en un informe de ejemplo<span aria-hidden="true">→</span></Link>
            </p>
            <div className="mtd-campo">
              <CampoLanding ubicacion="metodologia" />
            </div>
          </section>
          <PieLanding ultimo={null} ahora={new Date()} conFondo={false} />
        </div>
      </div>
    </>
  );
}
