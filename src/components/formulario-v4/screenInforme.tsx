"use client";

// Wizard v4 — EL INFORME (primera pantalla). Selección de producto: qué informe
// entrega Franco. Copy en lenguaje de beneficio (brand-voice), no de feature.
// Tres cards, ninguna preseleccionada, comparativo destacado (borde Signal Red),
// sin precio por card (el crédito se ve una sola vez, en el botón de generar).

import type { ScreenProps } from "./screensActo1";
import type { Modalidad } from "./wizardV4Nodes";

const OPCIONES: Array<{
  value: Modalidad;
  nombre: string;
  beneficio: string;
  accent?: boolean;
}> = [
  {
    value: "ltr",
    nombre: "Renta larga",
    beneficio:
      "El arriendo tradicional, mes a mes. Te digo si cubre la cuota, cuánto sale de tu bolsillo y cuánto patrimonio construyes con los años.",
  },
  {
    value: "str",
    nombre: "Renta corta",
    beneficio:
      "Airbnb y similares. Te digo cuánto puede rendir por noche, qué ocupación necesita para funcionar y desde cuándo empieza a convenir.",
  },
  {
    value: "both",
    nombre: "Comparativo",
    beneficio:
      "¿No sabes cuál te conviene? Franco calcula las dos y te da un solo veredicto: cuál gana para este depto, y por cuánto.",
    accent: true,
  },
];

export function InformeScreen({ answers, answer }: ScreenProps) {
  return (
    <div className="flex flex-col gap-3">
      {OPCIONES.map((o) => {
        const selected = answers.modalidad === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => answer("mod", { modalidad: o.value })}
            aria-label={`${o.nombre}. ${o.beneficio}`}
            aria-pressed={selected}
            className={`franco-tile-target text-left rounded-xl px-5 py-4 w-full transition-colors ${
              selected
                ? "bg-[var(--franco-text)] border-[1.5px] border-[var(--franco-text)]"
                : o.accent
                  ? "bg-[var(--franco-card)] border-[1.5px] border-signal-red"
                  : "bg-[var(--franco-card)] border-[0.5px] border-[var(--franco-border)]"
            }`}
          >
            <span
              className={`block font-heading text-[18px] font-bold leading-tight ${
                selected ? "text-[var(--franco-bg)]" : "text-[var(--franco-text)]"
              }`}
            >
              {o.nombre}
            </span>
            <span
              className={`block font-body text-[13px] mt-1 leading-relaxed ${
                selected ? "text-[var(--franco-bg)]/80" : "text-[var(--franco-text-secondary)]"
              }`}
            >
              {o.beneficio}
            </span>
          </button>
        );
      })}
    </div>
  );
}
