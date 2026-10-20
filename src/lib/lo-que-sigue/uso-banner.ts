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
// EL REGISTRO COMPLETADO Y LA HOJA (20-oct-2026, Fabrizio): con el código el minuto se anula —desde «Estás dentro»
// el ticket sale a los 8 s de pasar «Tu resultado a 10 años», como siempre (`entro`; lo que se toque en «Estás
// dentro» no vuelve a armarlo, BannerRegistro)—; y mientras la hoja con la primera selección está abierta el ticket
// espera a que se cierre (`hojaAbierta`), para no taparla. Hasta hoy el ticket esperaba el minuto desde «Entrar» y,
// con la hoja abierta, le subía encima. Lo fija el tier PRIMERA-SELECCION §13.
// ─────────────────────────────────────────────────────────────────────────────

export const QUIETUD_BANNER_MS = 60_000;

export function crearUsoBanner(ahora: () => number = () => Date.now()) {
  let ultima = Number.NEGATIVE_INFINITY;
  let hoja = false;
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
    /** Entró con el código: el banner deja de estar en uso en el acto, sin esperar el minuto. */
    entro() {
      ultima = Number.NEGATIVE_INFINITY;
    },
    /** La hoja con la primera selección se abrió (true) o se cerró (false): abierta, el ticket espera. */
    hojaAbierta(si: boolean) {
      hoja = si;
    },
    /** ¿La hoja está abierta? Para el diagnóstico de `?lqs=1`. */
    conHoja(): boolean {
      return hoja;
    },
    enUso(): boolean {
      return hoja || ahora() - ultima < QUIETUD_BANNER_MS;
    },
    /** Cuánto le falta para liberarse (0 si está libre): para el diagnóstico de `?lqs=1`. */
    libreEnMs(): number {
      return Math.max(0, ultima + QUIETUD_BANNER_MS - ahora());
    },
  };
}

/** El del informe: uno por página. */
export const usoBanner = crearUsoBanner();
