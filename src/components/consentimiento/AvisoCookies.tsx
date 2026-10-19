"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El aviso de cookies (19-oct-2026; reglas en lib/consentimiento.ts). Una barra plana abajo, con el texto y «Rechazar» y
// «Aceptar» AL MISMO NIVEL: la misma clase, el mismo tamaño, sin uno destacado (en PC, el mismo ancho fijo: con
// el ancho del texto «Rechazar» quedaba 10 px más ancho, medido en el preview). Sale mientras no haya elección, y vuelve
// cuando el pie pide «Cookies». Se dibuja recién en el navegador (lee la cookie) y su texto es más chico que el titular
// de la landing, así que no le compite el LCP.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { COOKIES_COPY, EVENTO_ABRIR_AVISO, guardarConsentimiento, leerConsentimiento, type Consentimiento } from "@/lib/consentimiento";

const BOTON =
  "h-10 flex-1 rounded-full border border-[var(--franco-border)] bg-transparent px-5 text-[14px] font-semibold text-[var(--franco-text)] transition-colors hover:border-[var(--franco-text)] sm:w-28 sm:flex-none";

export function AvisoCookies() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (leerConsentimiento() === null) setVisible(true);
    const abrir = () => setVisible(true);
    window.addEventListener(EVENTO_ABRIR_AVISO, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_AVISO, abrir);
  }, []);

  if (!visible) return null;
  const elegir = (c: Consentimiento) => {
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
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
        <p className="m-0 flex-1 text-[13px] leading-[1.45] text-[var(--franco-text-secondary)]">
          {COOKIES_COPY.texto}{" "}
          <a href="/privacy" className="text-[var(--franco-text)] underline underline-offset-2">{COOKIES_COPY.privacidad}</a>
        </p>
        <div className="flex gap-2">
          <button type="button" className={BOTON} onClick={() => elegir("no")} data-cookies="rechazar">{COOKIES_COPY.rechazar}</button>
          <button type="button" className={BOTON} onClick={() => elegir("si")} data-cookies="aceptar">{COOKIES_COPY.aceptar}</button>
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
