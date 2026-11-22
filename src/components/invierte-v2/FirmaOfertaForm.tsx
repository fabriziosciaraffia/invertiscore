"use client";

// ─────────────────────────────────────────────────────────────────────────────
// REVISA TU OFERTA ANTES DE FIRMAR (etapa 3, B3; lámina 5.1b). El mismo patrón de la orden: el resumen arriba (lo que ofrece, cómo
// paga —con la preaprobación y «Ver»—, la vigencia y la condición), que es una oferta sujeta a visita, qué pasa después, el documento
// completo con «Leer» (se abre en ventana, sin salir; texto de PRUEBA marcado BORRADOR) y la casilla sin marcar. El botón rojo se
// activa al marcar la casilla y no se puede apretar dos veces. Firmar no la presenta: la presenta una persona de Franco (B4).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from "react";
import { FIRMA_COPY as F } from "@/lib/invierte-v2/rango";
import { VentanaDocumento } from "./VentanaDocumento";
import { URL_API_OFERTA } from "./OfertaForm";

export function FirmaOfertaForm({ avisoId, montoUF, documento, urlVolver, resumen }: { avisoId: string; montoUF: number; documento: string[]; urlVolver: string; resumen: ReactNode }) {
  const [acepto, setAcepto] = useState(false);
  const [leyo, setLeyo] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(false);
  async function firmar() {
    if (!acepto || enviando) return;
    setEnviando(true); setError(false);
    const r = await fetch(URL_API_OFERTA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "firmar", avisoId, montoUF, acepto: true, leyo }) }).catch(() => null);
    // A la página del depto, recargada (con la oferta firmada).
    if (r?.ok) { window.location.assign(urlVolver); return; }
    setEnviando(false); setError(true);
  }
  return (
    <>
      {resumen}
      <div className="iv2-of-doc" data-inv2="documento-oferta">
        <div className="iv2-of-doc-txt">
          <span className="iv2-dp-pregunta-t">{F.documentoT}</span>
          <span className="iv2-dp-pregunta-s">{F.documentoLinea}</span>
        </div>
        <button type="button" className="iv2-enlace-azul" onClick={() => { setAbierto(true); setLeyo(true); }} data-inv2="leer-oferta">{F.leer}</button>
      </div>
      <label className="iv2-casilla iv2-of-casilla" data-inv2="casilla-oferta">
        <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
        <span>{F.casilla}</span>
      </label>
      {error && <p className="inv-error" role="alert">{F.error}</p>}
      <div className="iv2-acciones">
        <button type="button" className="inv-principal" disabled={!acepto || enviando} aria-busy={enviando || undefined} onClick={() => void firmar()} data-inv2="boton-firmar-oferta">{enviando ? F.firmando : F.firmar(montoUF)}</button>
        <p className="iv2-of-linea iv2-of-nota">{F.nota}</p>
      </div>
      {abierto && (
        <VentanaDocumento nombre="oferta" titulo={F.documentoT} alCerrar={() => setAbierto(false)} accion="Cerrar">
          <div className="iv2-of-texto" data-inv2="texto-oferta">{documento.map((p, i) => <p key={i} className={i === 0 || i === documento.length - 1 ? "iv2-of-borrador" : undefined}>{p}</p>)}</div>
        </VentanaDocumento>
      )}
    </>
  );
}
