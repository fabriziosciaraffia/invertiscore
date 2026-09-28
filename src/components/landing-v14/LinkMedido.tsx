"use client";

// Enlace que emite un evento de PostHog al click. Para "Ver un análisis real →"
// y "Ver planes →". Con href interno usa EnlaceCarga (28-sep-2026): el toque se ve
// presionado y la barra bajo el header arranca mientras la página llega.

import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { usePostHog } from "@/lib/posthog-react";
import type { ReactNode } from "react";

export function LinkMedido({
  href,
  evento,
  props,
  className,
  children,
}: {
  href: string;
  evento: string;
  props?: Record<string, unknown>;
  className?: string;
  children: ReactNode;
}) {
  const posthog = usePostHog();
  const medir = () => posthog?.capture(evento, { version: "v14", ...props });
  if (href.startsWith("#")) {
    return <a href={href} className={className} onClick={medir}>{children}</a>;
  }
  return <EnlaceCarga href={href} className={className} onClick={medir}>{children}</EnlaceCarga>;
}
