"use client";

// Enlace que emite un evento de PostHog al click. Para "Ver un análisis real →"
// (ancla a la sección 2) y "Ver planes →". Con href interno usa <Link>.

import Link from "next/link";
import { usePostHog } from "posthog-js/react";
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
  return <Link href={href} className={className} onClick={medir}>{children}</Link>;
}
