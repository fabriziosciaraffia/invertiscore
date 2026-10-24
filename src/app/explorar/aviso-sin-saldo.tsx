"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL AVISO E (23-oct-2026, docs/puerta-b-mockups/4-ticket-y-popups.html): «Explorar los 312» sin saldo. Al entrar al mapa
// sin análisis disponibles se abre encima, y «Ahora no» lo cierra: el mapa se mira igual. Ofrece el pack —al precio del
// ticket si la cuenta tiene menos de 24 horas, con «Solo para cuentas nuevas» y cuándo vence—, «Comprar solo 1» y el plan.
// Sin portal (se dibuja donde se monta, fijo sobre la página): así lo prueba el tier EXPLORAR sin navegador.
// CABE EN EL TELÉFONO (24-oct-2026): el modo compacto del pop-up de «Analizar este» (wizard-v4.css), la oferta en una fila
// y «Comprar solo 1» como botón de borde más bajo. Lo mide la sonda popups-alto-webkit-sonda.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { botonOcupado, claveActual, iniciarCarga } from "@/lib/carga-global";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { AVISO_SIN_SALDO } from "@/lib/explorar/explorar";
import type { ComprasDelDepto } from "@/lib/guia/compra-desde-depto";
import "@/components/formulario-v4/wizard-v4.css";

export function AvisoSinSaldoExplorar({ n, compras, vence, alCerrar, yendo = null, alIr }: {
  n: number;
  compras: ComprasDelDepto;
  /** Con el ticket vivo: «mañana 11:17». */
  vence: string | null;
  alCerrar: () => void;
  /** Adónde se está yendo (el botón ocupado). */
  yendo?: "pack" | "suelto" | null;
  alIr: (que: "pack" | "suelto") => void;
}) {
  const router = useRouter();
  const primario = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => primario.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); alCerrar(); } };
    document.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(t); document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [alCerrar]);
  const ir = (que: "pack" | "suelto", href: string) => { alIr(que); iniciarCarga(claveActual()); router.push(href); };
  return (
    <div className="wz4 wz-modal-velo wz-modal-velo-compacto" style={{ height: "100dvh" }} role="dialog" aria-modal="true" aria-labelledby="ex-sin-saldo-titulo" data-modal="explorar-sin-saldo">
      <div className="wz-modal wz-modal-compacto">
        <div className="wz-modal-mc">
          <div className="wz-modal-mt">
            <span>{AVISO_SIN_SALDO.sobre}</span>
            <button type="button" onClick={alCerrar} aria-label="Cerrar" className="wz-disco"><X className="w-4 h-4" aria-hidden /></button>
          </div>
          <h2 id="ex-sin-saldo-titulo" className="wz-modal-dir">{AVISO_SIN_SALDO.titulo(n)}</h2>
          <p className="wz-modal-msg" style={{ fontWeight: 400 }}>{AVISO_SIN_SALDO.cuerpo}</p>
          {compras.pack.ticket && (
            <div className="ex-ticket" data-explorar="ticket">
              <div className="ex-ticket-fila">
                <span className="ex-ticket-k">{AVISO_SIN_SALDO.soloNuevas}</span>
                {vence && <span className="ex-ticket-vence">{AVISO_SIN_SALDO.vence(vence)}</span>}
              </div>
              <div className="ex-ticket-t">{AVISO_SIN_SALDO.packTicket(compras.pack.label.replace(/^.*·\s*/, ""))}</div>
            </div>
          )}
        </div>
        <div className="wz-modal-mb">
          <button ref={primario} type="button" className="wz-cta wz-cta-modal" {...botonOcupado(yendo === "pack")} disabled={!!yendo} onClick={() => ir("pack", compras.pack.href)} data-explorar="comprar-pack">
            {compras.pack.ticket ? AVISO_SIN_SALDO.aprovechar(compras.pack.label.replace(/^.*·\s*/, "")) : compras.pack.label}
          </button>
          <button type="button" className="wz-btn2 wz-btn2-bajo" {...botonOcupado(yendo === "suelto")} disabled={!!yendo} onClick={() => ir("suelto", compras.suelto.href)} data-explorar="comprar-suelto">
            {compras.suelto.label}
          </button>
          <EnlaceCarga href="/pricing" className="ex-plan-enlace" data-explorar="ver-plan">{AVISO_SIN_SALDO.plan}</EnlaceCarga>
          <button type="button" className="wz-lnk" style={{ alignSelf: "center" }} onClick={alCerrar} disabled={!!yendo} data-explorar="ahora-no">{AVISO_SIN_SALDO.ahoraNo}</button>
        </div>
      </div>
    </div>
  );
}
