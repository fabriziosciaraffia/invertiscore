"use client";

// `posthog-js/react` importa `posthog-js` entero de forma estática, así que usarlo deshacía la carga
// diferida (28-sep-2026). Este contexto hace lo único que el sitio usaba de esa librería: entregar
// el cliente con `usePostHog()`. El cliente es la fachada de `posthog-cliente.ts`.

import { createContext, useContext, type ReactNode } from "react";
import type { PostHog } from "posthog-js";

const Contexto = createContext<PostHog | undefined>(undefined);

export function PostHogProvider({ client, children }: { client: PostHog; children: ReactNode }) {
  return <Contexto.Provider value={client}>{children}</Contexto.Provider>;
}

/** El cliente de PostHog (fachada o SDK). Fuera del provider devuelve `undefined`, como la librería. */
export function usePostHog(): PostHog {
  return useContext(Contexto) as PostHog;
}
