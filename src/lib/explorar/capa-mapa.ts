// ─────────────────────────────────────────────────────────────────────────────
// LA VISTA SATELITAL DE EXPLORAR (04-nov-2026, la pasada de Fabrizio): un botón de dos posiciones sobre el mapa, junto al zoom,
// «Mapa | Satélite», con el estilo de las opciones de la casa. En satélite, la vista HÍBRIDA de Google (foto aérea con los nombres de
// calles y comunas) SIN el estilo de Franco: ese estilo tiñe los nombres y, en oscuro, los apaga sobre la foto; la foto va igual en
// los dos temas, sin filtro. Los pines no cambian: sus colores y su anillo blanco se leen sobre la foto. La elección se recuerda en
// el navegador (localStorage), con y sin sesión. Cambiar de vista NO es otra carga del mapa: es el mismo mapa con otro tipo (el
// costo de Google es por carga de mapa dinámico, sea cual sea su tipo). Puro: sin Google ni React.
// ─────────────────────────────────────────────────────────────────────────────
import { francoMapStyleForTheme } from "@/lib/map-styles";

export type CapaMapa = "mapa" | "satelite";
export const CAPAS_MAPA: readonly CapaMapa[] = ["mapa", "satelite"];
export const CLAVE_CAPA_MAPA = "franco_explorar_capa";
export const CAPA_MAPA_COPY = { grupo: "Vista del mapa", mapa: "Mapa", satelite: "Satélite", boton: "Tipo de mapa" } as const;

type Almacen = Pick<Storage, "getItem" | "setItem">;

/** La vista elegida la última vez en este navegador (sin almacenamiento, el mapa). */
export function leerCapaMapa(almacen: Almacen | null): CapaMapa {
  try { return almacen?.getItem(CLAVE_CAPA_MAPA) === "satelite" ? "satelite" : "mapa"; } catch { return "mapa"; }
}
export function guardarCapaMapa(almacen: Almacen | null, capa: CapaMapa): void {
  try { almacen?.setItem(CLAVE_CAPA_MAPA, capa); } catch { /* sin almacenamiento, sin recordar */ }
}

/** SIN LOS NOMBRES DE LOCALIDAD DE GOOGLE en el mapa de Explorar (26-nov-2026, entrega 2 › B): la capa de comunas dice esos nombres con
 *  la letra de Franco y en un lugar libre de pines, y Google los repetía al lado («Pudahuel PUDAHUEL»). Los barrios y las calles de
 *  Google siguen. Solo en el mapa: la foto satelital va tal cual (decisión del 04-nov). */
export const SIN_LOCALIDADES_GOOGLE = { featureType: "administrative.locality", elementType: "labels", stylers: [{ visibility: "off" }] };

type EstiloMapa = ReturnType<typeof francoMapStyleForTheme>[number] | typeof SIN_LOCALIDADES_GOOGLE;

/** Las opciones del mapa de Google para una vista y un tema: el mapa con el estilo de Franco de su tema, o la foto híbrida tal cual. */
export function opcionesDeCapa(capa: CapaMapa, claro: boolean): { mapTypeId: "roadmap" | "hybrid"; styles: EstiloMapa[] | null; backgroundColor: string } {
  if (capa === "satelite") return { mapTypeId: "hybrid", styles: null, backgroundColor: "#1a1a1a" };
  return claro
    ? { mapTypeId: "roadmap", styles: [...francoMapStyleForTheme("light"), SIN_LOCALIDADES_GOOGLE], backgroundColor: "#F6F6F7" }
    : { mapTypeId: "roadmap", styles: [...francoMapStyleForTheme("dark"), SIN_LOCALIDADES_GOOGLE], backgroundColor: "#1a1a1a" };
}
