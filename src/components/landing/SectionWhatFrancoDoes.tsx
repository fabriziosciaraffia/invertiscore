"use client";

import type { ReactNode } from "react";
import SectionHeader from "./SectionHeader";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Sección 04 · Cómo funciona (F.11 Phase 2.3 · reset estilo Linear).
 *
 * Layout natural sin sticky. 3 pasos en bloques grid 2 cols con lados
 * alternados en desktop (texto izq → mockup der, mockup izq → texto der,
 * texto izq → mockup der). En mobile colapsa a 1 col con texto arriba
 * y mockup debajo en cada paso (orden consistente, sin alternar).
 *
 * Mockups: HTML/CSS placeholder con clase .franco-mockup (gradient bg +
 * shadow stack). Se reemplazarán por screenshots reales en fase futura.
 *
 * Animaciones: solo RevealOnScroll por paso.
 */

type Step = {
  numeral: "01" | "02" | "03";
  eyebrow: string;
  title: string;
  description: string;
  /** En desktop: si true → mockup va a la izquierda, texto a la derecha. */
  mockupLeft?: boolean;
  mockup: ReactNode;
};

const STEPS: ReadonlyArray<Step> = [
  {
    numeral: "01",
    eyebrow: "Datos del depto",
    title: "Ingresas el depto que estás evaluando.",
    description:
      "Dirección, precio, superficie, modalidad. 30 segundos. Franco autocompleta el resto con datos del SII, TocToc y tu zona.",
    mockup: <MockupStep01 />,
  },
  {
    numeral: "02",
    eyebrow: "Análisis en 30 segundos",
    title: "Calcula contribuciones, flujos y comparables.",
    description:
      "Conectamos con SII para contribuciones reales, TocToc para comparables de tu zona, y modelos propios para proyección de arriendos largos y Airbnb.",
    mockupLeft: true,
    mockup: <MockupStep02 />,
  },
  {
    numeral: "03",
    eyebrow: "Decisión clara",
    title: "Score, veredicto y qué hacer en este caso.",
    description:
      "No solo te damos un puntaje. Te decimos si comprar, ajustar precio, cambiar modalidad o buscar otra. Y por qué.",
    mockup: <MockupStep03 />,
  },
];

export default function SectionWhatFrancoDoes() {
  return (
    <section
      id="que-hace-franco"
      className="relative"
      style={{ background: "var(--franco-bg-alt)" }}
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-[12vh] md:px-8 md:py-[16vh]">
        <SectionHeader
          eyebrow="04 · Cómo funciona"
          title={"Le hacemos a tu depto las preguntas\nque tu cotización no responde."}
          subhead="Datos reales del mercado, contribuciones del SII, gastos operativos, comparables de tu zona. Todo procesado por IA en 30 segundos."
        />

        <div className="mt-16 space-y-24 md:mt-24 md:space-y-32">
          {STEPS.map((step) => (
            <RevealOnScroll key={step.numeral}>
              <StepBlock data={step} />
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================ Step block ============================ */

function StepBlock({ data }: { data: Step }) {
  // En desktop alternamos lados con grid-flow-col-dense + col-start.
  // En mobile siempre texto arriba (orden natural).
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div
        className={data.mockupLeft ? "lg:order-2" : "lg:order-1"}
      >
        <StepText data={data} />
      </div>
      <div className={data.mockupLeft ? "lg:order-1" : "lg:order-2"}>
        {data.mockup}
      </div>
    </div>
  );
}

function StepText({ data }: { data: Step }) {
  return (
    <div className="max-w-[520px]">
      <p
        className="font-mono font-medium uppercase text-[#C8323C]"
        style={{
          fontSize: 14,
          letterSpacing: "0.06em",
          marginBottom: 16,
        }}
      >
        {data.numeral}
      </p>
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          marginBottom: 12,
        }}
      >
        {data.eyebrow}
      </p>
      <h3
        className="font-heading font-bold text-[var(--landing-text)]"
        style={{
          fontSize: "clamp(28px, 3.4vw, 36px)",
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          marginBottom: 16,
        }}
      >
        {data.title}
      </h3>
      <p
        className="font-body text-[var(--landing-text-muted)]"
        style={{
          fontSize: 16,
          lineHeight: 1.6,
          maxWidth: 460,
        }}
      >
        {data.description}
      </p>
    </div>
  );
}

/* ============================ Mockup · 01 Datos del depto ============================ */

function MockupStep01() {
  return (
    <div
      className="franco-mockup"
      style={{ padding: 28, aspectRatio: "4 / 3" }}
    >
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.12em", marginBottom: 20 }}
      >
        Nuevo análisis · Paso 1
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <MockField label="Dirección" value="Av. Manuel Montt 1234, Providencia" />
        <MockField label="Precio" value="UF 5.500" />
        <MockField label="Superficie" value="60 m²" />
        <MockField label="Dormitorios" value="2" />
      </div>
      <div
        style={{
          marginTop: 24,
          padding: "10px 16px",
          background: "#C8323C",
          color: "#FAFAF8",
          borderRadius: 6,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        Analizar
        <span aria-hidden="true">→</span>
      </div>
    </div>
  );
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderBottom: "0.5px solid var(--landing-divider)",
        paddingBottom: 6,
      }}
    >
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 9, letterSpacing: "0.14em", marginBottom: 2 }}
      >
        {label}
      </p>
      <p
        className="font-body text-[var(--landing-text)]"
        style={{ fontSize: 13, fontWeight: 500 }}
      >
        {value}
      </p>
    </div>
  );
}

/* ============================ Mockup · 02 Análisis ============================ */

function MockupStep02() {
  return (
    <div
      className="franco-mockup"
      style={{ padding: 28, aspectRatio: "4 / 3" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 10, letterSpacing: "0.12em" }}
        >
          Análisis en curso · Paso 2
        </p>
        <span
          className="font-mono font-semibold uppercase text-[#C8323C]"
          style={{ fontSize: 9, letterSpacing: "0.14em" }}
        >
          • procesando
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <MockKPI label="Fórmula SII" value="$78.400 / mes" hint="Contribuciones" />
        <MockKPI label="Cap rate" value="5,0%" hint="Mediano" />
        <MockKPI
          label="Flujo mensual"
          value="−$290K"
          hint="Negativo"
          red
        />
        <MockKPI label="Arriendo esperado" value="UF 19" hint="LTR / mes" />
      </div>
    </div>
  );
}

function MockKPI({
  label,
  value,
  hint,
  red,
}: {
  label: string;
  value: string;
  hint: string;
  red?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--landing-card-bg-soft)",
        border: "0.5px solid var(--landing-card-border)",
        borderRadius: 6,
        padding: 12,
      }}
    >
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 9, letterSpacing: "0.14em", marginBottom: 6 }}
      >
        {label}
      </p>
      <p
        className="font-heading font-bold"
        style={{
          fontSize: 18,
          lineHeight: 1,
          color: red ? "#C8323C" : "var(--landing-text)",
          marginBottom: 4,
        }}
      >
        {value}
      </p>
      <p
        className="font-mono uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 9, letterSpacing: "0.08em" }}
      >
        {hint}
      </p>
    </div>
  );
}

/* ============================ Mockup · 03 Veredicto ============================ */

function MockupStep03() {
  return (
    <div
      className="franco-mockup"
      style={{ padding: 28, aspectRatio: "4 / 3" }}
    >
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.12em", marginBottom: 16 }}
      >
        Resultado · Franco score
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          marginBottom: 12,
        }}
      >
        <p
          className="font-heading font-bold text-[var(--landing-text)]"
          style={{
            fontSize: 56,
            lineHeight: 0.9,
            letterSpacing: "-0.03em",
          }}
        >
          61
        </p>
        <p
          className="font-mono text-[var(--landing-text-muted)]"
          style={{ fontSize: 13, fontWeight: 500 }}
        >
          / 100
        </p>
        <div
          style={{
            marginLeft: "auto",
            background: "#C8323C",
            color: "#FAFAF8",
            padding: "4px 10px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          Ajustar
        </div>
      </div>
      <div
        style={{
          position: "relative",
          height: 4,
          background: "var(--landing-divider)",
          borderRadius: 2,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "61%",
            background: "#C8323C",
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "61%",
            top: "50%",
            width: 12,
            height: 12,
            background: "#C8323C",
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
      <div
        style={{
          background: "var(--landing-card-bg-soft)",
          border: "0.5px solid var(--landing-card-border)",
          borderLeft: "2px solid #C8323C",
          borderRadius: 4,
          padding: 12,
        }}
      >
        <p
          className="font-mono font-semibold uppercase text-[#C8323C]"
          style={{
            fontSize: 9,
            letterSpacing: "0.14em",
            marginBottom: 6,
          }}
        >
          Siendo franco
        </p>
        <p
          className="font-heading italic font-semibold text-[var(--landing-text)]"
          style={{ fontSize: 13, lineHeight: 1.4 }}
        >
          “Buena ubicación, precio incómodo. Negocia hasta UF 4.900.”
        </p>
      </div>
    </div>
  );
}
