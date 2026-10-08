// ─────────────────────────────────────────────────────────────────────────────
// EL BANNER EN USO (08-oct-2026, segunda pasada). Mientras la persona usa el banner del registro, el
// ticket del pack no sube encima: con el correo con foco, con el paso del código abierto, o con
// actividad en el banner (toque, tecla, foco, escritura) en los últimos 60 segundos. Los disparadores
// del ticket siguen contando y el ticket sale apenas el banner pasa un minuto quieto
// (`disparo-ticket.ts`, `enEspera`).
// Estado de módulo compartido entre BannerRegistro/RegistroUnPaso y TicketPack, sin React adentro; el
// reloj entra por parámetro para que el tier lo pruebe.
// ─────────────────────────────────────────────────────────────────────────────

export const QUIETUD_BANNER_MS = 60_000;

export function crearUsoBanner(ahora: () => number = () => Date.now()) {
  let foco = false;
  let codigo = false;
  let ultima = Number.NEGATIVE_INFINITY;
  return {
    /** Un toque, una tecla, un foco o algo escrito dentro del banner. */
    actividad() {
      ultima = ahora();
    },
    // Dejar el correo o cerrar el paso del código es el último momento de uso: el minuto se cuenta desde
    // ahí, no desde la última tecla. Solo al soltar algo que estaba tomado (el desmontaje los suelta
    // siempre, y eso no alarga la espera).
    correoConFoco(si: boolean) {
      if (foco && !si) ultima = ahora();
      foco = si;
    },
    codigoAbierto(si: boolean) {
      if (codigo && !si) ultima = ahora();
      codigo = si;
    },
    enUso(): boolean {
      return foco || codigo || ahora() - ultima < QUIETUD_BANNER_MS;
    },
  };
}

/** El del informe: uno por página. */
export const usoBanner = crearUsoBanner();
