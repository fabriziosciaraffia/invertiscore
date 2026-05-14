"use client";

import Reveal, { RevealItem } from "./Reveal";
import SectionHeader from "./SectionHeader";

/**
 * Sección 03 · Qué es Franco — posicionamiento como inteligencia
 * interpretativa antes de mostrar cómo funciona.
 *
 * Layout 2-cols:
 *   - Izquierda: copy con 4 bullets numerados (INTERPRETA / IDENTIFICA /
 *     PROPONE / VIGILA).
 *   - Derecha: caja Franco grande con cita italic + border-left Signal Red 4px.
 *
 * Header arriba (eyebrow rojo + H2 mask reveal + subhead).
 */

const BULLETS: Array<{ index: string; verb: string; rest: string }> = [
  {
    index: "01",
    verb: "INTERPRETA",
    rest: "tu caso con todos los gastos reales — no sólo el dividendo.",
  },
  {
    index: "02",
    verb: "IDENTIFICA",
    rest: "el problema concreto: precio, estructura del financiamiento o modalidad.",
  },
  {
    index: "03",
    verb: "PROPONE",
    rest: "alternativas: negociar, reestructurar, cambiar a Airbnb o buscar otra.",
  },
  {
    index: "04",
    verb: "VIGILA",
    rest: "los riesgos a largo plazo: vacancia, mantención mayor, cambios de tasa.",
  },
];

export default function SectionWhatFrancoIs() {
  return (
    <section
      id="que-es-franco"
      className="relative flex min-h-screen items-center"
    >
      <div className="mx-auto w-full max-w-[1280px] px-6 py-[14vh] md:py-[16vh]">
        <SectionHeader
          eyebrow="03 · Qué es Franco"
          title={"No es una calculadora.\nEs un asesor con IA."}
          subhead="Franco interpreta tu caso, identifica el problema real y propone alternativas concretas. No te entrega solo números — te dice qué hacer con ellos."
          className="max-w-[820px]"
        />

        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1fr_460px] md:gap-16">
          {/* Bullets */}
          <Reveal className="space-y-7" stagger={0.08} delay={0.1}>
            {BULLETS.map((b) => (
              <RevealItem
                key={b.index}
                className="grid grid-cols-[40px_1fr] gap-5 border-t pt-6"
                style={{ borderColor: "var(--landing-divider)" }}
              >
                <span
                  className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.16em",
                    paddingTop: 6,
                  }}
                >
                  {b.index}
                </span>
                <p
                  className="font-body leading-[1.45] text-[var(--landing-text)]"
                  style={{ fontSize: "clamp(18px, 2.1vw, 22px)" }}
                >
                  <span className="font-mono font-semibold uppercase text-[#C8323C]">
                    {b.verb}
                  </span>{" "}
                  {b.rest}
                </p>
              </RevealItem>
            ))}
          </Reveal>

          {/* Caja Franco grande */}
          <Reveal as="div" delay={0.2}>
            <RevealItem
              className="relative h-full rounded-2xl px-7 py-9 md:px-9 md:py-11"
              style={{
                borderLeft: "4px solid #C8323C",
                background: "var(--landing-card-bg-soft)",
                border: "0.5px solid var(--landing-card-border)",
                borderLeftWidth: 4,
                borderLeftColor: "#C8323C",
              }}
            >
              <p
                className="font-mono font-semibold uppercase text-[#C8323C]"
                style={{ fontSize: 11, letterSpacing: "0.14em" }}
              >
                Siendo franco
              </p>
              <p
                className="mt-5 font-body italic leading-[1.4] text-[var(--landing-text)]"
                style={{ fontSize: "clamp(22px, 2.6vw, 30px)" }}
              >
                &ldquo;Excelente ubicación al precio equivocado. Negocia hasta
                UF 4.900 y opera en Airbnb. Así el flujo se sostiene.&rdquo;
              </p>

              <div
                className="mt-9 border-t pt-6"
                style={{ borderColor: "var(--landing-divider)" }}
              >
                <p
                  className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
                  style={{ fontSize: 10, letterSpacing: "0.18em" }}
                >
                  Qué hace en este caso
                </p>
                <ul className="mt-3 space-y-2 font-body leading-[1.5] text-[var(--landing-text-secondary)]">
                  <li className="flex items-start gap-2.5" style={{ fontSize: 14 }}>
                    <span
                      aria-hidden="true"
                      className="mt-[7px] inline-block h-[5px] w-[5px] shrink-0 rounded-full bg-[#C8323C]"
                    />
                    Calcula el precio en que los números cierran.
                  </li>
                  <li className="flex items-start gap-2.5" style={{ fontSize: 14 }}>
                    <span
                      aria-hidden="true"
                      className="mt-[7px] inline-block h-[5px] w-[5px] shrink-0 rounded-full bg-[#C8323C]"
                    />
                    Estima qué pasa si cambias a Airbnb.
                  </li>
                  <li className="flex items-start gap-2.5" style={{ fontSize: 14 }}>
                    <span
                      aria-hidden="true"
                      className="mt-[7px] inline-block h-[5px] w-[5px] shrink-0 rounded-full bg-[#C8323C]"
                    />
                    Marca los riesgos antes de firmar 25 años.
                  </li>
                </ul>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
