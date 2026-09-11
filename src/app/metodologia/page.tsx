// ─────────────────────────────────────────────────────────────────────────────
// /metodologia — el interior de la landing v14.
//
// La landing es la portada: vende una respuesta. Esta página es el interior:
// muestra de dónde sale. Mismo material (papel con grano de principio a fin, la
// textura del hero NO se repite como fondo) y las mismas piezas importadas de
// `landing-v14`: wordmark, banda de veredicto con glifo, campo de dirección y
// footer. El único color es el de los veredictos (tokens `[data-verdict]`).
//
// TODO número de esta página sale del código o de la base — nada hardcodeado
// salvo la versión del motor, que ES una constante del motor:
//   · avisos y último scrape → `leerDatosLanding()` (la misma fuente que la
//     sección 3 de la landing);
//   · comunas → `COMUNAS_ROSTER.length`;
//   · versión → `METHODOLOGY_VERSION_ACTUAL` (src/lib/modelo-costos.ts);
//   · supuestos y pesos → validados contra el motor el 09-sep-2026, con la
//     línea del código citada en el comentario de cada tabla.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";

import { leerDatosLanding } from "@/lib/landing-vivo";
import { COMUNAS_ROSTER } from "@/lib/data/comunas-roster";
import { ANIO_ESTIMADO, GFK_SERIE, METODOS_ESTIMADO } from "@/lib/plusvalia-estimado.gen";
import { METHODOLOGY_VERSION_ACTUAL } from "@/lib/modelo-costos";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import type { Veredicto } from "@/lib/types";

import { actualizado, Glifo, PieLanding, Wordmark } from "@/components/landing-v14/Marca";
import { CampoDireccion } from "@/components/landing-v14/CampoDireccion";
import { Modalidad, ToggleModalidad } from "@/components/metodologia/Modalidad";

import "@/components/landing-v14/landing.css";
import "@/components/metodologia/metodologia.css";

export const revalidate = 600;

const TITULO = "Cómo calcula Franco — metodología, supuestos y fuentes";
const BAJADA =
  "Qué datos mira Franco, qué asume el modelo, cómo se compone el Franco Score y en qué casos el veredicto ignora el puntaje. Sin letra chica.";

export const metadata: Metadata = {
  title: TITULO,
  description: BAJADA,
  alternates: { canonical: "/metodologia" },
  openGraph: {
    title: TITULO,
    description: BAJADA,
    url: "https://refranco.ai/metodologia",
    siteName: "Franco",
    locale: "es_CL",
    type: "article",
    images: ["/opengraph-image"],
  },
};

// ─── Índice ──────────────────────────────────────────────────────────────────
const SECCIONES = [
  { n: "01", id: "datos", t: "De dónde salen los datos" },
  { n: "02", id: "supuestos", t: "Qué asume el modelo" },
  { n: "03", id: "score", t: "Cómo se compone el Franco Score" },
  { n: "04", id: "veredictos", t: "Los tres veredictos" },
  { n: "05", id: "gates", t: "Cuándo el veredicto ignora el puntaje" },
  { n: "06", id: "limites", t: "Qué Franco no sabe" },
  { n: "07", id: "preguntas", t: "Preguntas frecuentes" },
] as const;

// ─── Preguntas frecuentes (van también al JSON-LD de FAQPage) ────────────────
const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: "¿De dónde saca Franco los precios?",
    a: "De los avisos de venta y arriendo publicados en cada comuna del Gran Santiago, que Franco recolecta y actualiza todas las semanas. Para la historia de precios por comuna se apoya además en estudios de mercado publicados (GfK/NielsenIQ, Tinsa, Colliers y el estudio Arenas & Cayo 2014-2024), y cada cifra declara de cuál sale.",
  },
  {
    q: "¿Los precios son de venta real o de publicación?",
    a: "De publicación. Franco compara tu depto contra lo que se está pidiendo hoy en la zona, no contra escrituras. Es la diferencia entre lo que el mercado pide y lo que el mercado paga: por eso el análisis habla de negociar, y no trata el precio publicado como si fuera el valor.",
  },
  {
    q: "¿Qué es el Franco Score y cómo se calcula?",
    a: "Es un puntaje de 1 a 100 que resume cuatro ejes del negocio. En arriendo tradicional: rentabilidad (30%), flujo de caja (25%), plusvalía (25%) y eficiencia de compra (20%). En renta corta los ejes son otros cuatro y pesan igual: rentabilidad, sostenibilidad, ventaja frente al arriendo tradicional y factibilidad.",
  },
  {
    q: "¿Por qué un score alto puede terminar en “ajustar” o en “buscar otro”?",
    a: "Porque sobre el puntaje corren reglas duras. Si el flujo mensual es muy negativo, si el retorno sobre el pie cae bajo cierto umbral, o si el arriendo no cubre la cuota ni con la tasa en cero, el veredicto baja aunque el puntaje sea alto. El puntaje mide la calidad del depto; el veredicto responde si la operación se sostiene.",
  },
  {
    q: "¿Qué asume Franco sobre la vacancia?",
    a: "Un 5% del año, algo más de medio mes sin arrendar. Es un supuesto que puedes corregir en el resumen antes de generar el análisis. Durante esos meses el dueño igual paga los gastos comunes, y el modelo lo descuenta.",
  },
  {
    q: "¿Cuánto asume Franco de mantención?",
    a: "Entre 0,02 y 0,14 UF por m² útil al año según la antigüedad del depto, con un techo de 6% del arriendo. No es un porcentaje del precio: en Santiago el precio es sobre todo suelo, y la mantención física escala con los metros y los años. Ascensores, bombas y fachada van en los gastos comunes, no en esta línea.",
  },
  {
    q: "¿Franco proyecta la plusvalía de mi comuna?",
    a: "No. Las proyecciones usan una tasa pareja de 3% anual para todas las comunas: es un supuesto declarado, no un pronóstico. La historia de precios de la comuna sí entra en el puntaje, como contexto de riesgo.",
  },
  {
    q: "¿Sirve para renta corta o solo para arriendo tradicional?",
    a: "Sirve para las dos, con modelos distintos. En renta corta la tarifa por noche y la ocupación salen de los avisos de renta corta publicados cerca del depto, con su estacionalidad mes a mes, y el modelo suma la puesta en marcha: seis meses de rampa hasta llegar al ingreso estabilizado.",
  },
  {
    q: "¿Esto es asesoría de inversión?",
    a: "No. Franco es una herramienta de análisis: entrega información para que decidas tú. No recomienda comprar ni vender, no administra dinero y no cobra comisión por ninguna operación.",
  },
];

// ─── Piezas ──────────────────────────────────────────────────────────────────
function Seccion({
  n,
  id,
  titulo,
  children,
}: {
  n: string;
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mtd-sec">
      <div className="mtd-sec-cab">
        <span className="mtd-n">{n}</span>
        <h2 className="mtd-h2">{titulo}</h2>
      </div>
      <div className="mtd-sec-cuerpo">{children}</div>
    </section>
  );
}

/** Veredicto en píldora, la primitiva compartida con el hero del informe, con su
 *  glifo. Sin anillo ni punto que late: acá no hay un resultado vivo, se explica
 *  qué significa cada veredicto. */
function Veredicto3({ veredicto, children }: { veredicto: Veredicto; children: React.ReactNode }) {
  return (
    <div className="mtd-banda" data-verdict={veredicto}>
      <span className="lv-pill">
        <Glifo veredicto={veredicto} />
        {etiquetaVeredicto(veredicto, "banda")}
      </span>
      <p>{children}</p>
    </div>
  );
}

function Fila({ k, v, nota }: { k: string; v: string; nota?: string }) {
  return (
    <tr>
      <th scope="row">{k}</th>
      <td>
        <span className="mtd-v">{v}</span>
        {nota && <small>{nota}</small>}
      </td>
    </tr>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default async function MetodologiaPage() {
  const datos = await leerDatosLanding();
  const ahora = new Date();

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="lv-root mtd-root" data-franco-root data-landing="v14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* barra: "← Volver" · wordmark · "Entrar". Misma altura que el hero. */}
      <header className="lv-col mtd-top">
        <Link href="/" className="mtd-volver">
          <span aria-hidden="true">←</span>Volver
        </Link>
        <div className="mtd-top-marca">
          <Wordmark />
        </div>
        <Link href="/login" className="lv-entrar">
          Entrar
        </Link>
      </header>

      <main className="lv-col mtd-main">
        {/* cabecera de documento: los mismos datos vivos de la sección 3 */}
        <div className="mtd-doc">
          <span>
            <i />
            <b>{datos.avisosActivos.toLocaleString("es-CL")}</b> deptos publicados
          </span>
          <span>Actualizado {actualizado(datos.ultimoScrape, ahora)}</span>
          <span>
            <b>{COMUNAS_ROSTER.length}</b> comunas
          </span>
          <span>
            Motor <b>{METHODOLOGY_VERSION_ACTUAL}</b>
          </span>
        </div>

        <h1 className="mtd-h1">
          Cómo calcula <mark>Franco</mark>
        </h1>
        <p className="mtd-lead">{BAJADA}</p>

        <nav className="mtd-indice" aria-label="Contenido de la página">
          <div className="lv-idx">En esta página</div>
          <ol>
            {SECCIONES.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <em>{s.n}</em>
                  <span>{s.t}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Un solo estado de modalidad para la tabla de datos, la de supuestos y
            los ejes del score: los tres cambian juntos. */}
        <Modalidad>
          <Seccion n="01" id="datos" titulo="De dónde salen los datos">
            <p>
              Franco no te pide que le creas. Cada cifra del análisis viene de un dato con fecha y con
              origen declarado, y los precios son <b>de publicación, no de escritura</b>: es lo que el
              mercado pide hoy, no lo que se pagó.
            </p>
            <ToggleModalidad etiqueta="Modalidad de la tabla de datos" />

            <div data-m="ltr">
              <div className="mtd-tabla-wrap">
                <table className="mtd-tabla">
                  <caption>Arriendo tradicional · qué mira y de dónde sale</caption>
                  <thead>
                    <tr>
                      <th scope="col">Dato</th>
                      <th scope="col">De dónde sale</th>
                    </tr>
                  </thead>
                  <tbody>
                    <Fila
                      k="Precio de referencia de la zona"
                      v="Avisos de venta publicados"
                      nota="Mediana de la misma tipología en la comuna, actualizada cada semana. El análisis dice sobre cuántos avisos se calculó."
                    />
                    <Fila
                      k="Arriendo de referencia"
                      v="Avisos de arriendo publicados"
                      nota="Mediana de la misma tipología en la comuna. Si prefieres, ingresas tú el arriendo y el modelo usa el tuyo."
                    />
                    <Fila
                      k="Historia de precios de la comuna"
                      v="Estudios de mercado publicados"
                      nota="GfK/NielsenIQ, Tinsa (INCOIN), Colliers y el estudio Arenas & Cayo 2014-2024. Miden canastas distintas y no se mezclan entre sí: cada cifra declara de cuál sale."
                    />
                    <Fila k="Valor de la UF" v="Banco Central" nota="Al día del análisis." />
                    <Fila
                      k="Tasa hipotecaria"
                      v="Referencia de mercado"
                      nota="Franco la propone y tú la corriges con la que te ofrezca tu banco."
                    />
                    <Fila
                      k="Contribuciones"
                      v="Tasas y exenciones del SII"
                      nota="Se estiman desde el avalúo, con la exención general y la de DFL-2 cuando corresponde."
                    />
                  </tbody>
                </table>
              </div>
              {/* El método del cierre estimado NO se redacta acá: se lee tal cual del
                  módulo generado desde la tabla derivada. Si cambia el método, cambia
                  la tabla, se regenera el módulo y esta página lo refleja sola. */}
              {METODOS_ESTIMADO.length > 0 && (
                <p className="mtd-nota">
                  <b>Sobre el {ANIO_ESTIMADO} estimado.</b> {Object.keys(GFK_SERIE).length} comunas tienen
                  serie anual propia desde 2015; para el resto, la historia se apoya en el estudio
                  2014-2024. El año en curso no se proyecta: se compone con los trimestres ya publicados
                  de ese mismo año. Método exacto, tal como queda registrado junto a cada cifra:{" "}
                  <i>{METODOS_ESTIMADO[0]}</i> Las comunas que no pasan esas guardas no llevan estimado:
                  antes que rellenar con el promedio de otras, Franco prefiere decir que no sabe.
                </p>
              )}
            </div>

            <div data-m="str">
              <div className="mtd-tabla-wrap">
                <table className="mtd-tabla">
                  <caption>Renta corta · qué mira y de dónde sale</caption>
                  <thead>
                    <tr>
                      <th scope="col">Dato</th>
                      <th scope="col">De dónde sale</th>
                    </tr>
                  </thead>
                  <tbody>
                    <Fila
                      k="Tarifa por noche"
                      v="Avisos de renta corta cercanos"
                      nota="Mediana de los avisos parecidos alrededor del depto. Puedes reemplazarla por la tuya."
                    />
                    <Fila
                      k="Ocupación"
                      v="Ocupación observada de esos avisos"
                      nota="La mediana de lo que efectivamente ocupan, no una meta. Sin datos suficientes en el radio, el modelo usa 45% y lo dice."
                    />
                    <Fila
                      k="Estacionalidad"
                      v="Ingreso mes a mes de los mismos avisos"
                      nota="Doce factores mensuales por dirección: enero no se proyecta igual que junio."
                    />
                    <Fila
                      k="Competencia de la zona"
                      v="Avisos parecidos en el radio"
                      nota="Cuántos son, cuántos son anfitriones destacados y qué estadía típica tienen."
                    />
                    <Fila k="Valor de la UF" v="Banco Central" nota="Al día del análisis." />
                    <Fila
                      k="Contribuciones y tasa"
                      v="SII y referencia de mercado"
                      nota="Igual que en arriendo tradicional."
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </Seccion>

          <Seccion n="02" id="supuestos" titulo="Qué asume el modelo">
            <p>
              Todo modelo asume cosas. La diferencia es si las declara. Estos son los supuestos con los
              que corre el motor <b>{METHODOLOGY_VERSION_ACTUAL}</b> cuando tú no dices otra cosa. Los
              marcados como <b>tuyos</b> los puedes corregir en el resumen, antes de generar el análisis.
            </p>
            <ToggleModalidad etiqueta="Modalidad de la tabla de supuestos" />

            <div data-m="ltr">
              <div className="mtd-tabla-wrap">
                <table className="mtd-tabla">
                  <caption>Arriendo tradicional · supuestos por defecto</caption>
                  <thead>
                    <tr>
                      <th scope="col">Supuesto</th>
                      <th scope="col">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <Fila
                      k="Vacancia"
                      v="5% del año"
                      nota="Algo más de medio mes sin arrendar. Los gastos comunes de esos meses los paga el dueño. Tuyo: lo corriges en el resumen."
                    />
                    <Fila
                      k="Mantención"
                      v="0,02–0,14 UF/m² al año"
                      nota="Según la antigüedad, con techo de 6% del arriendo. No es un porcentaje del precio: la mantención física escala con los metros y los años, y lo del edificio ya va en los gastos comunes."
                    />
                    <Fila
                      k="Puesta a punto al comprar"
                      v="0,2–1,6 UF/m², una vez"
                      nota="Según la antigüedad; cero si el depto es nuevo. Si la pagas, el depto queda como recién puesto a punto y la mantención vuelve a contar desde cero."
                    />
                    <Fila
                      k="Gastos comunes"
                      v="1.400–2.200 $/m² al mes"
                      nota="Según el tipo de edificio de la comuna. Tuyo: lo corriges en el resumen."
                    />
                    <Fila
                      k="Administración"
                      v="0% (autogestión)"
                      nota="Si vas a delegar el arriendo, pones el porcentaje que te cobren. Tuyo."
                    />
                    <Fila
                      k="Rotación de arrendatario"
                      v="Medio mes cada 2 años, dos veces"
                      nota="Una por el corretaje de re-arriendo y otra por el recambio (pintura y aseo profundo), prorrateadas mes a mes."
                    />
                    <Fila
                      k="Reajuste anual"
                      v="Arriendo 3,5% · costos 3%"
                      nota="Gastos comunes, contribuciones y mantención suben 3%; el dividendo en pesos también."
                    />
                    <Fila
                      k="Plusvalía"
                      v="3% anual"
                      nota="Pareja para todas las comunas. Es un supuesto declarado, no un pronóstico por comuna."
                    />
                    <Fila
                      k="Costos de entrada y salida"
                      v="2% + 2% + 2%"
                      nota="Gastos de cierre al comprar, corretaje de compra si el depto es usado, y comisión al vender."
                    />
                    <Fila
                      k="Horizonte"
                      v="20 años de proyección"
                      nota="La venta y la rentabilidad final (TIR) se calculan al año 10."
                    />
                    <Fila
                      k="Crédito"
                      v="Pie, plazo y tasa"
                      nota="Tuyos los tres. El plazo parte en 25 años y la tasa en la referencia de mercado."
                    />
                  </tbody>
                </table>
              </div>
            </div>

            <div data-m="str">
              <div className="mtd-tabla-wrap">
                <table className="mtd-tabla">
                  <caption>Renta corta · supuestos por defecto</caption>
                  <thead>
                    <tr>
                      <th scope="col">Supuesto</th>
                      <th scope="col">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <Fila
                      k="Ocupación"
                      v="La observada en la zona"
                      nota="La mediana de los avisos cercanos, acotada entre 5% y 95%. Sin datos suficientes, 45%. Tuya: la corriges en el resumen."
                    />
                    <Fila
                      k="Tarifa por noche"
                      v="La mediana de la zona"
                      nota="Tuya: la corriges en el resumen."
                    />
                    <Fila
                      k="Puesta en marcha"
                      v="6 meses de rampa"
                      nota="El primer mes factura la mitad del ingreso estabilizado y recién al sexto llega al 100%. El modelo descuenta esa pérdida."
                    />
                    <Fila
                      k="Comisión de plataforma"
                      v="3% del ingreso"
                      nota="Si administras tú. Si delegas en un operador, se reemplaza por su comisión: no se suman."
                    />
                    <Fila
                      k="Comisión del operador"
                      v="20% del ingreso"
                      nota="Solo si eliges administrador. Tuya: la corriges en el resumen."
                    />
                    <Fila
                      k="Amoblamiento"
                      v="$2,5 M a $5,0 M"
                      nota="Según el tamaño, una vez. Cero si el depto ya está amoblado. Tuyo."
                    />
                    <Fila
                      k="Costos directos"
                      v="$76.000 a $141.000 al mes"
                      nota="Luz, agua, internet e insumos, según el tamaño. Tuyos."
                    />
                    <Fila
                      k="Mantención"
                      v="$8.000 a $25.000 al mes"
                      nota="Según los dormitorios. Tuya."
                    />
                    <Fila
                      k="Reajuste anual"
                      v="Ingreso 3,5% · costos 3%"
                      nota="El dividendo en pesos sube 3%."
                    />
                    <Fila
                      k="Plusvalía"
                      v="3% anual"
                      nota="La misma que en arriendo tradicional, pareja para todas las comunas."
                    />
                    <Fila k="Horizonte" v="10 años" nota="Con la venta al final del período." />
                    <Fila
                      k="Crédito"
                      v="Pie, plazo y tasa"
                      nota="Tuyos los tres, igual que en arriendo tradicional."
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </Seccion>

          <Seccion n="03" id="score" titulo="Cómo se compone el Franco Score">
            <p>
              El Franco Score va de 1 a 100 y resume <b>cuatro ejes</b> del negocio. No son los mismos en
              arriendo tradicional que en renta corta: son negocios distintos y se miden distinto.
            </p>
            <ToggleModalidad etiqueta="Modalidad de los ejes del puntaje" />

            <div data-m="ltr">
              <div className="mtd-ejes">
                <div className="mtd-eje">
                  <div>
                    <h3>Rentabilidad</h3>
                    <p>Cuánto renta el depto sobre lo que cuesta, después de gastos.</p>
                  </div>
                  <span className="mtd-peso">30%</span>
                </div>
                <div className="mtd-eje">
                  <div>
                    <h3>Flujo de caja</h3>
                    <p>Si el arriendo cubre la cuota y los gastos, o tienes que poner plata cada mes.</p>
                  </div>
                  <span className="mtd-peso">25%</span>
                </div>
                <div className="mtd-eje">
                  <div>
                    <h3>Plusvalía</h3>
                    <p>Cercanía a metro, trayectoria histórica de la comuna y antigüedad del edificio.</p>
                  </div>
                  <span className="mtd-peso">25%</span>
                </div>
                <div className="mtd-eje">
                  <div>
                    <h3>Eficiencia de compra</h3>
                    <p>Si el precio por m² y el retorno se comparan bien contra los deptos del radio.</p>
                  </div>
                  <span className="mtd-peso">20%</span>
                </div>
              </div>
            </div>

            <div data-m="str">
              <div className="mtd-ejes">
                <div className="mtd-eje">
                  <div>
                    <h3>Rentabilidad</h3>
                    <p>Cuánto deja la operación sobre lo invertido, ya descontada la comisión.</p>
                  </div>
                  <span className="mtd-peso">25%</span>
                </div>
                <div className="mtd-eje">
                  <div>
                    <h3>Sostenibilidad</h3>
                    <p>Cuánta ocupación necesitas para no perder plata, y cuánto margen te queda sobre eso.</p>
                  </div>
                  <span className="mtd-peso">25%</span>
                </div>
                <div className="mtd-eje">
                  <div>
                    <h3>Ventaja sobre el arriendo tradicional</h3>
                    <p>Cuánto más deja la renta corta que arrendar el mismo depto a largo plazo.</p>
                  </div>
                  <span className="mtd-peso">25%</span>
                </div>
                <div className="mtd-eje">
                  <div>
                    <h3>Factibilidad</h3>
                    <p>Si el edificio lo permite y si la operación es realista en esa zona.</p>
                  </div>
                  <span className="mtd-peso">25%</span>
                </div>
              </div>
            </div>

            <p className="mtd-nota">
              Sobre 70 el puntaje entra en rango de compra; entre 45 y 70, en rango de ajuste; bajo 45, no.
              Esas bandas son el punto de partida del veredicto, no su última palabra: lo que puede
              cambiarlo está en la sección 05.
            </p>
          </Seccion>
        </Modalidad>

        <Seccion n="04" id="veredictos" titulo="Los tres veredictos">
          <p>
            Franco no entrega un rango ni un “depende”. Entrega una de tres respuestas, y la misma para
            todos: el color y el signo son refuerzo, la palabra es la señal.
          </p>
          <div className="mtd-bandas">
            <Veredicto3 veredicto="COMPRAR">
              Los números se sostienen con los supuestos que declaraste. No significa que sea el mejor
              depto del mercado: significa que este, a este precio, funciona.
            </Veredicto3>
            <Veredicto3 veredicto="AJUSTA SUPUESTOS">
              El depto sirve, los supuestos no. A otro precio, con más pie o a otro plazo el negocio
              cierra, y el análisis te dice hasta dónde.
            </Veredicto3>
            <Veredicto3 veredicto="BUSCAR OTRA">
              Ni el arriendo ni la plusvalía esperada justifican el precio. Franco prefiere decírtelo
              antes de que firmes.
            </Veredicto3>
          </div>
        </Seccion>

        <Seccion n="05" id="gates" titulo="Cuándo el veredicto ignora el puntaje">
          <p>
            Un puntaje alto con veredicto de ajuste no es una contradicción: es el diseño. El puntaje mide
            la calidad del depto; el veredicto responde si <b>la operación se sostiene</b>. Sobre el
            puntaje corren reglas duras que pueden bajarlo, y una que puede subirlo.
          </p>
          <p>
            Baja a <b>{etiquetaVeredicto("BUSCAR OTRA", "banda")}</b>, sin importar el puntaje, cuando el
            retorno sobre el pie es fuertemente negativo, cuando el arriendo no cubre la cuota{" "}
            <mark>ni siquiera con la tasa en cero</mark>, cuando el depto está sobre el precio de su
            comuna y además el flujo es negativo, o cuando lo que pones de tu bolsillo cada mes supera la
            mitad del dividendo.
          </p>
          <p>
            Baja de <b>{etiquetaVeredicto("COMPRAR", "banda")}</b> a{" "}
            <b>{etiquetaVeredicto("AJUSTA SUPUESTOS", "banda")}</b> cuando el retorno sobre el pie es
            negativo, aunque el resto del negocio se vea bien.
          </p>
          <p>
            Y sube a <b>{etiquetaVeredicto("COMPRAR", "banda")}</b> cuando el flujo no es negativo, la
            rentabilidad neta pasa el umbral y el depto no entra sobre el precio de su zona: tres
            condiciones al mismo tiempo, no una.
          </p>
          <p className="mtd-nota">
            En renta corta las reglas son propias: si el edificio no permite arriendo por días, el
            veredicto es {etiquetaVeredicto("BUSCAR OTRA", "banda")} aunque los números den. Lo mismo si
            necesitas más ocupación de la que la zona logra.
          </p>
        </Seccion>

        <Seccion n="06" id="limites" titulo="Qué Franco no sabe">
          <p>
            Lo que un modelo no modela también es información. Esto es lo que Franco <b>no</b> incluye, y
            que tú tienes que poner de tu lado antes de decidir:
          </p>
          <div className="mtd-tabla-wrap">
            <table className="mtd-tabla">
              <caption>Fuera del modelo</caption>
              <tbody>
                <Fila
                  k="Impuestos sobre la renta y la ganancia de capital"
                  v="No se modelan"
                  nota="Ni el impuesto al arriendo ni el de la utilidad al vender. Al vender solo se descuenta la comisión de corretaje."
                />
                <Fila
                  k="Seguros"
                  v="No se modelan"
                  nota="Ni el de incendio, ni el desgravamen, ni el de contenido."
                />
                <Fila
                  k="Morosidad del arrendatario"
                  v="No se modela"
                  nota="La vacancia es lo más parecido, y no cubre a un arrendatario que deja de pagar y sigue adentro."
                />
                <Fila
                  k="El estado real del depto"
                  v="No se conoce"
                  nota="Franco estima la puesta a punto por la antigüedad. Una filtración o una fachada mala no las ve nadie desde un aviso."
                />
                <Fila
                  k="Patente municipal en renta corta"
                  v="No se modela"
                  nota="Tampoco el costo de la limpieza como línea propia: hoy entra dentro de los insumos."
                />
                <Fila
                  k="El precio al que se cerró"
                  v="No es público en Chile"
                  nota="Todo lo que compara Franco son precios pedidos. Por eso el análisis te dice hasta dónde negociar."
                />
              </tbody>
            </table>
          </div>
          <p className="mtd-nota">
            Cuando en una zona hay pocos avisos publicados de la tipología que buscas, el análisis lo
            declara: dice sobre cuántos avisos calculó cada referencia, y cuando no alcanzan para una
            mediana confiable lo dice en vez de rellenar con el promedio de otra comuna.
          </p>
        </Seccion>

        <Seccion n="07" id="preguntas" titulo="Preguntas frecuentes">
          <div className="mtd-faq">
            {FAQ.map((f, i) => (
              <details key={f.q} open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </Seccion>

        <section className="mtd-cta">
          <h2>
            Ya sabes cómo calcula.
            <br />
            <mark>Pruébalo con un depto.</mark>
          </h2>
          <CampoDireccion ubicacion="metodologia" />
          <p className="mtd-legal">
            Análisis informativo, no constituye asesoría de inversión. Las cifras corresponden a los
            períodos declarados en cada análisis. ¿Dudas que no están acá? Mira los{" "}
            <Link href="/comunas">datos por comuna</Link> o escríbenos desde{" "}
            <Link href="/contact">contacto</Link>.
          </p>
        </section>
      </main>

      <PieLanding ultimo={datos.ultimoAnalisis} ahora={ahora} />
    </div>
  );
}
