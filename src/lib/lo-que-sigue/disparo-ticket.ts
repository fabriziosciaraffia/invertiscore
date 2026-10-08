// ─────────────────────────────────────────────────────────────────────────────
// CUÁNDO SUBE EL TICKET (08-oct-2026). Hasta esa fecha subía apenas se veía el final de la página.
// Ahora, lo primero que pase de:
//   · FINAL: la marca justo después de los capítulos —el último es «Tu resultado a 10 años»— entra
//     en pantalla, y 8 segundos después sube (aunque en esos 8 s siga bajando o suba un poco);
//   · LECTURA: 4 minutos de lectura activa: pestaña visible y alguna actividad (scroll, mouse,
//     teclado, toque) en los últimos 30 segundos;
//   · SALIDA (solo PC con mouse): el cursor deja la página por arriba, hacia las pestañas o la barra
//     de direcciones. Es lo que se puede detectar de «intentar cerrar la pestaña»: el navegador no deja
//     mostrar nada propio al cerrar.
// Una sola vez por informe en cada navegador (`puedeSubir` lee el estado de localStorage).
// SEGUNDA PASADA (08-oct-2026):
//   · con el banner del registro en uso (`enEspera`, ver `uso-banner.ts`) no sube: el disparo queda
//     pendiente, los demás siguen contando, y sale en el primer tick con el banner quieto;
//   · la salida por arriba solo cuenta si ya pasó la recomendación de Franco (la marca
//     `FinRecomendacion`) o lleva 60 s de lectura activa.
// El reloj entra por parámetro: el tier lo prueba con uno de mentira.
// ─────────────────────────────────────────────────────────────────────────────

export const ESPERA_FINAL_MS = 8_000;
export const LECTURA_ACTIVA_MS = 4 * 60_000;
export const INACTIVIDAD_MS = 30_000;
/** La lectura activa que habilita la salida por arriba sin haber pasado la recomendación. */
export const LECTURA_PARA_SALIDA_MS = 60_000;
/** Lo más que suma un tick: si el navegador durmió el intervalo, el salto no cuenta como lectura. */
const TICK_MAX_MS = 2_000;

/** La marca del final de los capítulos (`FinCapitulos`). */
export const SELECTOR_FIN_CAPITULOS = '[data-lqs="fin-capitulos"]';
/** La marca del final de la recomendación de Franco (`FinRecomendacion`). */
export const SELECTOR_FIN_RECOMENDACION = '[data-lqs="fin-recomendacion"]';
/** Lo que cuenta como actividad para la lectura. */
export const EVENTOS_ACTIVIDAD = ["scroll", "pointermove", "keydown", "touchstart", "wheel"] as const;

export type MotivoSubida = "final" | "lectura" | "salida";

export interface RelojDisparo {
  ahora(): number;
  programar(fn: () => void, ms: number): unknown;
  cancelar(h: unknown): void;
}

export function crearDisparador(o: {
  reloj: RelojDisparo;
  puedeSubir: () => boolean;
  subir: (motivo: MotivoSubida) => void;
  /** El banner del registro en uso: el disparo queda pendiente hasta que se libere. */
  enEspera?: () => boolean;
}) {
  const { reloj } = o;
  let hecho = false;
  let timerFinal: unknown = null;
  let acumulado = 0;
  let ultimaActividad = Number.NEGATIVE_INFINITY;
  let ultimoTick = reloj.ahora();
  let pasoRecomendacion = false;
  let pendiente: MotivoSubida | null = null;

  function disparar(motivo: MotivoSubida) {
    if (hecho) return;
    if (o.enEspera?.()) {
      // El banner está en uso: el primero que llegó queda guardado y sale cuando se libere.
      pendiente = pendiente ?? motivo;
      return;
    }
    hecho = true;
    if (timerFinal) reloj.cancelar(timerFinal);
    timerFinal = null;
    if (o.puedeSubir()) o.subir(motivo);
  }

  return {
    /** La marca del final entró en pantalla: en 8 s sube. Una vez. */
    llegoAlFinal() {
      if (hecho || timerFinal) return;
      timerFinal = reloj.programar(() => disparar("final"), ESPERA_FINAL_MS);
    },
    actividad() {
      ultimaActividad = reloj.ahora();
    },
    /** La marca del final de la recomendación de Franco entró en pantalla (o quedó arriba). */
    pasoLaRecomendacion() {
      pasoRecomendacion = true;
    },
    /** Cada segundo: suma lectura si la pestaña está visible y hubo actividad en los últimos 30 s, y
     *  suelta el disparo pendiente si el banner ya se liberó. */
    tick(visible: boolean) {
      const t = reloj.ahora();
      const delta = Math.min(Math.max(t - ultimoTick, 0), TICK_MAX_MS);
      ultimoTick = t;
      if (hecho) return;
      if (pendiente && !o.enEspera?.()) {
        disparar(pendiente);
        return;
      }
      if (!visible || t - ultimaActividad > INACTIVIDAD_MS) return;
      acumulado += delta;
      if (acumulado >= LECTURA_ACTIVA_MS) disparar("lectura");
    },
    /** `mouseout` del documento: sube si es PC, el cursor salió por arriba y la persona ya pasó la
     *  recomendación o lleva 60 s de lectura activa. */
    salida(e: { clientY: number; haciaFuera: boolean; pc: boolean }) {
      if (!(pasoRecomendacion || acumulado >= LECTURA_PARA_SALIDA_MS)) return;
      if (e.pc && e.haciaFuera && e.clientY <= 0) disparar("salida");
    },
    detener() {
      hecho = true;
      if (timerFinal) reloj.cancelar(timerFinal);
      timerFinal = null;
    },
  };
}

export type Disparador = ReturnType<typeof crearDisparador>;
