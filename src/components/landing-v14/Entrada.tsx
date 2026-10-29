"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La entrada desde la landing: el hero y el campo del cierre (27-sep-2026).
//
// UNA PUERTA, DOS ACCESOS. El hero es `HeroEntrada`, el mismo componente que la primera
// pantalla del wizard, y el campo del cierre es su `CampoEntrada`. Lo único propio de la
// landing es qué pasa con la respuesta: en vez de guardarla y avanzar, navega al wizard con
// ella (`urlDeLlegada`, la otra mitad de lo que el wizard lee en `llegada.ts`). La cobertura
// la decide el wizard: con la dirección cubierta arranca en el mapa; fuera de cobertura, en su
// portada con el aviso y la lista de espera. La landing no duplica esa lógica.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "@/lib/posthog-react";
import { CampoEntrada, type CaminoSinDireccion, type EventoCampo } from "@/components/entrada/HeroEntrada";
import type { SeleccionDireccion } from "@/components/entrada/useDireccionPlaces";
import { urlDeLlegada } from "@/components/entrada/llegada";
import { HERO_MAPA } from "@/lib/explorar/puertas-landing";
import { EV, type UbicacionCampo } from "./eventos";

const ORIGEN: Record<UbicacionCampo, string> = {
  hero: "landing_hero",
  cierre: "landing_cta_final",
  metodologia: "metodologia_cta",
};

/** Lo que hace la landing con la respuesta del campo, esté donde esté.
 *
 *  ELEGIR ES LA ACCIÓN (QA en el iPhone, 28-sep-2026): elegir una sugerencia —o tomar un camino
 *  sin dirección— navega al wizard, a «¿Dónde queda exactamente?», sin volver al hero ni pedir la
 *  flecha. Mientras la página cambia, el campo queda ocupado y la hoja abierta con su estado de
 *  espera (`ocupado` + `mantenerHojaAlEntregar`), como en la portada del wizard. */
function useAccionesCampo(ubicacion: UbicacionCampo) {
  const router = useRouter();
  const posthog = usePostHog();
  const origen = ORIGEN[ubicacion];
  const [navegando, setNavegando] = useState<CaminoSinDireccion | "escribir" | null>(null);
  return {
    ocupado: navegando,
    mantenerHojaAlEntregar: true,
    onDireccion: (sel: SeleccionDireccion) => {
      posthog?.capture(EV.direccionElegida, { ubicacion, via: sel.via, precision: sel.precision, cubierta: sel.cubierta });
      setNavegando("escribir");
      router.push(urlDeLlegada(sel, origen));
    },
    onCamino: (modo: CaminoSinDireccion) => {
      posthog?.capture(EV.sinDireccion, { modo, ubicacion });
      setNavegando(modo);
      router.push(urlDeLlegada({ modo }, origen));
    },
    onEvento: (e: EventoCampo) => {
      if (e.tipo === "foco") posthog?.capture(EV.ctaFocus, { ubicacion });
    },
  };
}

/** EL CAMPO DEL HERO (29-oct-2026). El hero ya no es el de la entrada: es el de las dos puertas (HeroMapa, un componente de
 *  servidor; desde el 30-oct-2026 el limpio de 7c-landing-limpia, sin mapa), y este es el campo de su segunda puerta. El MISMO campo de siempre, con su animación que escribe sola una dirección de ejemplo; lo único
 *  propio es que «¿No tienes la dirección?» aparece al tocarlo (la hoja en el teléfono, bajo el campo en el escritorio) y que
 *  el camino del mapa se llama «Ubícalo tú en el mapa», para no confundirlo con el mapa de Explorar. */
export function CampoHero() {
  const acciones = useAccionesCampo("hero");
  return <CampoEntrada caminosAlEnfocar textoMapa={HERO_MAPA.ubicarEnMapa} {...acciones} />;
}

/** El campo del cierre (y el del interior): el del hero, extraído. */
export function CampoLanding({ ubicacion }: { ubicacion: Exclude<UbicacionCampo, "hero"> }) {
  const acciones = useAccionesCampo(ubicacion);
  return <CampoEntrada placeholderDesde={ubicacion === "cierre" ? 2 : 3} {...acciones} />;
}
