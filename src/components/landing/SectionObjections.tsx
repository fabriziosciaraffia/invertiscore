"use client";

import { useRef, useState } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { InfoTooltip } from "@/components/ui/tooltip";
import LandingModal from "./LandingModal";

/**
 * Sección 07 · Garantías — grid de 4 cards con modal al click.
 *
 * - Header gigante 56-72px scroll-driven (mismo patrón que s02).
 * - 4 cards en grid 2x2 (1 col mobile).
 * - Click en card → modal con título, body y visual completo.
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;

type Block = {
  n: "01" | "02" | "03" | "04";
  label: string;
  quote: string;
  title: string;
  body: string;
  visualKey: "data" | "form" | "cost" | "honestidad";
};

const BLOCKS: ReadonlyArray<Block> = [
  {
    n: "01",
    label: "Datos",
    quote: "¿De dónde sacan los números?",
    title: "Del mercado real, no de promedios.",
    body: "Comparamos tu departamento con información real de propiedades en venta, arriendos de largo plazo y datos en línea de Airbnb. Además, interpretamos atractores de demanda como cercanía a estaciones de metro, clínicas, universidades y comercio. 24 comunas del Gran Santiago, actualizado semanalmente.",
    visualKey: "data",
  },
  {
    n: "02",
    label: "Facilidad",
    quote: "No tengo todos los datos a mano.",
    title: "Habla claro, no en jerga financiera.",
    body: "Cualquiera puede leer el informe — sin saber de finanzas, sin glosario, sin tener que traducir nada. Las decisiones quedan claras.",
    visualKey: "form",
  },
  {
    n: "03",
    label: "Costo",
    quote: "¿Cuánto cuesta?",
    title: "Lo que cuestan dos cafés.",
    body: "Y el primero es gratis, sin tarjeta. Antes de firmar 25 años de hipoteca, el costo se paga solo. Ahorrarte un error de compra equivale a miles de análisis.",
    visualKey: "cost",
  },
  {
    n: "04",
    label: "Honestidad",
    quote: "¿Y si me dice lo que quiero escuchar?",
    title: "Franco prefiere decirte que no antes que quedar bien contigo.",
    body: "El veredicto puede ser COMPRAR, AJUSTA SUPUESTOS o BUSCAR OTRA — los tres aparecen según el análisis. Cuando los números no dan, Franco lo dice claro y te ahorra millones.",
    visualKey: "honestidad",
  },
];

export default function SectionObjections() {
  const [active, setActive] = useState<Block | null>(null);

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--franco-bg-alt)" }}
    >
      <div className="relative mx-auto w-full max-w-[1280px] px-6 py-[10vh] md:py-[10vh]">
        <ObjectionsHeader />
        <Cards onSelect={setActive} />
      </div>

      <LandingModal
        open={!!active}
        onClose={() => setActive(null)}
        ariaLabel={active ? active.label : "Detalle de objeción"}
        headerLabel={active?.label}
      >
        {active && <BlockDetail block={active} />}
      </LandingModal>
    </section>
  );
}

/* ============================ Header ============================ */

function ObjectionsHeader() {
  const reduce = useReducedMotion();
  const lines = ["Cuatro razones para confiar", "antes de hacer click."];

  const lineVariant = (i: number): Variants => ({
    hidden: { y: reduce ? "0%" : "105%" },
    show: {
      y: "0%",
      transition: {
        duration: 0.75,
        ease: EASE,
        delay: reduce ? 0 : 0.15 + i * 0.15,
      },
    },
  });

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-100px 0px -100px 0px" }}
      className="mb-12 md:mb-16"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: EASE }}
        aria-hidden="true"
        style={{
          width: 24,
          height: 1,
          background: "rgba(200, 50, 60, 0.6)",
          marginBottom: 16,
        }}
      />
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: EASE }}
        className="font-mono font-medium uppercase text-[#C8323C]"
        style={{ fontSize: 11, letterSpacing: "0.06em", marginBottom: 24 }}
      >
        Garantías
      </motion.p>

      <h2
        className="font-heading font-bold leading-[1.1] tracking-[-0.015em] text-[var(--landing-text)]"
        style={{ maxWidth: 1100, marginBottom: 24 }}
      >
        {lines.map((line, i) => (
          <span
            key={i}
            className="block overflow-hidden"
            style={{ lineHeight: 1.1 }}
          >
            <motion.span
              className="block"
              style={{ fontSize: "clamp(36px, 5.5vw, 56px)" }}
              variants={lineVariant(i)}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </h2>

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.6 }}
        className="max-w-[680px] font-body text-[var(--landing-text-secondary)]"
        style={{ fontSize: 17, lineHeight: 1.55 }}
      >
        Lo que probablemente estás pensando — y la respuesta franca.
      </motion.p>
    </motion.div>
  );
}

/* ============================ Cards grid ============================ */

function Cards({ onSelect }: { onSelect: (b: Block) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px 0px -50px 0px" });
  const reduce = useReducedMotion();

  return (
    <div ref={ref} className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
      {BLOCKS.map((b, i) => {
        // Phase 2.29 · entrada sobria fade-up vertical, alineada con el patrón
        // de s02/s03 (RevealOnScroll): sin slide lateral, sin rotación.
        return (
          <motion.button
            key={b.n}
            type="button"
            onClick={() => onSelect(b)}
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={
              inView || reduce
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 24 }
            }
            transition={{
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
              delay: reduce ? 0 : i * 0.1,
            }}
          className="group relative flex flex-col gap-5 rounded-2xl p-7 text-left transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 md:flex-row md:items-start md:gap-7 md:p-8"
          style={{
            background: "var(--landing-card-bg)",
            border: "0.5px solid var(--landing-card-border)",
            boxShadow:
              "0 1px 0 rgba(0,0,0,0.04), 0 12px 24px -16px rgba(0,0,0,0.18)",
          }}
        >
          <div className="flex flex-1 flex-col">
            <p
              className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
              style={{ fontSize: 10, letterSpacing: "0.16em" }}
            >
              {b.label}
            </p>
            <p
              className="mt-2 font-body italic leading-[1.4] text-[var(--landing-text-muted)]"
              style={{ fontSize: 15 }}
            >
              &ldquo;{b.quote}&rdquo;
            </p>
            <h3
              className="mt-3 font-heading font-bold leading-[1.2] tracking-[-0.005em] text-[var(--landing-text)]"
              style={{ fontSize: "clamp(18px, 2vw, 22px)" }}
            >
              {b.title}
            </h3>

            <div className="mt-5">
              <span
                className="inline-flex items-center gap-2 font-mono font-semibold uppercase text-[#C8323C] transition-transform duration-200 group-hover:translate-x-0.5"
                style={{ fontSize: 11, letterSpacing: "0.12em" }}
              >
                Leer más
                <span aria-hidden="true">→</span>
              </span>
            </div>
          </div>
        </motion.button>
        );
      })}
    </div>
  );
}

/* ============================ Modal content ============================ */

function BlockDetail({ block }: { block: Block }) {
  // Phase 2.26 · sin padding wrapper externo · LandingModal maneja el padding
  // del body (px-5 pt-6 pb-8 mobile, p-8 desktop). Aquí solo controlamos las
  // proporciones internas + ajustes mobile específicos (número fijo, sin
  // max-w-560 forzando wrap raro).
  return (
    <div className="w-full max-w-full">
      <span
        className="block font-heading font-bold leading-none tracking-[-0.04em] text-[#C8323C] text-[48px] md:text-[clamp(44px,4.5vw,56px)]"
        aria-hidden="true"
      >
        {block.n}
      </span>

      <p
        className="mt-3 font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.16em" }}
      >
        {block.label}
      </p>

      <p
        className="mt-3 font-body italic leading-[1.4] text-[var(--landing-text-muted)] text-[16px] md:text-[clamp(16px,1.9vw,19px)]"
      >
        &ldquo;{block.quote}&rdquo;
      </p>

      <h3
        className="mt-3 font-heading font-bold leading-[1.2] tracking-[-0.01em] text-[var(--landing-text)] text-[20px] md:text-[clamp(20px,2.6vw,26px)]"
      >
        {block.title}
      </h3>

      <p
        className="mt-4 font-body leading-[1.5] text-[var(--landing-text-secondary)] md:max-w-[560px]"
        style={{ fontSize: 14 }}
      >
        {block.body}
      </p>

      <div className="mt-6">
        <VisualSlot which={block.visualKey} />
      </div>
    </div>
  );
}

/* ============================ Visual slot (preservado de F.6) ============================ */

function VisualSlot({ which }: { which: Block["visualKey"] }) {
  if (which === "data") return <DataCardsGrid />;
  if (which === "form") return <SmartFormMock />;
  if (which === "cost") return <CostHero />;
  return <VerdictHonesty />;
}

type Kpi = { label: string; big: string; sub: string; tip: string };

const KPIS: ReadonlyArray<Kpi> = [
  {
    label: "Venta",
    big: "12.944",
    sub: "departamentos comparables en venta",
    tip: "Base de propiedades publicadas en venta que cruzamos para estimar precio justo de mercado por zona y características.",
  },
  {
    label: "Renta larga (arriendo tradicional)",
    big: "6.506",
    sub: "arriendos activos en zona",
    tip: "Departamentos efectivamente arrendados o publicados en arriendo de largo plazo, usados para calcular el arriendo de mercado realista por zona.",
  },
  {
    label: "Renta corta (Airbnb)",
    big: "ADR + Ocupación",
    sub: "tarifa diaria y ocupación por zona",
    tip: "ADR (Average Daily Rate) es la tarifa promedio por noche; ocupación es el % de días arrendados al mes. Datos en línea segmentados por zona y tipo de propiedad.",
  },
  {
    label: "Entorno",
    big: "195+",
    sub: "metros, clínicas, universidades, comercio",
    tip: "Lugares cercanos que generan demanda estable: estaciones de metro, clínicas, universidades, malls, instituciones. Cada uno aporta al perfil de demanda de la zona.",
  },
];

function DataCardsGrid() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {KPIS.map((it) => (
        <KpiTile key={it.label} item={it} />
      ))}
    </div>
  );
}

/* Tile KPI · usa InfoTooltip (mismo componente que la página de resultados):
 * trigger "?" + bubble sólido con arrow + auto-flip + singleton + portal +
 * accesibilidad. tokenSet="landing" mapea los tokens cromáticos a --landing-*
 * y portaliza dentro de [data-franco-root] para seguir el tema de la landing. */
function KpiTile({ item }: { item: Kpi }) {
  return (
    <div
      className="rounded-md px-3 py-3.5"
      style={{
        background: "var(--landing-card-bg-soft)",
        border: "0.5px solid var(--landing-card-border)",
      }}
    >
      <div className="flex items-center" style={{ gap: 6 }}>
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 9, letterSpacing: "0.14em" }}
        >
          {item.label}
        </p>
        <InfoTooltip content={item.tip} tokenSet="landing" />
      </div>

      <p
        className="mt-1.5 font-mono font-semibold leading-[1.1] text-[var(--landing-text)]"
        style={{ fontSize: 18 }}
      >
        {item.big}
      </p>
      <p
        className="mt-1 font-body leading-[1.4] text-[var(--landing-text-muted)]"
        style={{ fontSize: 11 }}
      >
        {item.sub}
      </p>
    </div>
  );
}

/* Visual Card 02 "Facilidad" · Phase 2.25 · comparación 2-columnas
 *   ✕ "Una calculadora dice"  vs  ✓ "Franco te dice"
 * que enfatiza el contraste de lenguaje (jerga financiera vs frase directa).
 * Las dos columnas viven en un grid unificado con border 0.5px externo, 1px
 * gap interno (el background del padre, theme-aware, se ve como divider).
 * Mobile: el grid colapsa a 1-col, queda calculadora arriba (jerga) y Franco
 * abajo (frase clara) — el orden de lectura mantiene el contraste.
 *
 * Bloque secundario "ADEMÁS" cierra explicando qué datos completa Franco
 * automáticamente a partir de precio + comuna.
 *
 * Reglas de capa cromática/tipográfica:
 *  · Paleta Ink + Signal Red strict (no hex inventados); colores via var()
 *    para theme-aware dark+light.
 *  · Frases en Sans regular. Datums ($310.000, UF 2, UF 4.900) en Mono Bold
 *    inline. "precio y comuna" en Sans 600 (override usuario explícito al
 *    cap del skill).
 *  · El ✓ Signal Red en el eyebrow de Franco es uso de marca permitido
 *    (indicador de polaridad positiva del costado correcto).
 */
function SmartFormMock() {
  const jerga = [
    "Cap rate 4,2% con NOI mensual negativo de −$310K",
    "Renta efectiva 11% bajo el percentil 50 del rango local",
    "Reduce LTV a 78% para alcanzar breakeven operacional",
  ];

  // Cada Franco-frase tiene el datum como atom mono bold, separado del resto
  // para poder darle peso/familia distintos sin ensuciar el JSX inline.
  const claro: Array<{ pre: string; datum: string; post: string }> = [
    { pre: "Pones ", datum: "$310.000", post: " de tu bolsillo cada mes." },
    { pre: "Tu arriendo está ", datum: "UF 2", post: " bajo lo que paga la zona." },
    { pre: "Si negocias a ", datum: "UF 4.900", post: ", el flujo cuadra." },
  ];

  // Divider entre frases dentro de cada columna · 0.5px sutil, theme-aware.
  const phraseDivider: React.CSSProperties = {
    height: 1,
    background: "color-mix(in srgb, var(--landing-text) 6%, transparent)",
    margin: "10px 0",
  };

  return (
    <div>
      {/* Grid 2-col unificado · gap 1px revela el bg del padre como separator
          theme-aware. En mobile colapsa a 1-col (stack vertical) — el orden
          de lectura mantiene jerga arriba / Franco abajo. */}
      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{
          gap: 1,
          background: "var(--landing-card-border)",
          border: "0.5px solid var(--landing-card-border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {/* Columna IZQ · "Una calculadora dice" (jerga financiera muted) */}
        <div
          style={{
            background:
              "color-mix(in srgb, var(--landing-card-bg-soft) 92%, var(--landing-text) 8%)",
            padding: "14px 14px 16px",
          }}
        >
          <p
            className="font-mono font-medium uppercase text-[var(--landing-text-muted)] m-0"
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              marginBottom: 12,
            }}
          >
            ✕ Una calculadora dice
          </p>
          {jerga.map((it, i) => (
            <div key={it}>
              {i > 0 && <div aria-hidden="true" style={phraseDivider} />}
              <p
                className="font-body text-[var(--landing-text-muted)] m-0"
                style={{ fontSize: 12, lineHeight: 1.4 }}
              >
                {it}
              </p>
            </div>
          ))}
        </div>

        {/* Columna DER · "Franco te dice" (frase clara con datum Mono Bold) */}
        <div
          style={{
            background: "var(--landing-card-bg-soft)",
            borderLeft: "3px solid #C8323C",
            padding: "14px 14px 16px",
          }}
        >
          <p
            className="font-mono font-bold uppercase m-0"
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              color: "#C8323C",
              marginBottom: 12,
            }}
          >
            ✓ Franco te dice
          </p>
          {claro.map((it, i) => (
            <div key={it.datum}>
              {i > 0 && <div aria-hidden="true" style={phraseDivider} />}
              <p
                className="font-body text-[var(--landing-text)] m-0"
                style={{ fontSize: 13.5, lineHeight: 1.4 }}
              >
                {it.pre}
                <span className="font-mono font-bold">{it.datum}</span>
                {it.post}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bloque "ADEMÁS" · qué datos completa Franco automáticamente. */}
      <div
        style={{
          marginTop: 18,
          background: "var(--landing-card-bg-soft)",
          border: "0.5px solid var(--landing-card-border)",
          borderRadius: 10,
          padding: "16px 18px",
        }}
      >
        <div
          className="flex items-center"
          style={{ gap: 12, marginBottom: 8 }}
        >
          <p
            className="font-mono font-medium uppercase text-[var(--landing-text-muted)] m-0"
            style={{ fontSize: 9, letterSpacing: "0.12em" }}
          >
            Además
          </p>
          <div
            aria-hidden="true"
            style={{
              flex: 1,
              height: 1,
              background:
                "color-mix(in srgb, var(--landing-text) 8%, transparent)",
            }}
          />
        </div>
        <p
          className="font-body text-[var(--landing-text)] m-0"
          style={{ fontSize: 13.5, lineHeight: 1.5 }}
        >
          Con solo{" "}
          <span style={{ fontWeight: 600 }}>precio y comuna</span> Franco completa
          el resto: arriendo de zona, gastos comunes, contribuciones SII y datos
          de Airbnb.
        </p>
      </div>
    </div>
  );
}

function CostHero() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl px-6 py-9"
      style={{
        background: "var(--landing-card-bg-soft)",
        border: "0.5px solid var(--landing-card-border)",
      }}
    >
      {/* Phase 2.26 · mobile cap 64px (era clamp lower 56 que ya era OK pero
          extendemos un toque · desktop clamp 56→84 sigue intacto). */}
      <p
        className="font-heading font-bold leading-none tracking-[-0.04em] text-[#C8323C] text-[64px] md:text-[clamp(56px,8vw,84px)]"
      >
        $0
      </p>
      <p
        className="mt-4 font-mono font-semibold uppercase text-[var(--landing-text)]"
        style={{ fontSize: 11, letterSpacing: "0.16em" }}
      >
        Primer análisis
      </p>
      <p
        className="mt-1.5 font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.14em" }}
      >
        Sin tarjeta · sin compromiso
      </p>
    </div>
  );
}

/* Visual Card 04 "Honestidad" · Phase 2.28 · los 3 veredictos lado a lado con
 * la frase franca que Franco da en cada caso. Replica los badges de veredicto
 * de la página de resultados LTR (Hero Verdict Block) con la lógica cromática
 * 3-case del skill Patrón 1:
 *   · COMPRAR → Ink invertido sólido (bg = texto, texto = fondo página) ·
 *     theme-aware automático vía var(--landing-text) / --landing-mockup-solid-bg.
 *   · AJUSTA SUPUESTOS → outline (transparente + texto/borde Signal Red,
 *     invariante entre temas).
 *   · BUSCAR OTRA → Signal Red sólido + texto blanco (invariante).
 * Hex literal #C8323C consistente con el resto del archivo (sistema --landing-*).
 */
function VerdictHonesty() {
  const rows: Array<{
    label: string;
    cita: string;
    badgeStyle: React.CSSProperties;
  }> = [
    {
      label: "Comprar",
      cita: "Los números cierran. Adelante.",
      badgeStyle: {
        background: "var(--landing-text)",
        color: "var(--landing-mockup-solid-bg)",
      },
    },
    {
      label: "Ajusta supuestos",
      cita: "Negocia primero. Acá está el rango.",
      badgeStyle: {
        background: "transparent",
        color: "#C8323C",
        border: "0.5px solid #C8323C",
      },
    },
    {
      label: "Buscar otra",
      cita: "No te conviene. Esto es por qué.",
      badgeStyle: {
        background: "#C8323C",
        color: "#FFFFFF",
      },
    },
  ];

  return (
    <div>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center"
            style={{
              gap: 14,
              background: "var(--landing-card-bg-soft)",
              border: "0.5px solid var(--landing-card-border)",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <span
              className="font-mono font-bold uppercase"
              style={{
                minWidth: 130,
                textAlign: "center",
                flexShrink: 0,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                padding: "6px 10px",
                borderRadius: 4,
                ...r.badgeStyle,
              }}
            >
              {r.label}
            </span>
            <p
              className="font-body italic text-[var(--landing-text-secondary)] m-0"
              style={{ fontSize: 13, lineHeight: 1.4 }}
            >
              &ldquo;{r.cita}&rdquo;
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "0.5px solid var(--landing-card-border)",
        }}
      >
        <p
          className="font-body text-[var(--landing-text-muted)] m-0"
          style={{ fontSize: 12, lineHeight: 1.45, textAlign: "center" }}
        >
          Los tres veredictos pasan seguido. Franco no tiene incentivo para
          empujarte hacia uno.
        </p>
      </div>
    </div>
  );
}
