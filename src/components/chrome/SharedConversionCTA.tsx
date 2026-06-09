"use client";

/**
 * SharedConversionCTA — superficies de conversión para la vista compartida
 * pública (AMBAS / análisis compartidos). Dos piezas presentacionales, sin
 * lógica: el padre decide cuándo mostrarlas (gate guest / !printMode).
 *
 *   • ConversionHook   — franja compacta split (superficie Ink + botón rojo).
 *                        Va ARRIBA, como anzuelo después del header.
 *   • ConversionCloser — campo Signal Red pleno con heading Source Serif a
 *                        escala display + botón invertido. Va ABAJO, como cierre.
 *
 * Doctrina (franco-design-system): paleta binaria Ink + Signal Red. La energía
 * del cierre nace de INVERTIR figura/fondo (rojo como campo, texto blanco) y de
 * subir la escala tipográfica, no de agregar color. El hook usa rojo solo en el
 * botón (uso #1) sobre superficie Ink.
 *
 * Tokens --franco-* → responde a claro/oscuro. El campo rojo del Closer es
 * invariante entre modos (Signal Red no cambia); sus tintes claros derivan del
 * propio Signal Red (#FFD9DC), no son color nuevo.
 */

import Link from "next/link";

const RED_TINT = "#FFD9DC"; // tinte claro de Signal Red para texto sobre campo rojo

export function ConversionHook({ href = "/register" }: { href?: string }) {
  return (
    <div
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      style={{
        background: "var(--franco-card)",
        border: "1px solid var(--franco-border)",
        borderRadius: 12,
        padding: "18px 22px",
      }}
    >
      <div>
        <p
          className="font-mono uppercase"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.16em",
            color: "var(--signal-red)",
            margin: "0 0 6px 0",
          }}
        >
          Análisis de Franco
        </p>
        <p
          className="font-heading"
          style={{
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            color: "var(--franco-text)",
            margin: 0,
          }}
        >
          ¿Estás evaluando un depto para invertir?
        </p>
      </div>

      <Link
        href={href}
        className="inline-flex shrink-0 items-center justify-center gap-2 font-mono uppercase transition-opacity hover:opacity-90"
        style={{
          background: "var(--signal-red)",
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.04em",
          padding: "13px 20px",
          borderRadius: 6,
        }}
      >
        Analizar el mío →
      </Link>
    </div>
  );
}

export function ConversionCloser({ href = "/register" }: { href?: string }) {
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
      <Link
        href={href}
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
      </Link>
      <p
        className="font-body"
        style={{ fontSize: 12, color: RED_TINT, margin: "14px 0 0 0" }}
      >
        1 análisis gratis · sin tarjeta
      </p>
    </section>
  );
}
