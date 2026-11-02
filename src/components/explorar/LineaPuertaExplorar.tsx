"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La puerta a Explorar en las pantallas (02-nov-2026, lib/explorar/puerta-correos.ts): bajo la selección de «Estás dentro» y
// del dashboard, en texto discreto, la misma línea de los correos —«Estos son N de los 6.695 deptos que convienen hoy en Gran
// Santiago. Míralos todos en el mapa»— con el enlace a /explorar abierto con los filtros del perfil. El clic se mide acá
// (`explorar_enlace_clic`, canal «pantalla»), aparte de los deptos. Sin línea (sin el número de la noche), nada.
// ─────────────────────────────────────────────────────────────────────────────
import { usePostHog } from "@/lib/posthog-react";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { EVENTO_PUERTA_EXPLORAR, hrefPuertaPantalla, PUERTA_EXPLORAR, propsPuertaExplorar, type PantallaConPuerta } from "@/lib/explorar/puerta-correos";
import "./linea-puerta.css";

export function LineaPuertaExplorar({ linea, consulta, donde }: {
  /** lineaConvienen(N, el número único de la noche); null = no va. */
  linea: string | null;
  /** consultaExplorar(perfil): los filtros del perfil en la URL de /explorar. */
  consulta: string;
  donde: PantallaConPuerta;
}) {
  const posthog = usePostHog();
  if (!linea) return null;
  return (
    <p className="puerta-explorar" data-puerta-explorar={donde}>
      {linea}{" "}
      <EnlaceCarga
        href={hrefPuertaPantalla(consulta)}
        onClick={() => posthog?.capture(EVENTO_PUERTA_EXPLORAR, propsPuertaExplorar("pantalla", donde, { global: !consulta }))}
        data-puerta-explorar="enlace"
      >
        {PUERTA_EXPLORAR.enlace}
      </EnlaceCarga>
    </p>
  );
}
