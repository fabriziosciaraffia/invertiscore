import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getComunaStats, getAllComunasStats, fmtCLP, fmtUF, UF_CLP, tipologiaLider } from "@/lib/data/comunas-seo";
import { VeredictoCuota } from "@/components/comunas/VeredictoCuota";
import { TablaTipologias, ProcedenciaMuestraBloque } from "@/components/comunas/TablaTipologias";
import { getProsaComuna } from "@/lib/data/comuna-prosa";
import { COMUNAS_ROSTER, esComunaDelRoster, nombreDeComuna } from "@/lib/data/comunas-roster";
import { MIN_ARRIENDOS_TIPOLOGIA } from "@/lib/referencia-arriendo";
import { MIN_PER_TYPE, esComunaEstimada } from "@/lib/data/comunas-seo";
import { COPY_DEPENDE } from "@/lib/veredicto-fila";
import { ChipEstimado } from "@/components/comunas/ChipEstimado";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { AppFooter } from "@/components/chrome/AppFooter";
import { CtaAnalizar } from "@/components/CtaAnalizar";
import { PlusvaliaComunaSection } from "@/components/comunas/PlusvaliaComunaSection";
import { GFK_SERIE, PLUSVALIA_ESTIMADO, coberturaPlusvaliaDe } from "@/lib/plusvalia-estimado.gen";

export const revalidate = 86400;

// El roster manda: qué páginas existen no lo decide el scraping de la semana.
export function generateStaticParams() {
  return COMUNAS_ROSTER.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const nombre = nombreDeComuna(params.slug);
  if (!nombre) return { title: "Comuna no encontrada — Franco" };

  const stats = await getComunaStats(params.slug);

  // Comuna del roster sin datos suficientes esta semana: la página igual existe
  // (200), así que necesita metadata propia — sin cifras que no tenemos.
  if (!stats) {
    return {
      title: `Invertir en ${nombre} — Rentabilidad y datos reales`,
      description: `Qué rinde hoy un departamento en ${nombre}. Franco analiza precio, arriendo y flujo de caja con datos reales del mercado.`,
      alternates: { canonical: `/comunas/${params.slug}` },
      openGraph: {
        title: `Departamentos en ${nombre} — ¿Vale la pena invertir?`,
        description: `Analiza si un departamento en ${nombre} conviene como inversión.`,
        url: `https://refranco.ai/comunas/${params.slug}`,
        siteName: "Franco",
        locale: "es_CL",
        images: ["/opengraph-image"],
      },
    };
  }

  // El arriendo de la description sale de las mismas filas que la tabla: si
  // todas son estimadas desde el m² comunal, la description lo dice; si solo
  // algunas, también. Un snippet de Google que promete "arriendo promedio"
  // sobre un estimado es la misma mentira que la página ya no cuenta.
  const estimadas = stats.tipologias.filter((t) => t.referencia.fuente === "comunalPorM2").length;
  const arriendoDesc =
    estimadas > 0 && estimadas === stats.tipologias.length
      ? `Arriendo estimado ${fmtCLP(stats.arriendoRepresentativo)}/mes, desde el m² de la comuna (sin arriendos propios por tipología)`
      : estimadas > 0
        ? `Arriendo promedio ${fmtCLP(stats.arriendoRepresentativo)}/mes (incluye tipologías con arriendo estimado)`
        : `Arriendo promedio ${fmtCLP(stats.arriendoRepresentativo)}/mes`;

  return {
    // Sin "| Franco" acá: la marca la agrega el template del root layout
    // (%s | Franco); con ella adentro el <title> salía "… | Franco | Franco".
    title: `Invertir en ${stats.nombre} — Rentabilidad y datos reales`,
    description: `Rentabilidad bruta promedio ${stats.rentabilidadBruta}% en ${stats.nombre}. ${arriendoDesc}. Basado en ${stats.totalPropiedades} propiedades reales.`,
    alternates: { canonical: `/comunas/${stats.slug}` },
    openGraph: {
      title: `Departamentos en ${stats.nombre} — ¿Vale la pena invertir?`,
      description: `Franco analiza ${stats.totalPropiedades} propiedades en ${stats.nombre}. Rentabilidad promedio: ${stats.rentabilidadBruta}%`,
      url: `https://refranco.ai/comunas/${stats.slug}`,
      siteName: "Franco",
      locale: "es_CL",
      // Un openGraph propio REEMPLAZA completo al del root (merge shallow de
      // Next) y con él se pierde la imagen file-based — se referencia explícita.
      images: ["/opengraph-image"],
    },
  };
}

function rentColor(r: number) {
  if (r >= 5) return "var(--franco-positive)";
  if (r >= 3) return "var(--franco-warning)";
  return "#C8323C";
}

/**
 * Comuna del roster sin muestra suficiente esta semana. Responde 200 con lo que
 * sí es cierto —que la comuna se analiza— y omite las cifras. Nunca rellena ni
 * interpola: un número inventado es peor que un número ausente.
 */
function ComunaSinDatos({ nombre }: { nombre: string }) {
  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <UnifiedNav variant="marketing" />

      <main className="mx-auto max-w-[1100px] px-6 py-12">
        <nav className="mb-6 font-body text-xs text-[var(--franco-text-muted)]">
          <Link href="/" className="hover:text-[var(--franco-text-secondary)]">Inicio</Link>
          {" → "}
          <Link href="/comunas" className="hover:text-[var(--franco-text-secondary)]">Comunas</Link>
          {" → "}
          <span className="text-[var(--franco-text-secondary)]">{nombre}</span>
        </nav>

        <h1 className="font-heading text-3xl font-bold text-[var(--franco-text)] sm:text-4xl">
          Invertir en {nombre} — ¿Vale la pena en {new Date().getFullYear()}?
        </h1>

        <div className="mt-8 rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6 shadow-sm">
          <p className="font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
            Esta semana {nombre} no junta avisos suficientes ni para una mediana por
            tipología ni para estimar el arriendo desde el metro cuadrado de la comuna.
            Franco prefiere no darte un número antes que darte uno malo: los datos se
            actualizan cada semana y las cifras vuelven apenas la muestra alcance.
          </p>
          <p className="mt-4 font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
            Mientras tanto, si tienes un departamento concreto en la mira, el análisis
            no depende de estos promedios: Franco lo evalúa con los datos de esa
            propiedad.
          </p>
        </div>

        <section className="mt-14">
          <div className="rounded-2xl border border-[#C8323C]/20 bg-[#C8323C]/[0.06] p-10 text-center">
            <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">¿Tienes un departamento en {nombre}?</h2>
            <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">
              Analízalo en 2 minutos. Franco te dice si comprar, negociar o seguir buscando.
            </p>
            <CtaAnalizar origen="comuna_detalle" comuna={nombre}
              className="mt-5 inline-block rounded-lg bg-[#C8323C] px-8 py-3 font-body text-sm font-bold text-white hover:bg-[#b02a33]"
            >
              Analizar depto en {nombre}
            </CtaAnalizar>
          </div>
        </section>

        {/* La plusvalía histórica no depende de la muestra scraped de la semana:
            la página degradada igual publica la data histórica que sí existe. */}
        <PlusvaliaComunaSection comuna={nombre} />

        <section className="mt-14">
          <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Otras comunas</h2>
          <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">
            Mira el <Link href="/comunas" className="underline hover:text-[var(--franco-text)]">ranking de rentabilidad por comuna</Link> con los datos que sí están disponibles.
          </p>
        </section>
      </main>

      <AppFooter variant="minimal" />
    </div>
  );
}

export default async function ComunaPage({ params }: { params: { slug: string } }) {
  // 404 solo para slugs que NUNCA fueron página (una comuna inventada en la
  // URL). Las del roster responden 200 siempre — si esta semana no hay datos
  // suficientes, la página degrada más abajo en vez de desaparecer.
  if (!esComunaDelRoster(params.slug)) notFound();
  const nombreRoster = nombreDeComuna(params.slug)!;

  const stats = await getComunaStats(params.slug);
  if (!stats) return <ComunaSinDatos nombre={nombreRoster} />;

  const allComunas = await getAllComunasStats();

  // 5 most similar by precio/m²
  const similares = allComunas
    .filter((c) => c.slug !== stats.slug && c.precioM2Promedio > 0)
    .sort((a, b) => Math.abs(a.precioM2Promedio - stats.precioM2Promedio) - Math.abs(b.precioM2Promedio - stats.precioM2Promedio))
    .slice(0, 5);

  // El "promedio de Santiago (3,8%)" era una constante hardcodeada que la página
  // presentaba como dato de mercado. Murió: la comparación honesta que queda es
  // la del arriendo contra la cuota, que sale del cálculo y cambia por comuna.
  const precioM2CLP = Math.round(stats.precioM2Promedio * UF_CLP);
  const year = new Date().getFullYear();

  // Titular: rango de rentabilidad, NO el veredicto. Se midió que 13 de 25
  // comunas dan vuelta su veredicto con menos de 5% de movimiento en la mediana
  // de arriendo (Providencia con 1,4%), y un h1 que se contradice entre crawls
  // es peor para la identidad de la página que uno estable. El rango deriva sin
  // flipear. Ver el contrato, tab D.
  // Misma regla que el líder (tipologiaLider): el rango sale de las filas con
  // mediana propia; las estimadas entran solo cuando no hay otra.
  const filasParaRango = stats.tipologias.filter((t) => t.referencia.fuente === "porTipologia");
  const rents = (filasParaRango.length ? filasParaRango : stats.tipologias).map((t) => t.rentabilidadBruta);
  const rentMin = rents.length ? Math.min(...rents) : stats.rentabilidadBruta;
  const rentMax = rents.length ? Math.max(...rents) : stats.rentabilidadBruta;
  const n1 = (n: number) => n.toFixed(1).replace(".", ",");
  const tituloRent = rentMin === rentMax
    ? `${n1(rentMin)}% de rentabilidad bruta`
    : `rentabilidad de ${n1(rentMin)}% a ${n1(rentMax)}%`;

  const lider = tipologiaLider(stats.tipologias);

  // Prosa de Franco: se genera UNA vez por comuna y se persiste con el snapshot
  // de los números que narró (scripts/data/generar-prosa-comunas.ts). Acá SOLO
  // se lee — nunca se genera en render. Sin fila, la página cae a su síntesis
  // calculada: dice menos, pero no inventa.
  const prosaComuna = await getProsaComuna(params.slug);
  // Aviso de muestra chica. El umbral viejo (<10 propiedades) era inalcanzable:
  // la comuna ni siquiera publicaba bajo 50, así que el aviso nunca se mostró.
  // Ahora avisa cuando los números descansan en poco: una sola tipología con
  // muestra válida (el "promedio de la comuna" es en realidad el de UN segmento)
  // o menos de 300 avisos utilizables — el corte cae en el salto natural de la
  // distribución (la cola va 156·213·237·237·266·271, y de ahí salta a 393).
  const lowData = stats.nSegmentos <= 1 || stats.totalPropiedades < 300;

  // Badge
  const badge = stats.rentabilidadBruta >= 5
    ? { text: "Una de las comunas más rentables de Santiago", color: "var(--franco-positive)" }
    : stats.rentabilidadBruta < 3
    ? { text: "Rentabilidad por debajo del promedio de Santiago", color: "#C8323C" }
    : null;

  // FAQ de plusvalía: solo cuando hay trayectoria REAL que citar (serie GFK o
  // par A&C). Con solo-nivel no se afirma valorización — degradación honesta.
  const coberturaPlus = coberturaPlusvaliaDe(stats.nombre);
  const serieGfk = GFK_SERIE[stats.nombre];
  const acPlus = PLUSVALIA_ESTIMADO[stats.nombre];
  // F4.1 — la cifra y el período salen de la TRAYECTORIA (acPlus), igual que el
  // bloque visible y que el informe. El FAQ los tomaba de la serie del gráfico y
  // por eso publicaba en el JSON-LD un rango y un porcentaje distintos de los
  // que decía el informe de la misma comuna.
  // Un decimal fijo, igual que el bloque visible (fmt1): con String() un 5,0
  // se publicaba como "5" y el JSON-LD quedaba con otra precisión que la página.
  const num = (n: number) => n.toFixed(1).replace(".", ",");
  const faqPlusvalia =
    coberturaPlus === "trayectoria_gfk" && serieGfk && acPlus
      ? {
          "@type": "Question",
          name: `¿Cuánto se ha valorizado ${stats.nombre}?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `El m² de departamentos nuevos en ${stats.nombre} pasó de UF ${num(acPlus.precioInicio)} a UF ${num(acPlus.precioFin)} entre ${acPlus.rangoHist.replace("-", " y ")} — un ${num(acPlus.anualizada)}% anual promedio (fuente: GfK/NielsenIQ, precios de oferta de deptos nuevos). Es historia observada, no proyección.`,
          },
        }
      : (coberturaPlus === "nivel_mas_ac" || coberturaPlus === "solo_ac") && acPlus
        ? {
            "@type": "Question",
            name: `¿Cuánto se ha valorizado ${stats.nombre}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `Entre ${acPlus.rangoHist.replace("-", " y ")} el precio promedio de departamentos en ${stats.nombre} subió ${acPlus.plusvalia10a}% acumulado (${num(acPlus.anualizada)}% anual), según Arenas & Cayo con Tinsa, Propital y Activo Más. Es historia observada, no proyección.`,
            },
          }
        : null;

  // FAQ — las tres preguntas cambian de RESPUESTA por comuna (cifra, signo y
  // tipología ganadora), no solo de nombre. Las tres de antes eran idénticas en
  // las 25 páginas y la tercera ni siquiera cambiaba los números: una FAQPage
  // calcada es peor que ninguna. La tercera se adapta cuando la muestra es
  // chica, que es lo que esa comuna necesita explicar.
  const nDorm = (d: number) => `${d} dormitorio${d === 1 ? "" : "s"}`;
  const mejorRent = stats.tipologias.length
    ? stats.tipologias.reduce((a2, b2) => (b2.rentabilidadBruta > a2.rentabilidadBruta ? b2 : a2))
    : null;
  const peorRent = stats.tipologias.length
    ? stats.tipologias.reduce((a2, b2) => (b2.rentabilidadBruta < a2.rentabilidadBruta ? b2 : a2))
    : null;
  // Conteos del veredicto PUBLICADO (veredictoFila): una fila estimada cuyo
  // rango cruza la cuota no cuenta ni a favor ni en contra.
  const cubrenN = stats.tipologias.filter((t) => t.veredictoFila === "sePagaSola").length;
  const dependen = stats.tipologias.filter((t) => t.veredictoFila === "dependeDelArriendoReal");
  const decididasN = stats.tipologias.length - dependen.length;
  const chicasN = stats.tipologias.filter((t) => t.muestraChica).length;
  const estimadas = stats.tipologias.filter((t) => t.referencia.fuente === "comunalPorM2");
  const propias = stats.tipologias.filter((t) => t.referencia.fuente === "porTipologia");
  const listaDorms = (ts: typeof stats.tipologias) =>
    ts.map((t) => `el ${t.dorms}D`).join(", ").replace(/, ([^,]*)$/, " y $1");
  // Respaldo del número del líder, para las FAQ: un estimado se dice como
  // estimado y con su rango; una mediana con pocos avisos, como muestra chica.
  const respaldoLider = !lider
    ? ""
    : lider.referencia.fuente === "comunalPorM2"
      ? ` El arriendo del ${nDorm(lider.dorms)} es un estimado desde el metro cuadrado de la comuna (${lider.referencia.nComunal.toLocaleString("es-CL")} arriendos publicados), entre ${fmtCLP(lider.referencia.rangoCLP.min)} y ${fmtCLP(lider.referencia.rangoCLP.max)}: tómalo como orden de magnitud.`
      : lider.muestraChica
        ? ` Esa cifra se apoya en ${lider.nArriendos} arriendos publicados, una muestra chica para la comuna.`
        : "";

  const faqEquilibrio = lider
    ? {
        "@type": "Question",
        name: `¿A qué precio se paga solo un departamento en ${stats.nombre}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: lider.veredictoFila === "sePagaSola"
            ? `Un ${nDorm(lider.dorms)} en ${stats.nombre} se paga solo hasta UF ${lider.precioCuotaUF.toLocaleString("es-CL")}: sobre ese precio el arriendo deja de cubrir la cuota, con pie de ${stats.supuestos.piePct}% a ${stats.supuestos.plazoAnos} años. La mediana de la comuna hoy está en UF ${lider.ventaUF.toLocaleString("es-CL")}.${respaldoLider}`
            : `Un ${nDorm(lider.dorms)} tendría que costar UF ${lider.precioCuotaUF.toLocaleString("es-CL")} para que el arriendo cubra la cuota, un ${Math.abs(lider.deltaPct).toFixed(1).replace(".", ",")}% bajo la mediana de la comuna (UF ${lider.ventaUF.toLocaleString("es-CL")}), con pie de ${stats.supuestos.piePct}% a ${stats.supuestos.plazoAnos} años. Es la tipología que queda más cerca.${respaldoLider}`,
        },
      }
    : null;

  // Las filas sin veredicto se nombran aparte, con el copy canónico, y nunca
  // suman al "N de M": ni a favor ni en contra.
  const notaDepende = dependen.length
    ? ` ${listaDorms(dependen).replace(/^el/, "El")} ${dependen.length === 1 ? "queda" : "quedan"} sin veredicto: ${COPY_DEPENDE}`
    : "";
  const faqDividendo = stats.tipologias.length
    ? {
        "@type": "Question",
        name: `¿El arriendo alcanza para pagar el dividendo en ${stats.nombre}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: !lider
            ? `Depende del arriendo real. En ${stats.nombre} el arriendo es estimado y en ${listaDorms(dependen)} el rango cruza la cuota: ${COPY_DEPENDE}`
            : cubrenN === 0
              ? `No, en ninguna de las ${decididasN === 1 ? "tipologías con veredicto" : `${decididasN} tipologías con veredicto`}. En un ${nDorm(lider.dorms)}, que es el que queda más cerca, faltan ${fmtCLP(Math.abs(lider.brechaCLP))} al mes con pie de ${stats.supuestos.piePct}% a ${stats.supuestos.plazoAnos} años.${notaDepende}`
              : cubrenN === decididasN
                ? `Sí, en ${decididasN === 1 ? "la única tipología con veredicto" : `las ${decididasN} tipologías con veredicto`}. En un ${nDorm(lider.dorms)} sobran ${fmtCLP(lider.brechaCLP)} al mes con pie de ${stats.supuestos.piePct}% a ${stats.supuestos.plazoAnos} años.${notaDepende}`
                : `En ${cubrenN} de ${decididasN} tipologías con veredicto sí. En un ${nDorm(lider.dorms)} sobran ${fmtCLP(lider.brechaCLP)} al mes; en las demás el arriendo no alcanza a cubrir la cuota.${notaDepende}`,
        },
      }
    : null;

  const faqTercera = estimadas.length > 0
    ? {
        "@type": "Question",
        name: `¿Por qué ${estimadas.length === 1 ? "una tipología" : "algunas tipologías"} de ${stats.nombre} ${estimadas.length === 1 ? "tiene" : "tienen"} arriendo estimado?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Porque ${listaDorms(estimadas)} no ${estimadas.length === 1 ? "junta" : "juntan"} ${MIN_ARRIENDOS_TIPOLOGIA} arriendos publicados propios (${estimadas.map((t) => `${t.nArriendos} de ${t.dorms}D`).join(", ")}). En vez de dejar la fila afuera, Franco estima ese arriendo desde el metro cuadrado de los ${estimadas[0].referencia.fuente === "comunalPorM2" ? estimadas[0].referencia.nComunal.toLocaleString("es-CL") : 0} arriendos publicados en la comuna, ajustado por tipología, y lo publica como rango, no como cifra exacta.${propias.length ? ` ${listaDorms(propias).replace(/^el/, "El")} ${propias.length === 1 ? "usa" : "usan"} la mediana de sus propios avisos.` : ""} Si una tipología no aparece, es porque ni siquiera junta ${MIN_PER_TYPE} ventas para tener un precio.`,
        },
      }
    : chicasN >= Math.max(1, Math.ceil(stats.tipologias.length / 2))
    ? {
        "@type": "Question",
        name: `¿Por qué hay menos datos de ${stats.nombre} que de otras comunas?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Porque se publican menos arriendos: ${stats.tipologias.map((t) => `${t.nArriendos} avisos de ${t.dorms}D`).join(", ")}. Las tipologías que faltan no juntan ${MIN_PER_TYPE} ventas publicadas, y sin precio no hay fila que armar — por eso la tabla tiene ${stats.tipologias.length} de 4 filas.`,
        },
      }
    : mejorRent && peorRent
      ? {
          "@type": "Question",
          name: `¿Qué tipología rinde más en ${stats.nombre}?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: mejorRent.dorms === peorRent.dorms
              ? `El ${nDorm(mejorRent.dorms)}, con ${mejorRent.rentabilidadBruta.toFixed(1).replace(".", ",")}% de rentabilidad bruta. Es la única tipología con muestra suficiente en ${stats.nombre}.`
              : `El ${nDorm(mejorRent.dorms)}, con ${mejorRent.rentabilidadBruta.toFixed(1).replace(".", ",")}% de rentabilidad bruta${mejorRent.referencia.fuente === "comunalPorM2" ? " —con arriendo estimado desde el m² comunal, no mediana propia—" : mejorRent.muestraChica ? " —aunque es la tipología con menos avisos de la comuna—" : ""}. El que menos rinde es el ${nDorm(peorRent.dorms)}, con ${peorRent.rentabilidadBruta.toFixed(1).replace(".", ",")}%.`,
          },
        }
      : null;

  // FAQ Schema
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      ...(faqEquilibrio ? [faqEquilibrio] : []),
      ...(faqDividendo ? [faqDividendo] : []),
      ...(faqTercera ? [faqTercera] : []),
      ...(faqPlusvalia ? [faqPlusvalia] : []),
    ],
  };

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Navbar */}
      <UnifiedNav variant="marketing" />

      <main className="mx-auto max-w-[1100px] px-6 py-12">
        {/* Breadcrumb */}
        <nav className="mb-6 font-body text-xs text-[var(--franco-text-muted)]">
          <Link href="/" className="hover:text-[var(--franco-text-secondary)]">Inicio</Link>
          {" → "}
          <Link href="/comunas" className="hover:text-[var(--franco-text-secondary)]">Comunas</Link>
          {" → "}
          <span className="text-[var(--franco-text-secondary)]">{stats.nombre}</span>
        </nav>

        {/* Hero */}
        <h1 className="font-heading text-3xl font-bold text-[var(--franco-text)] sm:text-4xl">
          Invertir en {stats.nombre} en {year} — {tituloRent}
        </h1>

        {badge && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5" style={{ background: `${badge.color}15`, border: `1px solid ${badge.color}30` }}>
            <span className="font-body text-xs font-medium" style={{ color: badge.color }}>
              {stats.rentabilidadBruta >= 5 ? "✓" : "⚠"} {badge.text}
            </span>
          </div>
        )}

        {lowData && (
          <div className="mt-4 rounded-lg border border-[var(--franco-v-adjust-bg)] bg-[var(--franco-v-adjust-bg)] px-4 py-3">
            <p className="font-body text-xs text-[var(--franco-warning)]">
              Muestra limitada — los números de esta comuna salen de menos avisos que el resto. Tómalos como referencia, no como precisión.
            </p>
          </div>
        )}

        {/* 01 · Veredicto de la comuna + capa de palanca */}
        <VeredictoCuota stats={stats} />

        {/* 02 · Los números por tipología + supuestos */}
        <TablaTipologias stats={stats} />

        {/* 03 · La lectura de Franco. Si hay prosa generada, va esa; si no, la
            síntesis calculada. Los precios de este bloque son UF/m² y están
            rotulados — la tabla de arriba habla en UF de depto. */}
        <section className="mt-14">
          <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Qué dicen los datos</h2>
          {prosaComuna ? (
            <div className="mt-4 rounded-r-2xl border border-[var(--franco-border)] border-l-[3px] border-l-[var(--franco-text)] bg-[var(--franco-card)] p-6">
              <span className="inline-block rounded-full bg-[var(--franco-sunken,var(--franco-bg))] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--franco-text-secondary)]">
                ★ Análisis generado por Franco IA
              </span>
              <p className="mt-3.5 max-w-[68ch] font-body text-[15px] italic leading-[1.65] text-[var(--franco-text-secondary)]">
                {prosaComuna.prosa}
              </p>
              <p className="mt-4 font-body text-[11px] italic text-[var(--franco-text-muted)]">
                Este análisis es informativo y no constituye asesoría de inversión. Los datos se actualizan semanalmente desde fuentes públicas.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6">
              <p className="font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                En {stats.nombre}, el metro cuadrado de los departamentos publicados está en {fmtUF(stats.precioM2Promedio)}/m²
                ({fmtCLP(precioM2CLP)} por m²) y el arriendo mediano en {fmtCLP(stats.arriendoRepresentativo)} al mes,
                lo que deja una rentabilidad bruta de {n1(stats.rentabilidadBruta)}%.
                {lider && (lider.veredictoFila === "sePagaSola"
                  ? ` A los supuestos de arriba, el ${lider.dorms}D es el que más margen deja: el arriendo cubre la cuota y sobran ${fmtCLP(lider.brechaCLP)} al mes.`
                  : ` A los supuestos de arriba, ni siquiera el ${lider.dorms}D —el que queda más cerca— alcanza a cubrir la cuota: le faltan ${fmtCLP(Math.abs(lider.brechaCLP))} al mes.`)}
              </p>
              <p className="mt-4 font-body text-[11px] italic text-[var(--franco-text-muted)]">
                Este análisis es informativo y no constituye asesoría de inversión. Los datos se actualizan semanalmente desde fuentes públicas.
              </p>
            </div>
          )}
        </section>

        <PlusvaliaComunaSection comuna={stats.nombre} />

        {/* 04 · Procedencia de la muestra: qué cuenta el número que publicamos */}
        <ProcedenciaMuestraBloque stats={stats} />

        {/* Comparativa */}
        {similares.length > 0 && (
          <section className="mt-14">
            <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Comparativa con comunas similares</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--franco-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--franco-border)] text-left">
                    <th className="px-4 py-3 font-body font-medium text-[var(--franco-text-secondary)]">Comuna</th>
                    <th className="px-4 py-3 font-body font-medium text-[var(--franco-text-secondary)]">Rentabilidad</th>
                    <th className="px-4 py-3 font-body font-medium text-[var(--franco-text-secondary)]">Arriendo prom.</th>
                    <th className="px-4 py-3 font-body font-medium text-[var(--franco-text-secondary)]">UF/m²</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--franco-border)] bg-[var(--franco-card)]">
                    <td className="px-4 py-3 font-body font-semibold text-[var(--franco-text)]">
                      {stats.nombre}
                      {esComunaEstimada(stats) && <ChipEstimado />}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium" style={{ color: rentColor(stats.rentabilidadBruta) }}>{stats.rentabilidadBruta.toFixed(1).replace(".", ",")}%</td>
                    <td className="px-4 py-3 font-mono font-medium text-[var(--franco-text)]">{fmtCLP(stats.arriendoRepresentativo)}</td>
                    <td className="px-4 py-3 font-mono font-medium text-[var(--franco-text)]">{stats.precioM2Promedio.toFixed(1).replace(".", ",")}</td>
                  </tr>
                  {similares.map((c) => (
                    <tr key={c.slug} className="border-b border-[var(--franco-border)]">
                      <td className="px-4 py-3">
                        <Link href={`/comunas/${c.slug}`} className="font-body text-[var(--franco-text)] hover:text-[var(--franco-text)]">{c.nombre}</Link>
                        {esComunaEstimada(c) && <ChipEstimado />}
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--franco-text-secondary)]">{c.rentabilidadBruta.toFixed(1).replace(".", ",")}%</td>
                      <td className="px-4 py-3 font-mono text-[var(--franco-text-secondary)]">{fmtCLP(c.arriendoRepresentativo)}</td>
                      <td className="px-4 py-3 font-mono text-[var(--franco-text-secondary)]">{c.precioM2Promedio.toFixed(1).replace(".", ",")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}


        {/* FAQ */}
        <section className="mt-14">
          <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Preguntas frecuentes</h2>
          <div className="mt-4 space-y-4">
            {(faqSchema.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>).map((q, i) => (
              <div key={i} className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
                <h3 className="font-body text-sm font-semibold text-[var(--franco-text)]">{q.name}</h3>
                <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">{q.acceptedAnswer.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA — nace del dato, no pegado al final. El precio de equilibrio es el
            gancho, y el propio CTA aclara que el análisis del depto suma los
            gastos que esta página no conoce: es el puente entre los dos
            break-even, para que nadie lea una contradicción. */}
        <section className="mt-14">
          <div className="rounded-2xl border border-[#C8323C]/20 bg-[#C8323C]/[0.06] p-10 text-center">
            {lider ? (
              <>
                <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">
                  ¿Viste un {lider.dorms}D en {stats.nombre}{" "}
                  {lider.veredictoFila === "sePagaSola" ? "bajo" : "cerca de"}{" "}
                  <span className="font-mono">UF {lider.precioCuotaUF.toLocaleString("es-CL")}</span>?
                </h2>
                <p className="mx-auto mt-2 max-w-[62ch] font-body text-sm text-[var(--franco-text-secondary)]">
                  {lider.veredictoFila === "sePagaSola"
                    ? `Sobre ese precio deja de pagarse solo con pie de ${stats.supuestos.piePct}% a ${stats.supuestos.plazoAnos} años`
                    : `Ese es el precio al que el arriendo cubriría la cuota con pie de ${stats.supuestos.piePct}% a ${stats.supuestos.plazoAnos} años`}
                  {lider.referencia.fuente === "comunalPorM2"
                    ? `, calculado con un arriendo estimado desde el m² comunal (entre ${fmtCLP(lider.referencia.rangoCLP.min)} y ${fmtCLP(lider.referencia.rangoCLP.max)})`
                    : lider.muestraChica
                      ? `, calculado sobre ${lider.nArriendos} arriendos publicados`
                      : ""}.
                  Analiza el que tienes en la mira con sus números reales — gastos comunes, contribuciones y
                  estado incluidos — y Franco te dice si de verdad cierra.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">¿Tienes un departamento en {stats.nombre}?</h2>
                <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">
                  Analízalo en 2 minutos. Franco te dice si comprar, ajustar supuestos o buscar otra.
                </p>
              </>
            )}
            <CtaAnalizar origen="comuna_detalle" comuna={stats.nombre}
              className="mt-5 inline-block rounded-lg bg-[#C8323C] px-8 py-3 font-body text-sm font-bold text-white hover:bg-[#b02a33]"
            >
              Analizar depto en {stats.nombre}
            </CtaAnalizar>
          </div>
        </section>
      </main>

      {/* Footer */}
      <AppFooter variant="minimal" />
    </div>
  );
}
