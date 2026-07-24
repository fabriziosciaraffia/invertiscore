"use client";

// Emisión única de eventos del wizard v4 (FASE 6). TODOS los wizard4_* salen por
// acá.
//   · Producción: solo posthog.capture — cero window, cero console.
//   · Dev (guard NODE_ENV): además console.debug + push a window.__wizard4Events,
//     para verificar el funnel EN VIVO sin depender de NEXT_PUBLIC_POSTHOG_KEY
//     (en dev PostHog no se inicializa). El pase conjunto lee window.__wizard4Events
//     tras un recorrido real y valida evento por evento — patrón "en el cable" F5.

import type { PostHog } from "posthog-js";

export interface WizardTrackedEvent {
  name: string;
  props?: Record<string, unknown>;
  t: number;
}

declare global {
  interface Window {
    __wizard4Events?: WizardTrackedEvent[];
  }
}

export function trackWizard(
  posthog: PostHog | null | undefined,
  name: string,
  props?: Record<string, unknown>,
): void {
  posthog?.capture(name, props);
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.debug("[wizard4]", name, props ?? {});
    (window.__wizard4Events ??= []).push({ name, props, t: Date.now() });
  }
}
