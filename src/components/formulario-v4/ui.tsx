"use client";

// Primitivos de UI del wizard v4, con el formato del informe (entrega 2, 27-sep-2026).
// Mockup aprobado: docs/wireframes/rediseno-informe/wizard-v4-actualizado.html; las clases viven
// en `wizard-v4.css`. Inter, tarjetas grises sobre la página, selección en tinta. EL ÚNICO ROJO
// ES EL BOTÓN DE AVANZAR (`PrimaryBtn`), el mismo en todas las pantallas, a todo el ancho.

import type { ReactNode } from "react";
import { Glosa } from "@/components/analysis/shared/Glosa";

/** El botón de avanzar: píldora roja a todo el ancho. Deshabilitado pasa a gris, no a rojo
 *  fantasma: se lee «falta completar», no «roto». */
export function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="wz-cta">
      {children}
    </button>
  );
}

/** El mismo botón en la barra fija de abajo: para las pantallas más largas que el teléfono
 *  (la tarifa, el pie con «otra fuente») y el resumen. Mismo ancho, mismo rojo. */
export function BarraCta({ children }: { children: ReactNode }) {
  return <div className="wz-barra-cta">{children}</div>;
}

/** La reacción de Franco: una tarjeta gris, sin rótulo rojo ni cursiva. */
export function FrancoReaction({ children }: { children: ReactNode }) {
  return <div className="wz-reac wizard4-reaction">{children}</div>;
}

/** La acción secundaria: texto en tinta con subrayado, centrado bajo el botón. */
export function LinkBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <div className="wz-lnk-fila">
      <button type="button" onClick={onClick} className="wz-lnk">
        {children}
      </button>
    </div>
  );
}

/** Tarjeta seleccionable (una opción por fila). Elegida = tinta invertida.
 *  `ariaLabel`: nombre accesible explícito cuando el contenido es rico. */
export function ChoiceTile({
  children,
  selected,
  onClick,
  accent,
  ariaLabel,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick: () => void;
  /** Borde de tinta (destacada, NO preseleccionada): el subsidio. Nunca rojo. */
  accent?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={!!selected}
      className={`wz-tile${accent ? " wz-acento" : ""}`}
    >
      {children}
    </button>
  );
}

/** El contenido habitual de una tarjeta: rótulo chico opcional, título y bajada. */
export function TileTexto({ t, s, eb }: { t: ReactNode; s?: ReactNode; eb?: ReactNode }) {
  return (
    <>
      {eb && <span className="wz-eb">{eb}</span>}
      <span className="wz-t">{t}</span>
      {s && <span className="wz-s">{s}</span>}
    </>
  );
}

/** Control segmentado en píldora (unidad del pie, UF/$, sí/no). `lleno` = a todo el ancho. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  lleno,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (v: T) => void;
  lleno?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className={`wz-seg${lleno ? " lleno" : ""}`} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Rótulo de campo con el ⓘ del informe (`Glosa`: hoja chica en el teléfono, popover arriba). */
export function FieldLabel({ children, tooltip, htmlFor }: { children: ReactNode; tooltip?: string; htmlFor?: string }) {
  return (
    <div className="wz-rot">
      {htmlFor ? <label htmlFor={htmlFor}>{children}</label> : <span>{children}</span>}
      {tooltip && <Glosa titulo={typeof children === "string" ? children : "Qué es"} texto={tooltip} />}
    </div>
  );
}

/** Línea de fuente/procedencia bajo una estimación. Como oración: mayúscula inicial y punto final
 *  (varias procedencias, como la del arriendo, se arman en minúscula para ir dentro de otra frase). */
export function FuenteLine({ children }: { children: ReactNode }) {
  const texto =
    typeof children === "string" && children.length > 0
      ? children.charAt(0).toUpperCase() + children.slice(1) + (/[.!?…)]$/.test(children) ? "" : ".")
      : children;
  return <p className="wz-fuente">{texto}</p>;
}
