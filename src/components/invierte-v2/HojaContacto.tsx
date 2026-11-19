"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 1.2 CONTACTO COMO HOJA (18-nov-2026, encargo de Fabrizio; láminas docs/invierte-v2-mockups/etapa-1/1.2-contacto y
// 1.2-contacto-pc). Se abre ENCIMA de donde estaba la persona —el mapa, la selección o la portada del informe—, con el patrón
// de la hoja de Pronto (sus mismas clases: invierte.css), sin tocar la de Pronto: en el celular sube desde abajo con el mapa
// asomando arriba; en el PC es una ventana centrada sobre el fondo oscurecido, con ✕. Cerrar deja a la persona donde estaba:
// no navega ni recarga. «Continuar» va a la página de la firma.
//   · Al abrirse pregunta el estado (GET /api/invierte-v2/contacto): quien ya firmó la versión vigente va a «Súmalo a tus opciones»
//     (entrega 2, lámina 3.3-sumar-otro-depto); quien
//     ya había contestado ve sus respuestas. Sin sesión (modo «todos») no hay estado: se contesta igual y la firma pide la cuenta.
//   · El botón «atrás» del navegador no se atiende en esta etapa (pendiente, junto con la hoja de Pronto).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";
import { urlSumar } from "@/lib/invierte-v2/base";
import type { OrigenInvierte, PieInvierte, UrgenciaInvierte } from "@/lib/invierte/invierte";
import { ChipVeredictoTokens } from "@/components/analysis/shared/ChipVeredicto";
import { ContactoForm, type DeptoFlujo } from "./ContactoForm";
import "@/components/invierte/invierte.css";
import "./invierte-v2.css";

type Inicial = { urgencia: UrgenciaInvierte | null; pie: PieInvierte | null; whatsapp: string } | null;

export function HojaContacto({ depto, origen, analysisId = null, sinSesion = false, alCerrar }: {
  depto: DeptoFlujo;
  origen: OrigenInvierte;
  analysisId?: string | null;
  sinSesion?: boolean;
  alCerrar: () => void;
}) {
  const router = useRouter();
  const caja = useRef<HTMLElement>(null);
  const [inicial, setInicial] = useState<Inicial>(null);
  const [listo, setListo] = useState(sinSesion);

  // Escape cierra; en captura, antes que la tarjeta de abajo.
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); cerrarRef.current(); } };
    window.addEventListener("keydown", esc, true);
    caja.current?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", esc, true);
  }, []);

  useEffect(() => {
    if (sinSesion) return;
    let vivo = true;
    fetch("/api/invierte-v2/contacto", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { firmo?: boolean; inicial?: Inicial } | null) => {
        if (!vivo) return;
        if (d?.firmo) { router.push(`${urlSumar(depto.avisoId)}?desde=${origen}`); return; }
        setInicial(d?.inicial ?? null);
        setListo(true);
      })
      .catch(() => { if (vivo) setListo(true); });
    return () => { vivo = false; };
  }, [sinSesion, router, depto.avisoId, origen]);

  return (
    <div className="inv-velo iv2-velo" data-inv2="hoja-contacto" onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <ChipVeredictoTokens />
      <section ref={caja} tabIndex={-1} className="inv-hoja iv2-hoja" role="dialog" aria-modal="true" aria-labelledby="iv2-t">
        <div className="inv-cab">
          <button type="button" className="inv-atras" onClick={alCerrar} aria-label="Cerrar" data-inv2="cerrar">
            <svg className="iv2-solo-movil" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            <svg className="iv2-solo-pc" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <span className="inv-cab-t">{FLUJO_COPY.cabecera}</span>
          <span className="inv-cab-hueco" aria-hidden="true" />
        </div>
        <div className="inv-cuerpo">
          {listo ? (
            <ContactoForm key={inicial ? "con" : "sin"} depto={depto} origen={origen} analysisId={analysisId} inicial={inicial} sinSesion={sinSesion} alCerrar={alCerrar} />
          ) : (
            <div className="iv2-cab-form">
              <p className="inv-parrafo" aria-busy="true" data-inv2="cargando">{FLUJO_COPY.contacto.titulo}…</p>
              <button type="button" className="iv2-cab-x" onClick={alCerrar} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
