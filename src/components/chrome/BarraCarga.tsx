"use client";

// La barra fina de progreso bajo el header, la misma en todo el sitio (28-sep-2026). Vive dentro
// de HeaderFranco. Se enciende con `iniciarCarga` (EnlaceCarga) y se apaga sola cuando la ruta que
// ve es distinta de la que arrancó la carga —también si la barra se acaba de montar en la ruta
// nueva, porque el header se remonta entre la landing y la app—; si la navegación nunca llega, un
// tope la apaga para no quedar girando. La ruta se compara con su query (los chips del dashboard
// cambian solo la query): por `useSearchParams`, va dentro de un <Suspense> en el header.

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { claveDeRuta, rutaCarga, terminarCarga, useCargaGlobal } from "@/lib/carga-global";

export const TOPE_CARGA_MS = 15_000;

export function BarraCarga() {
  const activa = useCargaGlobal();
  const pathname = usePathname();
  const busqueda = useSearchParams();
  const clave = claveDeRuta(pathname, busqueda.toString());

  // La ruta que se ve no es la de origen: lo que se estaba cargando ya llegó.
  useEffect(() => {
    if (activa && rutaCarga() !== clave) terminarCarga();
  }, [activa, clave]);

  // El tope: una navegación que nunca llega no deja la barra girando para siempre.
  useEffect(() => {
    if (!activa) return;
    const t = window.setTimeout(terminarCarga, TOPE_CARGA_MS);
    return () => window.clearTimeout(t);
  }, [activa]);

  return <div className="hf-barra" data-activa={activa ? "1" : "0"} aria-hidden="true" />;
}
