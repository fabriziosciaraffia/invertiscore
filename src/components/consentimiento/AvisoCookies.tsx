"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El aviso de cookies (19-oct-2026; reglas en lib/consentimiento.ts). Una barra plana abajo, de UNA línea de texto:
// «Usamos cookies para medir qué funciona y mejorar Franco · Privacidad», con «Aceptar» lleno y «Rechazar» de borde,
// los dos del mismo tamaño y a un clic. En PC, todo en una fila. En el teléfono, la frase en la primera línea (con un
// tamaño que la hace caber entera: 27,9 em medidos en Inter, entre 10 y 13 px) y «Privacidad» con los botones en la
// segunda; no más, para que no tape «Ver un análisis real» del hero.
// Sale mientras no haya elección y vuelve cuando el pie pide «Cookies». Cada elección es un `cookies_eleccion` en
// PostHog (acepta, rechaza, ignora). Se dibuja recién en el navegador (lee la cookie) y su texto es más chico que el
// titular de la landing, así que no le compite el LCP.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import {
  COOKIES_COPY,
  EVENTO_ABRIR_AVISO,
  EVENTO_ELECCION_COOKIES,
  eleccionDe,
  guardarConsentimiento,
  leerConsentimiento,
  type Consentimiento,
} from "@/lib/consentimiento";
import { posthogCliente } from "@/lib/posthog-cliente";

/** El mismo tamaño para los dos: alto, ancho fijo, borde, letra. */
const BOTON = "h-10 w-28 shrink-0 rounded-full border text-[14px] font-semibold transition-opacity";
const LLENO = "border-[var(--franco-text)] bg-[var(--franco-text)] text-[var(--franco-bg)] hover:opacity-85";
const BORDE = "border-[var(--franco-text)] bg-transparent text-[var(--franco-text)] hover:opacity-70";
const ENLACE = "text-[var(--franco-text)] underline underline-offset-2";
/**
 * La frase entra entera en una línea: el ancho útil (pantalla menos los 16 px de cada lado) sobre 28,2 em. Medido en el
 * preview: 11,6 px en 360, 12,7 en 390, 13 desde 412. El piso de 10 px es para los 320 px (iPhone SE de 2016): con 11 la
 * frase salía cortada.
 */
const TAMANO_FRASE = "clamp(10px, calc((100vw - 32px) / 28.2), 13px)";

export function AvisoCookies() {
  const [visible, setVisible] = useState(false);
  /** «aviso» cuando sale sin elección (lo que mide la tasa); «pie» cuando alguien la reabre para cambiarla. */
  const origen = useRef<"aviso" | "pie">("aviso");

  useEffect(() => {
    if (leerConsentimiento() === null) setVisible(true);
    const abrir = () => {
      origen.current = leerConsentimiento() === null ? "aviso" : "pie";
      setVisible(true);
    };
    window.addEventListener(EVENTO_ABRIR_AVISO, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_AVISO, abrir);
  }, []);

  // «ignora»: la persona se va de la página con el aviso a la vista y sin elegir. Una vez por página, y con
  // `send_instantly` (fetch keepalive): un capture a secas en `pagehide` se pierde, porque el SDK ya vació su cola
  // (medido el 03-sep-2026, memoria «posthog-capture-en-pagehide-se-pierde»).
  useEffect(() => {
    if (!visible) return;
    const alIrse = () => {
      if (leerConsentimiento() !== null) return;
      window.removeEventListener("pagehide", alIrse);
      posthogCliente.capture(EVENTO_ELECCION_COOKIES, { eleccion: "ignora", origen: "aviso" }, { send_instantly: true });
    };
    window.addEventListener("pagehide", alIrse);
    return () => window.removeEventListener("pagehide", alIrse);
  }, [visible]);

  if (!visible) return null;
  const elegir = (c: Consentimiento) => {
    posthogCliente.capture(EVENTO_ELECCION_COOKIES, { eleccion: eleccionDe(c), origen: origen.current });
    guardarConsentimiento(c);
    setVisible(false);
  };
  return (
    <div
      role="region"
      aria-label="Cookies"
      data-cookies="aviso"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--franco-border)] bg-[var(--franco-card)]"
      style={{ fontFamily: "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif" }}
    >
      <div className="mx-auto flex max-w-[1100px] flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-3">
        <p
          data-cookies="texto"
          className="m-0 min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap leading-[1.4] text-[var(--franco-text-secondary)]"
          style={{ fontSize: TAMANO_FRASE }}
        >
          {COOKIES_COPY.texto}
          <span className="hidden sm:inline">
            {` ${COOKIES_COPY.separador} `}
            <a href="/privacy" className={ENLACE}>{COOKIES_COPY.privacidad}</a>
          </span>
        </p>
        <div className="flex items-center gap-2">
          <a href="/privacy" className={`${ENLACE} mr-auto text-[13px] sm:hidden`}>{COOKIES_COPY.privacidad}</a>
          <button type="button" className={`${BOTON} ${BORDE}`} onClick={() => elegir("no")} data-cookies="rechazar">{COOKIES_COPY.rechazar}</button>
          <button type="button" className={`${BOTON} ${LLENO}`} onClick={() => elegir("si")} data-cookies="aceptar">{COOKIES_COPY.aceptar}</button>
        </div>
      </div>
    </div>
  );
}

/** «Cookies» en el pie: vuelve a mostrar el aviso para cambiar la elección. */
export function CambiarCookies({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      data-cookies="cambiar"
      onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_AVISO))}
    >
      {COOKIES_COPY.pie}
    </button>
  );
}
