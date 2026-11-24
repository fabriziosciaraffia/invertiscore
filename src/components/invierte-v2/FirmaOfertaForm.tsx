"use client";

// ─────────────────────────────────────────────────────────────────────────────
// REVISA Y FIRMA TU OFERTA (etapa 3, B3; rediseño del 23-nov-2026, láminas 5.1b celular y PC). Lo primero es la tranquilidad: firmar
// no obliga a comprar, con el dibujo de los cuatro pasos y «¿Qué significa sujeta a visita?» (abre una ventana chica). Después la
// firma: el resumen en tres filas (lo que ofrece y cuánto bajo el publicado; cómo paga, con la preaprobación y «Ver»; la vigencia, con
// que mientras tanto no puede ofertar por otro depto), el documento con «Leer» (ventana, sin salir; texto de PRUEBA marcado BORRADOR)
// y la casilla sin marcar. El botón rojo se activa al marcar la casilla y no se puede apretar dos veces. En PC, dos columnas: a la
// izquierda la tranquilidad; a la derecha la firma, en la única tarjeta con sombra. Firmar no la presenta: la presenta Franco (B4).
// ─────────────────────────────────────────────────────────────────────────────
// Después de la visita, toda oferta es en firme (24-nov-2026, lámina 5.1b): el bloque principal dice que es en firme, con sus cuatro
// pasos y que se puede retirar solo mientras no respondan; el resumen suma «Respaldo» (el reporte, si el monto baja) y «Garantía» (solo
// un aviso); lleva una segunda casilla, la confirmación explícita, y el botón se activa solo con las dos marcadas.
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { FIRMA_COPY as F, pctBajoPublicado } from "@/lib/invierte-v2/rango";
import { VentanaDocumento } from "./VentanaDocumento";
import { URL_API_OFERTA } from "@/lib/invierte-v2/oferta-api";

const fmt = (n: number) => Math.round(n).toLocaleString("es-CL");

export function FirmaOfertaForm({ avisoId, montoUF, publicadoUF, documento, urlVolver, pagas, pagasLinea, desdeId = null, retirarOtra = false, enFirme = null }: {
  avisoId: string; montoUF: number; publicadoUF: number; documento: string[]; urlVolver: string;
  /** «Pie de UF 587 y crédito hipotecario» (o sin crédito) y, debajo, la preaprobación con su «Ver». */
  pagas: string; pagasLinea: ReactNode;
  /** B4: una ronda nueva desde esta oferta (contraoferta, respuesta fuera de plazo o vencida); y si se queda con esta ante otra viva. */
  desdeId?: string | null;
  retirarOtra?: boolean;
  /** En firme (ya visitó): el monto de la oferta anterior («Antes») y el respaldo del reporte si el monto baja. */
  enFirme?: { antesUF: number | null; respaldo: { fecha: string; linea: string; href: string } | null } | null;
}) {
  const [acepto, setAcepto] = useState(false);
  const [aceptoFirme, setAceptoFirme] = useState(false);
  const listo = acepto && (!enFirme || aceptoFirme);
  const [leyo, setLeyo] = useState(false);
  const [abierto, setAbierto] = useState<"documento" | "sujeta" | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(false);
  async function firmar() {
    if (!listo || enviando) return;
    setEnviando(true); setError(false);
    const firme = enFirme ? { aceptoFirme: true } : {};
    const r = await fetch(URL_API_OFERTA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(desdeId ? { accion: "firmar_ronda", avisoId, desdeId, montoUF, acepto: true, leyo, retirarOtra, ...firme } : { accion: "firmar", avisoId, montoUF, acepto: true, leyo, ...firme }) }).catch(() => null);
    // A la página del depto, recargada (con la oferta firmada).
    if (r?.ok) { window.location.assign(urlVolver); return; }
    setEnviando(false); setError(true);
  }
  return (
    <div className={`iv2-fo${enFirme ? " iv2-fo-firme" : ""}`} data-inv2="firma-oferta">
      <section className="iv2-fo-tranqui" aria-labelledby="iv2-fo-t" data-inv2="no-obliga">
        <div className="iv2-fo-cab">
          <svg className="iv2-fo-escudo" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M8.8 12.2l2.2 2.2 4.2-4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div><h2 className="iv2-fo-t" id="iv2-fo-t">{enFirme ? F.enFirmeT : F.noObliga}</h2><span className="iv2-fo-s">{enFirme ? F.enFirmeS : F.noObligaS}</span></div>
        </div>
        <ol className="iv2-fo-pasos" data-inv2="pasos-oferta">
          {(enFirme ? F.enFirmePasos : F.pasos).map((t, i) => <li key={t}><i aria-hidden="true">{i + 1}</i><span>{t}</span></li>)}
        </ol>
        <p className="iv2-fo-sino">{enFirme ? F.enFirmeRetiro : F.siNo}</p>
        <button type="button" className="iv2-enlace-azul iv2-fo-que" onClick={() => setAbierto("sujeta")} data-inv2="que-significa">{enFirme ? F.enFirmeQue : F.queSignifica}</button>
      </section>
      <div className="iv2-fo-firma">
        <dl className="iv2-fo-resumen" data-inv2="resumen-oferta">
          <div><dt>{F.ofreces}</dt><dd><span className="iv2-fo-monto">UF {fmt(montoUF)}</span><span className="iv2-fo-dd-s">{enFirme?.antesUF ? F.antes(enFirme.antesUF) : pctBajoPublicado(montoUF, publicadoUF)}</span></dd></div>
          {enFirme?.respaldo && <div data-inv2="fila-respaldo"><dt>{F.respaldo}</dt><dd><span>{F.respaldoT(enFirme.respaldo.fecha)}</span><span className="iv2-fo-dd-s">{enFirme.respaldo.linea} · <Link href={enFirme.respaldo.href} className="iv2-enlace-azul">{F.ver}</Link></span></dd></div>}
          <div><dt>{F.comoPagas}</dt><dd><span>{pagas}</span><span className="iv2-fo-dd-s">{pagasLinea}</span></dd></div>
          <div><dt>{F.vigencia}</dt><dd><span>{F.vigenciaTexto}</span><span className="iv2-fo-dd-s" data-inv2="vigencia-otro">{F.vigenciaS}</span></dd></div>
          {enFirme && <div data-inv2="fila-garantia"><dt>{F.garantia}</dt><dd><span>{F.garantiaT}</span><span className="iv2-fo-dd-s">{F.garantiaS}</span></dd></div>}
        </dl>
        <div className="iv2-fo-doc" data-inv2="documento-oferta">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M14 3v4h4M9.5 12h5M9.5 15.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          <div className="iv2-fo-doc-txt"><span className="iv2-fo-doc-t">{F.documentoT}</span><span className="iv2-fo-doc-s">{F.documentoLinea}</span></div>
          <button type="button" className="iv2-fo-leer" onClick={() => { setAbierto("documento"); setLeyo(true); }} data-inv2="leer-oferta">{F.leer}</button>
        </div>
        <label className="iv2-casilla iv2-of-casilla" data-inv2="casilla-oferta">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>{F.casilla}</span>
        </label>
        {enFirme && (
          <label className="iv2-casilla iv2-of-casilla" data-inv2="casilla-firme">
            <input type="checkbox" checked={aceptoFirme} onChange={(e) => setAceptoFirme(e.target.checked)} />
            <span>{F.casillaFirme}</span>
          </label>
        )}
        {error && <p className="inv-error" role="alert">{F.error}</p>}
        <div className="iv2-acciones iv2-fo-acciones">
          <button type="button" className="inv-principal" disabled={!listo || enviando} aria-busy={enviando || undefined} onClick={() => void firmar()} data-inv2="boton-firmar-oferta">{enviando ? F.firmando : enFirme ? F.firmarFirme(montoUF) : F.firmar(montoUF)}</button>
          <p className="iv2-fo-nota">{F.nota}</p>
        </div>
      </div>
      {abierto === "documento" && (
        <VentanaDocumento nombre="oferta" titulo={F.documentoT} alCerrar={() => setAbierto(null)} accion="Cerrar">
          <div className="iv2-of-texto" data-inv2="texto-oferta">{documento.map((p, i) => <p key={i} className={i === 0 || i === documento.length - 1 ? "iv2-of-borrador" : undefined}>{p}</p>)}</div>
        </VentanaDocumento>
      )}
      {abierto === "sujeta" && (
        <VentanaDocumento nombre="sujeta" variante="chica" titulo={enFirme ? F.enFirmeQue : F.queSignifica} alCerrar={() => setAbierto(null)} accion={F.entendido}>
          <ul className="iv2-fo-sujeta" data-inv2="texto-sujeta">{(enFirme ? F.enFirmeVentana : F.sujetaVentana).map((t) => <li key={t}>{t}</li>)}</ul>
        </VentanaDocumento>
      )}
    </div>
  );
}
