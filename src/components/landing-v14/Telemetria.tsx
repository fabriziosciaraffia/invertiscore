"use client";

// Medición de la landing: `landing_viewed` al montar (con las UTM de la URL) y
// `landing_section_viewed{n}` la primera vez que cada sección entra en
// pantalla. Los `<section>` se identifican por `data-seccion="n"`.
//
// Numeración desde FASE 1.9 (11-sep-2026, la landing v14 todavía no está en
// producción, así que no hay histórico que preservar): 1 hero · 2 la respuesta ·
// 3 lo que haría Franco · 4 por qué creerle · 5 cierre.
//
// `SeccionVista` además marca el elemento con `data-anim="listo"` (hay JS) y
// `data-visto` (entró en pantalla): la sección 3 usa esos atributos para
// arrancar la animación del mapa recién cuando se ve.

import { useEffect, useRef, type ReactNode } from "react";
import { usePostHog } from "posthog-js/react";
import { EV, utmDeUrl } from "./eventos";

export function LandingViewed() {
  const posthog = usePostHog();
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current || !posthog) return;
    hecho.current = true;
    posthog.capture(EV.viewed, { version: "v14", ...utmDeUrl() });
  }, [posthog]);
  return null;
}

export function SeccionVista({
  n,
  id,
  className,
  children,
}: {
  n: 1 | 2 | 3 | 4 | 5;
  id?: string;
  className: string;
  children: ReactNode;
}) {
  const posthog = usePostHog();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("data-anim", "listo");
    let visto = false;
    const obs = new IntersectionObserver(
      (es) => {
        if (!es[0]?.isIntersecting || visto) return;
        visto = true;
        el.setAttribute("data-visto", "1");
        posthog?.capture(EV.section, { n, version: "v14" });
        obs.disconnect();
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [n, posthog]);
  return (
    <section ref={ref} id={id} className={className} data-seccion={n}>
      {children}
    </section>
  );
}
