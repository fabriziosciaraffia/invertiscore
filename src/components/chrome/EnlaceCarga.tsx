"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EnlaceCarga — el <Link> del sitio para lo que navega y puede tardar (28-sep-2026).
//
// Al tocarlo pasan dos cosas en el mismo instante: el elemento queda «presionado»
// (`data-presionado="1"`, estilo global en globals.css) y la barra fina bajo el header arranca
// (`iniciarCarga`). Solo con un clic normal (izquierdo, sin modificadores, sin target nuevo) y a
// una ruta interna: abrir en pestaña nueva no enciende nada. El estado presionado se suelta solo
// cuando la ruta cambió.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentProps, type MouseEvent } from "react";
import { iniciarCarga } from "@/lib/carga-global";

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
  const pathname = usePathname();
  const hrefTexto = typeof href === "string" ? href : href.pathname ?? "";

  // La ruta cambió: se suelta. (Si el componente sigue montado, como una pestaña del demo.)
  useEffect(() => { setPresionado(false); }, [pathname]);

  return (
    <Link
      href={href}
      target={target}
      data-presionado={presionado ? "1" : undefined}
      aria-busy={presionado || undefined}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (clicNavega(e, hrefTexto, target) && !(hrefTexto === pathname)) {
          setPresionado(true);
          iniciarCarga();
        }
      }}
      {...resto}
    >
      {children}
    </Link>
  );
}
