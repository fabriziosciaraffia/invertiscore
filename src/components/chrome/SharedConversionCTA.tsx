"use client";

/**
 * SharedConversionCTA — la superficie de conversión de la vista compartida
 * pública (AMBAS / análisis compartidos). Presentacional, sin lógica: el padre
 * decide cuándo mostrarla (gate guest).
 *
 *   • ConversionCloser — campo Signal Red pleno con heading Source Serif a
 *                        escala display + botón invertido. Va ABAJO, como cierre.
 *
 * La franja de ARRIBA (`ConversionHook`) se retiró el 27-sep-2026: su botón pasó al
 * header único («Analizar el mío»), que es el principal de la pantalla.
 *
 * Doctrina (franco-design-system): paleta binaria Ink + Signal Red. La energía
 * del cierre nace de INVERTIR figura/fondo (rojo como campo, texto blanco) y de
 * subir la escala tipográfica, no de agregar color.
 *
 * Tokens --franco-* → responde a claro/oscuro. El campo rojo del Closer es
 * invariante entre modos (Signal Red no cambia); sus tintes claros derivan del
 * propio Signal Red (#FFD9DC), no son color nuevo.
 */

import { CtaAnalizar } from "@/components/CtaAnalizar";
import type { OrigenCTA } from "@/lib/cta-analizar";

const RED_TINT = "#FFD9DC"; // tinte claro de Signal Red para texto sobre campo rojo

export function ConversionCloser({ origen = "resultado_cierre" }: { origen?: OrigenCTA }) {
  return (
    <section
      className="rounded-2xl px-7 py-12 text-center sm:py-[52px]"
      style={{ background: "var(--signal-red)" }}
    >
      <p
        className="font-mono uppercase"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: RED_TINT,
          margin: "0 0 14px 0",
        }}
      >
        Tu turno
      </p>
      <h2
        className="font-heading"
        style={{
          fontSize: "clamp(28px, 4.4vw, 42px)",
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          color: "#FFFFFF",
          maxWidth: 560,
          margin: "0 auto 14px auto",
        }}
      >
        Franco analiza tu depto y te dice si conviene comprar
      </h2>
      <p
        className="font-body"
        style={{
          fontSize: 15,
          lineHeight: 1.5,
          color: RED_TINT,
          maxWidth: 460,
          margin: "0 auto 28px auto",
        }}
      >
        Datos reales del mercado, sin conflictos de interés. Veredicto en menos de un minuto.
      </p>
      <CtaAnalizar
        origen={origen}
        className="group inline-flex items-center gap-2 font-mono uppercase transition-transform duration-150 hover:scale-[1.02]"
        style={{
          background: "#FFFFFF",
          color: "var(--signal-red)",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.04em",
          padding: "16px 28px",
          borderRadius: 6,
          boxShadow: "0 4px 24px rgba(0,0,0,0.28)",
        }}
      >
        Crear tu propio análisis
        <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
          →
        </span>
      </CtaAnalizar>
      <p
        className="font-body"
        style={{ fontSize: 12, color: RED_TINT, margin: "14px 0 0 0" }}
      >
        1 análisis gratis · sin tarjeta
      </p>
    </section>
  );
}
