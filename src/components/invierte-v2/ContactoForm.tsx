"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 1.2 CONTACTO, PASO 1 DE 2 (etapa 1 de Invierte con Franco, 18-nov-2026; lámina docs/invierte-v2-mockups/etapa-1/1.2).
// Cuándo compra, si tiene el pie (el 20 % de ESTE depto), su WhatsApp y la casilla de permiso —OBLIGATORIA y sin marcar—.
//   · Con sesión manda a /api/invierte-v2/contacto y sigue a la firma (o a Partimos si ya firmó la versión vigente).
//   · Sin sesión (solo con el modo «todos») guarda lo contestado en el navegador y sigue a la firma, que pide la cuenta.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { botonOcupado } from "@/lib/carga-global";
import type { Veredicto } from "@/lib/types";
import { INVIERTE_COPY, PIES, URGENCIAS, pieDelDepto, textoError, type OrigenInvierte, type PieInvierte, type UrgenciaInvierte } from "@/lib/invierte/invierte";
import { CLAVE_PENDIENTE_V2, FLUJO_COPY, validarContacto } from "@/lib/invierte-v2/flujo";
import { IndicadorPasos } from "./IndicadorPasos";
import { URL_INVIERTE, urlFirma } from "@/lib/invierte-v2/destino";

const H = INVIERTE_COPY.hoja;
const C = FLUJO_COPY.contacto;

export interface DeptoFlujo {
  avisoId: string;
  linea: string;
  precioUF: number | null;
  veredicto: string | null;
  score: number | null;
}

/** `conChip`: siempre, «solo-pc» (la firma: la lámina del PC lo lleva y la del celular no) o nunca. */
export function LineaDeptoFlujo({ depto, conChip = true }: { depto: DeptoFlujo; conChip?: boolean | "solo-pc" }) {
  const chip = conChip && depto.veredicto ? <ChipVeredicto v={depto.veredicto as Veredicto} puntaje={depto.veredicto === "COMPRAR" ? depto.score : null} /> : null;
  return (
    <p className="iv2-chip-linea" data-inv2="depto">
      <span>{depto.linea}{depto.precioUF != null ? ` · UF ${Math.round(depto.precioUF).toLocaleString("es-CL")}` : ""}</span>
      {chip && (conChip === "solo-pc" ? <span className="iv2-chip-pc" data-inv2="chip-pc">{chip}</span> : chip)}
    </p>
  );
}

export function ContactoForm({ depto, origen, analysisId, inicial, sinSesion, alCerrar }: {
  depto: DeptoFlujo;
  origen: OrigenInvierte;
  analysisId: string | null;
  /** `pieConocido` (27-nov-2026): el pie ya lo dijo en la asesoría y le alcanza este depto; la pregunta no se repite. */
  inicial: { urgencia: UrgenciaInvierte | null; pie: PieInvierte | null; whatsapp: string; pieConocido?: boolean } | null;
  sinSesion: boolean;
  /** En la hoja: la ✕ de la fila de arriba, que solo se ve en el PC (en el celular cierra la flecha de la cabecera). */
  alCerrar?: () => void;
}) {
  const router = useRouter();
  const [urgencia, setUrgencia] = useState<UrgenciaInvierte | null>(inicial?.urgencia ?? null);
  const [pie, setPie] = useState<PieInvierte | null>(inicial?.pie ?? null);
  const [whatsapp, setWhatsapp] = useState(inicial?.whatsapp ?? "");
  const [permiso, setPermiso] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pieUF = pieDelDepto(depto.precioUF);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const v = validarContacto({ avisoId: depto.avisoId, origen, urgencia, pie, whatsapp, permiso });
    if (!v.ok) {
      setError(v.error === "permiso" ? C.faltaPermiso : textoError(v.error === "cuando" || v.error === "pie" || v.error === "whatsapp" ? v.error : "red"));
      return;
    }
    if (sinSesion) {
      // Copiar antes de pasar a la cuenta: lo contestado vive en el navegador hasta que la ruta lo reciba.
      try { window.localStorage.setItem(CLAVE_PENDIENTE_V2, JSON.stringify({ pedido: v.pedido, t: Date.now() })); } catch { /* sin almacenamiento */ }
      router.push(urlFirma(depto.avisoId, origen, analysisId));
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/invierte-v2/contacto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v.pedido) });
      if (!res.ok) { setError(textoError("red")); setEnviando(false); return; }
      const d = (await res.json().catch(() => ({}))) as { firmo?: boolean };
      router.push(d.firmo ? URL_INVIERTE : urlFirma(depto.avisoId, origen, analysisId));
    } catch {
      setError(textoError("red"));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate style={{ display: "contents" }} data-inv2="contacto-form">
      {/* La fila de arriba (lámina 1.2-contacto-pc): el indicador y el título, y la ✕ a la derecha. En el PC la hoja no lleva la
          cabecera con el degradado; en el celular la ✕ no se ve y cierra la flecha de la cabecera. */}
      <div className="iv2-cab-form">
        <div className="iv2-cab-form-id">
          <IndicadorPasos paso={1} />
          <div className="inv-encabezado">
            <h1 className="inv-titulo" id="iv2-t">{C.titulo}</h1>
            <LineaDeptoFlujo depto={depto} />
          </div>
        </div>
        {alCerrar && (
          <button type="button" className="iv2-cab-x" onClick={alCerrar} aria-label="Cerrar" data-inv2="cerrar-pc">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>
      <p className="inv-parrafo">{C.parrafo}</p>
      <fieldset className="inv-pregunta">
        <legend>{H.cuando}</legend>
        <div className="inv-opciones">
          {URGENCIAS.map((u) => (
            <button key={u} type="button" className="inv-opcion" aria-pressed={urgencia === u} onClick={() => { setUrgencia(u); setError(null); }} data-inv2={`urgencia-${u}`}>{H.urgencias[u]}</button>
          ))}
        </div>
      </fieldset>
      {!inicial?.pieConocido && <fieldset className="inv-pregunta">
        <legend>{H.pie(pieUF)} <span className="inv-aclara">{H.pieAclaracion}</span></legend>
        <div className="inv-opciones">
          {PIES.map((p) => (
            <button key={p} type="button" className="inv-opcion" aria-pressed={pie === p} onClick={() => { setPie(p); setError(null); }} data-inv2={`pie-${p}`}>{H.pies[p]}</button>
          ))}
        </div>
      </fieldset>}
      <div className="inv-pregunta">
        <label htmlFor="iv2-wsp" className="inv-legend">{H.whatsapp}</label>
        <input id="iv2-wsp" type="tel" inputMode="tel" autoComplete="tel" className="inv-campo" placeholder={H.whatsappPlaceholder} value={whatsapp} onChange={(e) => { setWhatsapp(e.target.value); setError(null); }} data-inv2="whatsapp" />
      </div>
      <label className="iv2-casilla">
        <input type="checkbox" checked={permiso} onChange={(e) => { setPermiso(e.target.checked); setError(null); }} data-inv2="permiso" />
        <span>{C.permiso}</span>
      </label>
      {error && <p className="inv-error" role="alert">{error}</p>}
      <div className="iv2-acciones">
        <button type="submit" className="inv-principal" disabled={enviando} {...botonOcupado(enviando)} data-inv2="continuar">{enviando ? C.guardando : C.continuar}</button>
        <p className="iv2-nota-boton">{C.nota}</p>
      </div>
    </form>
  );
}
