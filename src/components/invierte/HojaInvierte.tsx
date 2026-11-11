"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA HOJA DE INSCRIPCIÓN Y SU CONFIRMACIÓN (11-nov-2026, mockups Pronto.dc.html y ProntoListo.dc.html, con sus textos tal cual).
// Sube sobre la página (en el teléfono desde abajo, en el PC centrada). Arriba la franja con «Invierte con Franco»; el depto
// (línea, precio y chip); PRONTO; el título; UN párrafo; tres preguntas —cuándo, el pie (el 20 % de ESTE depto) y el WhatsApp—
// y «Avísenme cuando pueda invertir en este depto». Sin lista de servicios, sin precio, sin comisión, sin plazo prometido.
//   · CON CUENTA manda a /api/invierte y, si Franco la recibió (también el correo a hola@), la misma hoja confirma: «Listo,
//     quedaste inscrito.» y la etiqueta que queda en la tarjeta. Si no, el error con el mismo botón para reintentar.
//   · SIN CUENTA (Explorar) guarda lo contestado (invierte.ts › guardarPendiente) y sigue con el registro (`alPedirRegistro`):
//     la cuenta nace con su regalo de alta, como cualquier cuenta nueva. Al volver con cuenta al mismo pin, la hoja se abre con
//     `retomar`, manda lo guardado y confirma; lo guardado se borra recién cuando la ruta respondió bien.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { botonOcupado } from "@/lib/carga-global";
import { consumirCookieEspejo, espejarMeta } from "@/lib/meta/espejo";
import { UTM_STORAGE_KEY } from "@/lib/attribution-claves";
import type { Veredicto } from "@/lib/types";
import {
  borrarPendiente, guardarPendiente, INVIERTE_COPY, leerPendiente, pieDelDepto, PIES, textoError, URGENCIAS, validarInscripcion,
  type DeptoInvierte, type OrigenInvierte, type PieInvierte, type UrgenciaInvierte,
} from "@/lib/invierte/invierte";
import { marcarInscrito } from "./inscritos";
import { EtiquetaInscrito } from "./BotonInvierte";
import "./invierte.css";

const H = INVIERTE_COPY.hoja;
const L = INVIERTE_COPY.listo;
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

function almacen(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}
function utmDeLaVisita(): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(UTM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** El depto arriba de la hoja: la línea, el precio y el chip. */
function LineaDepto({ depto, conChip = true }: { depto: DeptoInvierte; conChip?: boolean }) {
  return (
    <p className="inv-depto" data-invierte="depto">
      <span>{depto.linea} · UF {miles(depto.precioUF)}</span>
      {conChip && depto.veredicto && <ChipVeredicto v={depto.veredicto as Veredicto} puntaje={depto.veredicto === "COMPRAR" ? depto.score : null} />}
    </p>
  );
}

export function ListoInvierte({ depto, volver, alVolver }: { depto: DeptoInvierte; volver: string; alVolver: () => void }) {
  return (
    <div className="inv-cuerpo" data-invierte="listo" role="status" aria-live="polite">
      <h2 className="inv-titulo inv-titulo-listo" id="inv-hoja-t">{L.titulo}</h2>
      <LineaDepto depto={depto} conChip={false} />
      <div className="inv-caja">
        <p className="inv-caja-t">{L.texto}</p>
        <p className="inv-caja-s">{L.sub}</p>
      </div>
      <div className="inv-queda"><span>{L.queda}</span><EtiquetaInscrito /></div>
      <button type="button" className="inv-principal inv-principal-tinta" onClick={alVolver} data-invierte="volver">{volver}</button>
    </div>
  );
}

export function HojaInvierte({ depto, origen, sinCuenta = false, retomar = false, volver = L.cerrar, alPedirRegistro, alInscrito, alCerrar }: {
  depto: DeptoInvierte;
  origen: OrigenInvierte;
  sinCuenta?: boolean;
  /** Volvió del registro: manda lo que había contestado sin cuenta (si lo hay en este navegador). */
  retomar?: boolean;
  /** El texto del botón de la confirmación («Volver al mapa» en Explorar). */
  volver?: string;
  alPedirRegistro?: () => void;
  alInscrito?: (avisoId: string) => void;
  alCerrar: () => void;
}) {
  const pendiente = retomar ? leerPendiente(almacen(), depto.avisoId) : null;
  const [urgencia, setUrgencia] = useState<UrgenciaInvierte | null>(pendiente?.pedido.urgencia ?? null);
  const [pie, setPie] = useState<PieInvierte | null>(pendiente?.pedido.pie ?? null);
  const [whatsapp, setWhatsapp] = useState(pendiente?.pedido.whatsapp ?? "");
  const [estado, setEstado] = useState<"form" | "enviando" | "listo">(pendiente ? "enviando" : "form");
  const [error, setError] = useState<string | null>(null);
  const pieUF = pieDelDepto(depto.precioUF);
  const caja = useRef<HTMLElement>(null);

  // Escape cierra la hoja (no mientras manda). En captura: corre antes que el de la tarjeta de abajo.
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;
  const ocupadoRef = useRef(false);
  ocupadoRef.current = estado === "enviando";
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (!ocupadoRef.current) cerrarRef.current();
    };
    window.addEventListener("keydown", esc, true);
    caja.current?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", esc, true);
  }, []);

  async function mandar(r: { urgencia: UrgenciaInvierte; pie: PieInvierte; whatsapp: string }) {
    setError(null);
    setEstado("enviando");
    try {
      const res = await fetch("/api/invierte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avisoId: depto.avisoId, origen, analysisId: depto.analysisId ?? null, ...r, utm: utmDeLaVisita() }),
      });
      if (!res.ok) { setError(textoError("red")); setEstado("form"); return; }
      espejarMeta(consumirCookieEspejo());
      borrarPendiente(almacen());
      marcarInscrito(depto.avisoId);
      alInscrito?.(depto.avisoId);
      setEstado("listo");
    } catch {
      setError(textoError("red"));
      setEstado("form");
    }
  }

  // Volvió del registro con lo contestado: se manda solo, una vez.
  const retomado = useRef(false);
  useEffect(() => {
    if (!pendiente || retomado.current) return;
    retomado.current = true;
    void mandar({ urgencia: pendiente.pedido.urgencia, pie: pendiente.pedido.pie, whatsapp: pendiente.pedido.whatsapp });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (estado === "enviando") return;
    const v = validarInscripcion({ avisoId: depto.avisoId, origen, urgencia, pie, whatsapp, analysisId: depto.analysisId ?? null });
    if (!v.ok) { setError(textoError(v.error)); return; }
    if (sinCuenta) {
      // Copiar antes de pasar al registro: lo contestado vive en el navegador hasta que la ruta lo reciba.
      guardarPendiente(almacen(), { pedido: v.pedido, depto });
      alPedirRegistro?.();
      return;
    }
    void mandar(v.pedido);
  }

  return (
    <div className="inv-velo" data-invierte="hoja" onClick={(e) => { if (e.target === e.currentTarget && estado !== "enviando") alCerrar(); }}>
      <section ref={caja} tabIndex={-1} className="inv-hoja" role="dialog" aria-modal="true" aria-labelledby="inv-hoja-t" data-estado={estado} data-sin-cuenta={sinCuenta ? "1" : undefined}>
        <div className="inv-cab">
          <button type="button" className="inv-atras" onClick={alCerrar} aria-label={estado === "listo" ? H.cerrar : H.volver} disabled={estado === "enviando"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span className="inv-cab-t">{H.cabecera}</span>
          <span className="inv-cab-hueco" aria-hidden="true" />
        </div>
        {estado === "listo" ? (
          <ListoInvierte depto={depto} volver={volver} alVolver={alCerrar} />
        ) : (
          <form className="inv-cuerpo" onSubmit={enviar} noValidate>
            <div className="inv-encabezado">
              <span className="inv-pronto">{INVIERTE_COPY.pronto}</span>
              <h2 className="inv-titulo" id="inv-hoja-t">{H.titulo}</h2>
              <LineaDepto depto={depto} />
            </div>
            <p className="inv-parrafo">{H.parrafo}</p>
            <fieldset className="inv-pregunta">
              <legend>{H.cuando}</legend>
              <div className="inv-opciones">
                {URGENCIAS.map((u) => (
                  <button key={u} type="button" className="inv-opcion" aria-pressed={urgencia === u} onClick={() => { setUrgencia(u); setError(null); }} data-invierte={`urgencia-${u}`}>{H.urgencias[u]}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className="inv-pregunta">
              <legend>{H.pie(pieUF)} <span className="inv-aclara">{H.pieAclaracion}</span></legend>
              <div className="inv-opciones">
                {PIES.map((p) => (
                  <button key={p} type="button" className="inv-opcion" aria-pressed={pie === p} onClick={() => { setPie(p); setError(null); }} data-invierte={`pie-${p}`}>{H.pies[p]}</button>
                ))}
              </div>
            </fieldset>
            <div className="inv-pregunta">
              <label htmlFor="inv-wsp" className="inv-legend">{H.whatsapp}</label>
              <input id="inv-wsp" type="tel" inputMode="tel" autoComplete="tel" className="inv-campo" placeholder={H.whatsappPlaceholder} value={whatsapp} onChange={(e) => { setWhatsapp(e.target.value); setError(null); }} data-invierte="whatsapp" />
            </div>
            {sinCuenta && <p className="inv-nota" data-invierte="sin-cuenta">{H.sinCuenta}</p>}
            {error && <p className="inv-error" role="alert">{error}</p>}
            <button type="submit" className="inv-principal" disabled={estado === "enviando"} {...botonOcupado(estado === "enviando")} data-invierte="enviar">
              {estado === "enviando" ? H.enviando : H.enviar}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
