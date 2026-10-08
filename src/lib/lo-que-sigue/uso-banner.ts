// ─────────────────────────────────────────────────────────────────────────────
// EL BANNER EN USO (08-oct-2026). Mientras la persona usa el banner del registro, el ticket del pack no
// sube encima. La regla es una sola (tercera pasada): el banner está en uso durante 60 segundos desde la
// última actividad en él —escribir, tocar, el foco en el correo, abrir el paso del código—. Ningún estado
// lo retiene: hasta la tercera pasada el correo con foco y el paso del código abierto contaban como uso
// sin límite, y con el código pedido y sin completar el ticket no salía nunca, ni al final ni al salir
// por arriba. Los disparadores del ticket siguen contando y sale apenas pasa el minuto
// (`disparo-ticket.ts`, `enEspera`).
// Los componentes avisan cambios de estado (`correoConFoco`, `codigoAbierto`); acá solo cuenta como
// actividad el que se TOMA (foco, código abierto). Soltarlos no es actividad en el banner.
// Estado de módulo compartido entre BannerRegistro/RegistroUnPaso y TicketPack, sin React adentro; el
// reloj entra por parámetro para que el tier lo pruebe.
// ─────────────────────────────────────────────────────────────────────────────

export const QUIETUD_BANNER_MS = 60_000;

export function crearUsoBanner(ahora: () => number = () => Date.now()) {
  let ultima = Number.NEGATIVE_INFINITY;
  const marcar = () => {
    ultima = ahora();
  };
  return {
    /** Un toque, una tecla, un foco o algo escrito dentro del banner. */
    actividad: marcar,
    /** El correo tomó (true) o soltó (false) el foco: tomarlo es actividad. */
    correoConFoco(si: boolean) {
      if (si) marcar();
    },
    /** Se abrió (true) o se cerró (false) el paso del código: abrirlo es actividad. */
    codigoAbierto(si: boolean) {
      if (si) marcar();
    },
    enUso(): boolean {
      return ahora() - ultima < QUIETUD_BANNER_MS;
    },
  };
}

/** El del informe: uno por página. */
export const usoBanner = crearUsoBanner();
