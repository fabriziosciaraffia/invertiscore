"use client";

// LAS ACCIONES DE LA PERSONA SOBRE SU OFERTA (B4, 23-nov-2026; láminas 4.2-estados y 4.2-cuando-no-hay-acuerdo, y los puntos 12 y 13 de
// Fabrizio): «Retirarla» (el enlace gris, debajo, en firmada, en cola, presentada y aceptada; pide una confirmación antes), «No aceptar
// la contraoferta» (lo mismo, desde la pantalla de responder) y «No, gracias» a una respuesta fuera de plazo. No se puede apretar dos
// veces: mientras envía, queda deshabilitado. Al terminar, la página se recarga con lo guardado.
import { useState } from "react";
import { B4_COPY as B } from "@/lib/invierte-v2/b4";
import { URL_API_OFERTA } from "@/lib/invierte-v2/oferta-api";
import { VentanaDocumento } from "./VentanaDocumento";

type Accion = "retirar" | "no_gracias" | "no_aceptar" | "no_aceptar_tardia";

async function enviar(accion: "retirar" | "no_gracias", avisoId: string): Promise<boolean> {
  const r = await fetch(URL_API_OFERTA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion, avisoId }) }).catch(() => null);
  return !!r?.ok;
}

export function AccionOferta({ avisoId, accion, clase, volverA, texto }: { avisoId: string; accion: Accion; clase?: string; volverA?: string; texto?: string }) {
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(false);
  const etiqueta = texto ?? (accion === "retirar" ? B.retirarla : accion === "no_gracias" ? B.noGracias : B.noAceptar);
  async function hacer() {
    if (enviando) return;
    setEnviando(true); setError(false);
    // Fuera de plazo, «No aceptar la contraoferta» es «No, gracias»: la oferta ya había vencido, no hay nada que retirar.
    const ok = await enviar(accion === "no_gracias" || accion === "no_aceptar_tardia" ? "no_gracias" : "retirar", avisoId);
    if (ok) { if (volverA) window.location.assign(volverA); else window.location.reload(); return; }
    setEnviando(false); setError(true);
  }
  const conConfirmacion = accion !== "no_gracias";
  return (
    <>
      <button type="button" className={clase ?? "iv2-enlace-gris iv2-of-accion"} disabled={enviando} onClick={() => (conConfirmacion ? setConfirmar(true) : void hacer())} data-inv2={`accion-${accion}`}>
        {enviando && !confirmar ? "Enviando…" : etiqueta}
      </button>
      {error && !confirmar && <span className="iv2-error-linea" role="alert">No se pudo. Prueba de nuevo.</span>}
      {confirmar && (
        <VentanaDocumento nombre={`confirmar-${accion}`} variante="chica" titulo={accion === "retirar" ? B.retirarConfirmaT : B.noAceptarConfirmaT} alCerrar={() => { if (!enviando) setConfirmar(false); }}
          pie={(
            <>
              <button type="button" className="iv2-secundario" disabled={enviando} onClick={() => setConfirmar(false)} data-inv2="confirmar-no">{B.retirarNo}</button>
              <button type="button" className="inv-principal" disabled={enviando} onClick={() => void hacer()} data-inv2="confirmar-si">{enviando ? "Enviando…" : accion === "retirar" ? B.retirarSi : B.noAceptarSi}</button>
            </>
          )}>
          <p>{accion === "retirar" ? B.retirarConfirma : B.noAceptarConfirma}</p>
          {error && <p className="iv2-error-linea" role="alert">No se pudo. Prueba de nuevo.</p>}
        </VentanaDocumento>
      )}
    </>
  );
}
