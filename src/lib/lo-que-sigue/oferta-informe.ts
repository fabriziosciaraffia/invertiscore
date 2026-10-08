// ─────────────────────────────────────────────────────────────────────────────
// LA OFERTA ES DEL INFORME, NO DE LA SESIÓN (08-oct-2026). El pack queda disponible en el informe
// que nació anónimo hasta que venza o se compre, para su dueño: el anónimo con la cookie, el que
// vuelve sin sesión a su navegador de origen (después de registrarse o de un pago fallido) y el que
// entra con su cuenta. Hasta esa fecha banner y ticket colgaban de «dueño anónimo» o de una marca de
// 30 minutos en la pestaña, y un registro o un pago fallido los hacían desaparecer.
//
// En otro navegador, sin sesión, el enlace NO es del dueño (lo único que lo prueba es la cookie):
// ahí no hay oferta, o cualquiera con el enlace podría comprar y quedarse con el informe.
// Funciones puras: las prueba el tier OFERTA-TICKET.
// ─────────────────────────────────────────────────────────────────────────────

/** Quién mira el informe, si es su dueño. */
export type QuienMira = "anonimo" | "origen" | "sesion" | null;

export function quienMiraElInforme(p: { isAnonOwner: boolean; isOrigenNavegador: boolean; isOwner: boolean }): QuienMira {
  if (p.isOwner) return "sesion";
  if (p.isAnonOwner) return "anonimo";
  if (p.isOrigenNavegador) return "origen";
  return null;
}

/** El informe nació anónimo: sin reclamar (`anon_claim_token_hash`) o reclamado desde la cookie (`anon_origen_hash`). */
export function nacioAnonimo(fila: { anon_claim_token_hash?: string | null; anon_origen_hash?: string | null }): boolean {
  return !!fila.anon_claim_token_hash || !!fila.anon_origen_hash;
}

/** ¿Hay un pack PAGADO para el informe? Rechazado, anulado o pendiente no cuentan: la oferta sigue. */
export function hayPackPagado(pagos: ReadonlyArray<{ product: string | null; status: string | null }>): boolean {
  return pagos.some((p) => p.product === "pack3" && p.status === "paid");
}

/** ¿El ticket del pack va en este informe? La vigencia (24 h) la mira el ticket, que mide el vencido. */
export function ofertaPackDelInforme(p: { nacioAnonimo: boolean; quienMira: QuienMira; packPagado: boolean; esDemo: boolean }): boolean {
  return p.nacioAnonimo && p.quienMira !== null && !p.packPagado && !p.esDemo;
}

/** ¿Va el banner del registro? Al dueño sin sesión, o a quien acaba de entrar (queda en «Estás dentro»). */
export function bannerRegistroVisible(p: { quienMira: QuienMira; conSesion: boolean; recienDentro: boolean; compartido: boolean }): boolean {
  const duenoSinSesion = !p.conSesion && (p.quienMira === "anonimo" || p.quienMira === "origen");
  return duenoSinSesion || (p.recienDentro && !p.compartido);
}

/** El correo con que paga el ticket, si ya se sabe: el de quien acaba de entrar, o el de su cuenta. */
export function correoDelTicket(p: { recienDentro: string | null; correoConocido: string | null }): string | null {
  return p.recienDentro ?? p.correoConocido ?? null;
}
