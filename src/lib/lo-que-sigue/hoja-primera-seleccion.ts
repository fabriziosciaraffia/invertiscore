// ─────────────────────────────────────────────────────────────────────────────
// La hoja con la primera selección sobre el informe (20-oct-2026): se abre sola UNA vez por informe y pestaña. Puro sobre
// un almacén inyectable (sessionStorage en el navegador; el tier PRIMERA-SELECCION lo prueba con un shim).
// ─────────────────────────────────────────────────────────────────────────────
export const CLAVE_HOJA_VISTA = "franco_primera_seleccion_vista";

/** ¿Ya se abrió sola en esta pestaña para este informe? */
export function hojaYaVista(almacen: Pick<Storage, "getItem"> | null, analysisId: string): boolean {
  try {
    return almacen?.getItem(`${CLAVE_HOJA_VISTA}:${analysisId}`) === "1";
  } catch {
    return false;
  }
}

export function marcarHojaVista(almacen: Pick<Storage, "setItem"> | null, analysisId: string): void {
  try {
    almacen?.setItem(`${CLAVE_HOJA_VISTA}:${analysisId}`, "1");
  } catch {
    /* sin storage: se abre de nuevo al recargar, nada más */
  }
}
