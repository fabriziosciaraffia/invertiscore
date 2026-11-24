"use client";

// LAS ACCIONES DE LA VISITA (24-nov-2026; láminas 4.2-estados, 4.2-la-visita y 5.2 del 24-nov, decisiones 5 y 7 de Fabrizio):
// «Visitar antes de responder» y «Pedir la visita» solo avisan a Franco (dejan la tarea; quién va está sin decidir), y la página pasa a
// «Franco está coordinando tu visita». «Confirmar UF X» y «Confirmar sin visitar» piden una confirmación explícita antes: al confirmar
// queda en firme y ya no se puede retirar. No se puede apretar dos veces: mientras envía, queda deshabilitado.
import { useState } from "react";
import { VISITA_COPY as VC } from "@/lib/invierte-v2/visita";
import { URL_API_OFERTA } from "@/lib/invierte-v2/oferta-api";
import { VentanaDocumento } from "./VentanaDocumento";

type Tipo = "pedir_visita" | "confirmar" | "confirmar_sin_visitar";

async function enviar(tipo: Tipo, avisoId: string): Promise<boolean> {
  const body = tipo === "pedir_visita" ? { accion: "pedir_visita", avisoId } : { accion: "confirmar_en_firme", avisoId, confirmo: true };
  const r = await fetch(URL_API_OFERTA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return !!r?.ok;
}

export function AccionVisita({ avisoId, tipo, texto, montoUF = null, clase, volverA }: { avisoId: string; tipo: Tipo; texto: string; montoUF?: string | null; clase?: string; volverA?: string }) {
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(false);
  async function hacer() {
    if (enviando) return;
    setEnviando(true); setError(false);
    const ok = await enviar(tipo, avisoId);
    if (ok) { if (volverA) window.location.assign(volverA); else window.location.reload(); return; }
    setEnviando(false); setError(true);
  }
  const conConfirmacion = tipo !== "pedir_visita";
  const sinVisitar = tipo === "confirmar_sin_visitar";
  return (
    <>
      <button type="button" className={clase ?? (tipo === "confirmar_sin_visitar" ? "iv2-enlace-azul iv2-of-accion" : "inv-principal")} disabled={enviando} onClick={() => (conConfirmacion ? setConfirmar(true) : void hacer())} data-inv2={`accion-${tipo}`}>
        {enviando && !confirmar ? "Enviando…" : texto}
      </button>
      {error && !confirmar && <span className="iv2-error-linea" role="alert">No se pudo. Prueba de nuevo.</span>}
      {confirmar && (
        <VentanaDocumento nombre={`confirmar-${tipo}`} variante="chica" titulo={sinVisitar ? VC.confirmarSinVisitarT : VC.confirmarT(montoUF ?? "")} alCerrar={() => { if (!enviando) setConfirmar(false); }}
          pie={(
            <>
              <button type="button" className="iv2-secundario" disabled={enviando} onClick={() => setConfirmar(false)} data-inv2="confirmar-no">{VC.confirmarNo}</button>
              <button type="button" className="inv-principal" disabled={enviando} onClick={() => void hacer()} data-inv2="confirmar-si">{enviando ? "Enviando…" : VC.confirmarSi}</button>
            </>
          )}>
          <p>{sinVisitar ? VC.confirmarSinVisitarTxt : VC.confirmarTxt}</p>
          {error && <p className="iv2-error-linea" role="alert">No se pudo. Prueba de nuevo.</p>}
        </VentanaDocumento>
      )}
    </>
  );
}
