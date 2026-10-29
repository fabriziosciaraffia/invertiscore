"use client";

// Enlace que emite un evento de PostHog al click. Para "Ver un análisis de ejemplo"
// y "Ver planes →". Con href interno usa EnlaceCarga (28-sep-2026): el toque se ve
// presionado y la barra bajo el header arranca mientras la página llega. Lo demás que
// reciba (`aria-label`, `data-*`) va al enlace (29-oct-2026, el mapa del hero).

import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { usePostHog } from "@/lib/posthog-react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

export function LinkMedido({
  href,
  evento,
  props,
  className,
  children,
  ...resto
}: {
  href: string;
  evento: string;
  props?: Record<string, unknown>;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick" | "className" | "children">) {
  const posthog = usePostHog();
  const medir = () => posthog?.capture(evento, { version: "v14", ...props });
  if (href.startsWith("#")) {
    return <a href={href} className={className} onClick={medir} {...resto}>{children}</a>;
  }
  return <EnlaceCarga href={href} className={className} onClick={medir} {...resto}>{children}</EnlaceCarga>;
}
