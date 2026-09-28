"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EnlaceCarga — el <Link> del sitio para lo que navega y puede tardar (28-sep-2026).
//
// Al tocarlo pasan dos cosas en el mismo instante: el elemento queda «presionado»
// (`data-presionado="1"`, estilo global en globals.css) y la barra fina bajo el header arranca
// (`iniciarCarga`). Solo con un clic normal (izquierdo, sin modificadores, sin target nuevo) y a
// una ruta interna distinta de la actual (query incluida, hash no: los chips del dashboard
// navegan a la misma ruta con otra query): abrir en pestaña nueva no enciende nada. El estado
// presionado se suelta cuando la carga global termina (la ruta llegó, o el tope).
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useEffect, useState, type ComponentProps, type MouseEvent } from "react";
import { claveActual, claveDeHref, iniciarCarga, useCargaGlobal } from "@/lib/carga-global";

type Props = ComponentProps<typeof Link>;

/** ¿Este clic va a navegar en esta pestaña? (decisión pura, testeable) */
export function clicNavega(e: { button?: number; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; defaultPrevented?: boolean }, href: string, target?: string): boolean {
  if (e.defaultPrevented) return false;
  if ((e.button ?? 0) !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (target && target !== "_self") return false;
  return href.startsWith("/") && !href.startsWith("//");
}

export function EnlaceCarga({ href, onClick, target, children, ...resto }: Props) {
  const [presionado, setPresionado] = useState(false);
  const cargando = useCargaGlobal();
  const hrefTexto = typeof href === "string" ? href : `${href.pathname ?? ""}${typeof href.search === "string" ? href.search : ""}`;

  // La carga terminó (la ruta llegó, o el tope): se suelta. (Si el componente sigue montado, como
  // una pestaña del demo o un chip del dashboard.)
  useEffect(() => { if (!cargando) setPresionado(false); }, [cargando]);

  return (
    <Link
      href={href}
      target={target}
      data-presionado={presionado ? "1" : undefined}
      aria-busy={presionado || undefined}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (clicNavega(e, hrefTexto, target) && claveDeHref(hrefTexto) !== claveActual()) {
          setPresionado(true);
          iniciarCarga(claveActual());
        }
      }}
      {...resto}
    >
      {children}
    </Link>
  );
}
