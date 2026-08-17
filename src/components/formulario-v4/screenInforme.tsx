"use client";

// Wizard v4 — EL INFORME (primera pantalla). Selección de producto: qué informe
// entrega Franco. Copy en lenguaje de beneficio (brand-voice), no de feature.
// Variante B (elegida): numeración editorial 01/02/03, títulos serif grandes,
// elegido = wash Signal Red sutil + borde fuerte. Injerto de C: el comparativo
// lleva eyebrow Signal Red "Si no sabes, empieza aquí".
//
// ⚠️ DISCIPLINA DEL ROJO: el wash rojo de selección es EXCLUSIVO de esta pantalla
// (momento-producto / selección de informe). En el resto del wizard, la selección
// se resuelve en Ink (tile invertido). No propagar este wash por imitación.

import { useEffect, useRef } from "react";
import type { ScreenProps } from "./screensActo1";
import type { Modalidad } from "./wizardV4Nodes";
import { rangoViewportH, registrarSondaSalida } from "./stepTelemetry";

const OPCIONES: Array<{
  value: Modalidad;
  n: string;
  nombre: string;
  beneficio: string;
  accent?: boolean;
  eyebrow?: string;
}> = [
  {
    value: "ltr",
    n: "01",
    nombre: "Renta larga",
    beneficio:
      "El arriendo tradicional, mes a mes. Te digo si cubre la cuota, cuánto sale de tu bolsillo y cuánto patrimonio construyes con los años.",
  },
  {
    value: "str",
    n: "02",
    nombre: "Renta corta",
    beneficio:
      "Airbnb y similares. Te digo cuánto puede rendir por noche, qué ocupación necesita para funcionar y desde cuándo empieza a convenir.",
  },
  {
    value: "both",
    n: "03",
    nombre: "Comparativo",
    beneficio: "Franco calcula las dos y te da un solo veredicto: cuál gana para este depto, y por cuánto.",
    accent: true,
    eyebrow: "Si no sabes, empieza aquí",
  },
];

export function InformeScreen({ answers, answer }: ScreenProps) {
  // Sonda de `mod` (I-2). La pantalla donde más se cae (59% en tráfico pagado):
  // la pregunta que responde es si el usuario VIO las tres opciones. Con el CTA
  // de la tercera bajo el fold en pantallas chicas, "no scrolleó y no eligió"
  // se ve distinto que "vio las tres y se fue". Emite al DESMONTAR (el
  // contenedor lleva key={node}, así que salir del paso desmonta) — un evento
  // por visita, con lo que pasó en ella.
  const clicks = useRef(0);
  const scrolleo = useRef(false);
  // La selección se anota EN EL CLICK, no vía efecto: elegir una opción navega
  // de inmediato y la pantalla se desmonta sin llegar a re-renderizar, así que
  // un efecto de sincronización nunca vería el valor (salía "ninguna").
  const seleccionRef = useRef<string | undefined>(answers.modalidad);
  useEffect(() => {
    const onScroll = () => { scrolleo.current = true; };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  registrarSondaSalida("mod", () => ({
    name: "wizard4_mod_interaccion",
    props: {
      seleccion: seleccionRef.current ?? "ninguna",
      // Por VISITA al paso: cada opción navega al tocarla, así que acá es 0 ó 1.
      n_cambios: clicks.current,
      hubo_scroll: scrolleo.current,
      viewport_h_rango: rangoViewportH(typeof window === "undefined" ? 0 : window.innerHeight),
    },
  }));

  return (
    <div className="flex flex-col gap-3">
      {OPCIONES.map((o) => {
        const selected = answers.modalidad === o.value;
        const cls = selected
          ? "border-[1.5px] border-signal-red"
          : `franco-tile-target bg-[var(--franco-card)] ${
              o.accent ? "border-[1px] border-signal-red/40" : "border-[0.5px] border-[var(--franco-border)]"
            }`;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              clicks.current += 1;
              seleccionRef.current = o.value;
              answer("mod", { modalidad: o.value });
            }}
            aria-label={`${o.eyebrow ? o.eyebrow + ". " : ""}${o.nombre}. ${o.beneficio}`}
            aria-pressed={selected}
            className={`text-left rounded-2xl shadow-sm p-5 w-full transition-colors ${cls}`}
            style={
              selected ? { background: "color-mix(in srgb, var(--signal-red) 7%, var(--franco-card))" } : undefined
            }
          >
            <div
              className={`font-mono text-[12px] mb-2 ${
                selected || o.accent ? "text-signal-red" : "text-[var(--franco-text-muted)]"
              }`}
            >
              {o.n}
            </div>
            {o.eyebrow && (
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal-red block mb-1">
                {o.eyebrow}
              </span>
            )}
            <h3 className="wizard4-informe-cardtitle font-heading text-[24px] font-bold text-[var(--franco-text)] m-0 leading-tight">
              {o.nombre}
            </h3>
            <p className="font-body text-[13px] text-[var(--franco-text-secondary)] mt-1.5 mb-0 leading-relaxed">
              {o.beneficio}
            </p>
          </button>
        );
      })}
    </div>
  );
}
