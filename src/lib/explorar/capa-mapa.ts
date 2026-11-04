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
export const CAPA_MAPA_COPY = { grupo: "Vista del mapa", mapa: "Mapa", satelite: "Satélite" } as const;

type Almacen = Pick<Storage, "getItem" | "setItem">;

/** La vista elegida la última vez en este navegador (sin almacenamiento, el mapa). */
export function leerCapaMapa(almacen: Almacen | null): CapaMapa {
  try { return almacen?.getItem(CLAVE_CAPA_MAPA) === "satelite" ? "satelite" : "mapa"; } catch { return "mapa"; }
}
export function guardarCapaMapa(almacen: Almacen | null, capa: CapaMapa): void {
  try { almacen?.setItem(CLAVE_CAPA_MAPA, capa); } catch { /* sin almacenamiento, sin recordar */ }
}

/** Las opciones del mapa de Google para una vista y un tema: el mapa con el estilo de Franco de su tema, o la foto híbrida tal cual. */
export function opcionesDeCapa(capa: CapaMapa, claro: boolean): { mapTypeId: "roadmap" | "hybrid"; styles: ReturnType<typeof francoMapStyleForTheme> | null; backgroundColor: string } {
  if (capa === "satelite") return { mapTypeId: "hybrid", styles: null, backgroundColor: "#1a1a1a" };
  return claro ? { mapTypeId: "roadmap", styles: francoMapStyleForTheme("light"), backgroundColor: "#F6F6F7" } : { mapTypeId: "roadmap", styles: francoMapStyleForTheme("dark"), backgroundColor: "#1a1a1a" };
}
