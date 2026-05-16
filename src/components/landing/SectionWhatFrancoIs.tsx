"use client";

import SectionHeader from "./SectionHeader";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Sección 03 · Qué es Franco (F.11 Phase 2.2 · reset estilo Linear).
 *
 * Layout natural sin sticky scroll. 2 cols en desktop:
 *  ┌──────────────────┬──────────────────┐
 *  │ Header                              │
 *  ├──────────────────┼──────────────────┤
 *  │ 4 bullets        │ Caja Franco      │
 *  │ INTERPRETA       │ (cita + acciones)│
 *  │ IDENTIFICA       │                  │
 *  │ PROPONE          │                  │
 *  │ VIGILA           │                  │
 *  └──────────────────┴──────────────────┘
 *
 * Mobile: grid colapsa a 1 col, caja debajo de bullets.
 * Animaciones: solo RevealOnScroll con stagger.
 */

type Bullet = {
  id: "01" | "02" | "03" | "04";
  verb: "INTERPRETA" | "IDENTIFICA" | "PROPONE" | "VIGILA";
  title: string;
  description: string;
};

const BULLETS: ReadonlyArray<Bullet> = [
  {
    id: "01",
    verb: "INTERPRETA",
    title: "Lee todos los gastos reales de tu caso.",
    description:
      "Contribuciones, GGCC, vacancia, mantención. Nada se queda fuera de la ecuación.",
  },
  {
    id: "02",
    verb: "IDENTIFICA",
    title: "Encuentra dónde está el problema real.",
    description:
      "Precio sobre mercado, estructura mal armada, modalidad equivocada. No solo te muestra el síntoma — te dice la causa.",
  },
  {
    id: "03",
    verb: "PROPONE",
    title: "Da alternativas concretas para actuar.",
    description:
      "Negociar el precio, reestructurar el pie, cambiar la modalidad a Airbnb, buscar otra opción. Cada caso tiene su salida.",
  },
  {
    id: "04",
    verb: "VIGILA",
    title: "Anticipa riesgos del análisis a largo plazo.",
    description:
      "Tasas que pueden subir, vacancia, plusvalía de la zona, eventos del barrio. Franco te muestra qué podría salir mal.",
  },
];

export default function SectionWhatFrancoIs() {
  return (
    <section
      id="que-es-franco"
      className="relative"
      style={{ background: "var(--franco-bg-base)" }}
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-[12vh] md:px-8 md:py-[16vh]">
        <SectionHeader
          eyebrow="03 · Qué es Franco"
          title={"No es una calculadora.\nEs un asesor con IA."}
          subhead="Franco interpreta tu caso, identifica el problema real y propone alternativas concretas. No te entrega solo números — te dice qué hacer con ellos."
        />

        <div className="mt-16 grid grid-cols-1 gap-12 md:mt-24 lg:grid-cols-2 lg:gap-16">
          {/* Columna izquierda · 4 bullets */}
          <div>
            {BULLETS.map((b, i) => (
              <RevealOnScroll key={b.id} delay={i * 0.1}>
                <BulletItem data={b} last={i === BULLETS.length - 1} />
              </RevealOnScroll>
            ))}
          </div>

          {/* Columna derecha · Caja Franco */}
          <RevealOnScroll delay={0.4}>
            <FrancoBox />
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}

/* ============================ Bullet ============================ */

function BulletItem({ data, last }: { data: Bullet; last: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 40 }}>
      <p
        className="font-mono font-medium uppercase text-[#C8323C]"
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          marginBottom: 12,
        }}
      >
        {data.id} · {data.verb}
      </p>
      <p
        className="font-body font-semibold text-[var(--landing-text)]"
        style={{
          fontSize: "clamp(18px, 1.8vw, 22px)",
          lineHeight: 1.3,
          marginBottom: 12,
        }}
      >
        {data.title}
      </p>
      <p
        className="font-body text-[var(--landing-text-muted)]"
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          maxWidth: 420,
        }}
      >
        {data.description}
      </p>
    </div>
  );
}

/* ============================ Caja Franco ============================ */

function FrancoBox() {
  return (
    <div
      className="franco-card"
      // Border-left Signal Red 3px para enfatizar (override local sobre .franco-card).
      style={{ borderLeft: "3px solid #C8323C" }}
    >
      <p
        className="font-mono font-semibold uppercase text-[#C8323C]"
        style={{
          fontSize: 11,
          letterSpacing: "0.10em",
          marginBottom: 16,
        }}
      >
        Siendo franco
      </p>
      <p
        className="font-heading italic font-semibold leading-[1.4] text-[var(--landing-text)]"
        style={{
          fontSize: "clamp(22px, 2.4vw, 28px)",
          marginBottom: 32,
        }}
      >
        “Excelente ubicación al precio equivocado. Negocia hasta UF 4.900 y
        opera en Airbnb. Así el flujo se sostiene.”
      </p>
      <div
        style={{
          borderTop: "0.5px solid var(--landing-divider)",
          marginBottom: 24,
        }}
      />
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{
          fontSize: 10,
          letterSpacing: "0.06em",
          marginBottom: 16,
        }}
      >
        Qué hace en este caso
      </p>
      <ul
        className="font-body text-[var(--landing-text)]"
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          listStyle: "none",
          padding: 0,
        }}
      >
        {[
          "Renegociar UF 5.500 → UF 4.900",
          "Evaluar modo Airbnb (+$148K/mes vs arriendo)",
          "Recalcular con pie 30%",
        ].map((action) => (
          <li key={action} style={{ paddingLeft: 16, position: "relative" }}>
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                color: "#C8323C",
                fontWeight: 700,
              }}
            >
              ·
            </span>
            {action}
          </li>
        ))}
      </ul>
    </div>
  );
}
