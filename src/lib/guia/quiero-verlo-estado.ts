// ─────────────────────────────────────────────────────────────────────────────
// El estado de envío de «Quiero verlo» (17-oct-2026, decisión de Fabrizio: es lo que la persona pagó y pasaba
// desapercibido). Puro: lo usa InformeDeAviso y lo prueba el tier GUIA-BUSQUEDA.
//   quieto → (toca) → enviando → listo (con el correo) · despublicado · error → (Reintentar) → enviando…
// Sin recargar la página: la respuesta de POST /api/lo-que-sigue/quiero-verlo decide el estado siguiente.
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoQuieroVerlo =
  | { tipo: "quieto" }
  | { tipo: "enviando" }
  | { tipo: "listo"; correo: string | null }
  | { tipo: "despublicado" }
  | { tipo: "error" };

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * El estado que deja la respuesta: 200 = listo (con el correo al que salió, si vino); 410 = el aviso ya no está
 * publicado; cualquier otra cosa —el correo no salió (502), no se pudo chequear la ficha (503), un error, sin red
 * (`null`)— es un error que se puede reintentar.
 */
export function estadoTrasRespuesta(r: { status: number; cuerpo: unknown } | null): EstadoQuieroVerlo {
  if (!r) return { tipo: "error" };
  if (r.status === 410) return { tipo: "despublicado" };
  if (r.status < 200 || r.status >= 300) return { tipo: "error" };
  const correo = (r.cuerpo as { correo?: unknown } | null)?.correo;
  return { tipo: "listo", correo: typeof correo === "string" && CORREO.test(correo) ? correo : null };
}

/** ¿El botón hace algo? Antes de mandar y después de un error (Reintentar); no mientras manda ni después. */
export function sePuedeTocar(e: EstadoQuieroVerlo): boolean {
  return e.tipo === "quieto" || e.tipo === "error";
}

/** «Este depto conviene con tus números» solo con COMPRAR: el banner no afirma lo que el informe no dice. */
export function dicesQueConviene(veredicto: string | null | undefined): boolean {
  return veredicto === "COMPRAR";
}
