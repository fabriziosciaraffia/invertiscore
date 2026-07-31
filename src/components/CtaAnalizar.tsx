"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CTA de entrada al wizard — un solo componente para las ~19 superficies
//
// Por qué componente y no solo una función: el evento de click necesita cliente,
// y cinco de los sitios que lo usan son Server Components (aprende, about,
// cobertura, comunas, comunas/[slug]). Con un helper suelto esos cinco quedaban
// sin poder emitir el evento y volvíamos a tener dos maneras de hacer lo mismo,
// que es exactamente el problema que este cambio cierra. Un Server Component sí
// puede renderizar un Client Component, así que el componente cubre las 19.
//
// El estilo lo pone cada sitio (`className` / `style`): los CTA de la landing
// tienen tratamientos propios y no es este el cambio para unificarlos. Lo que se
// unifica es el DESTINO, el TEXTO y la MEDICIÓN.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import type { CSSProperties, ReactNode } from "react";
import {
  EVENTO_CTA_ANALIZAR,
  hrefAnalizar,
  LABEL_ANALIZAR,
  type OrigenCTA,
} from "@/lib/cta-analizar";

export function CtaAnalizar({
  origen,
  comuna,
  children,
  className,
  style,
  ariaLabel,
}: {
  origen: OrigenCTA;
  /** Precarga la comuna en el wizard (páginas SEO por comuna). */
  comuna?: string;
  /** Contenido propio (flechas, spans decorativos). Por defecto, el texto único. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}) {
  const posthog = usePostHog();
  return (
    <Link
      href={hrefAnalizar(origen, { comuna })}
      aria-label={ariaLabel}
      className={className}
      style={style}
      onClick={() => {
        posthog?.capture(EVENTO_CTA_ANALIZAR, { origen, comuna: comuna ?? null });
      }}
    >
      {children ?? LABEL_ANALIZAR}
    </Link>
  );
}
