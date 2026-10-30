"use client";

// EL TEMA EN VIVO (30-oct-2026): si la página está en oscuro AHORA, y que cambie al momento si la persona cambia el tema (el
// atributo `data-theme` de <html>, lib/theme.ts: «light» o ausente = oscuro). Lo usan las imágenes de mapas que el navegador
// pide (el mapa chico de la tarjeta y del pop-up): cada tema con su versión, guardada en caché aparte. Lo que dibuja el
// servidor no lo usa: va con las dos versiones y el CSS muestra la del tema (la otra, perezosa, no se baja).
import { useSyncExternalStore } from "react";

function suscribir(avisar: () => void): () => void {
  const o = new MutationObserver(avisar);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => o.disconnect();
}
const oscuroAhora = (): boolean => document.documentElement.getAttribute("data-theme") !== "light";

/** true con la página en oscuro; en el servidor, false (el tema por defecto es claro). */
export function useTemaOscuro(): boolean {
  return useSyncExternalStore(suscribir, oscuroAhora, () => false);
}
