"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL MENÚ DE LA BASE (entrega 2, 19-nov-2026; lámina 3.3-menu). En el celular, el botón ☰ de la base abre una hoja desde abajo
// con lo que no es un paso del flujo: su perfil de inversión, sus documentos, las preguntas frecuentes y «Escribirle a Franco».
// «Mis avisos» no se construye en esta etapa. Cierra con «Cerrar», con Escape y tocando afuera; la base queda como estaba.
// En el PC no hay hoja: los mismos enlaces van en la columna derecha de la base (lámina 3.3-base-pc), con `EnlacesBase`.
// Las preguntas se abren en la ventana de documentos, sobre la base.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MENU_COPY, URL_DOCUMENTOS, urlWhatsapp } from "@/lib/invierte-v2/base";
import { URL_PERFIL } from "@/lib/invierte-v2/destino";
import { PREGUNTAS_INVIERTE, TITULO_PREGUNTAS_INVIERTE } from "@/lib/invierte-v2/preguntas";
import { ListaPreguntas, VentanaDocumento } from "./VentanaDocumento";

const M = MENU_COPY;

function Flecha() {
  return <span className="iv2-menu-flecha" aria-hidden="true">›</span>;
}

export function MenuBase({ nombre, perfilLinea, whatsapp }: { nombre: string | null; perfilLinea: string; whatsapp: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [preguntas, setPreguntas] = useState(false);
  const caja = useRef<HTMLElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !preguntas) { e.stopImmediatePropagation(); setAbierto(false); } };
    window.addEventListener("keydown", esc, true);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    caja.current?.focus({ preventScroll: true });
    return () => { window.removeEventListener("keydown", esc, true); document.body.style.overflow = antes; };
  }, [abierto, preguntas]);

  function cerrar() {
    setAbierto(false);
    boton.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <button ref={boton} type="button" className="iv2-menu-boton" aria-label="Menú" aria-haspopup="dialog" aria-expanded={abierto} onClick={() => setAbierto(true)} data-inv2="menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {abierto && (
        <div className="inv-velo iv2-menu-velo" onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }} data-inv2="hoja-menu">
          <section ref={caja} tabIndex={-1} className="iv2-menu" role="dialog" aria-modal="true" aria-labelledby="iv2-menu-t">
            <span className="iv2-menu-asa" aria-hidden="true" />
            <div className="iv2-menu-cab">
              <h2 className="iv2-menu-t" id="iv2-menu-t">{nombre ?? M.perfil}</h2>
              <button type="button" className="iv2-menu-cerrar" onClick={cerrar} data-inv2="menu-cerrar">{M.cerrar}</button>
            </div>
            <nav aria-label="Menú de tu inversión">
              <Link href={URL_PERFIL} className="iv2-menu-item" data-inv2="menu-perfil">
                <span className="iv2-menu-txt"><span className="iv2-menu-it">{M.perfil}</span>{perfilLinea && <span className="iv2-menu-s">{perfilLinea}</span>}</span><Flecha />
              </Link>
              <Link href={URL_DOCUMENTOS} className="iv2-menu-item" data-inv2="menu-documentos">
                <span className="iv2-menu-txt"><span className="iv2-menu-it">{M.documentos}</span><span className="iv2-menu-s">{M.documentosLinea}</span></span><Flecha />
              </Link>
              <button type="button" className="iv2-menu-item" onClick={() => setPreguntas(true)} aria-haspopup="dialog" data-inv2="menu-preguntas">
                <span className="iv2-menu-txt"><span className="iv2-menu-it">{M.preguntas}</span><span className="iv2-menu-s">{M.preguntasLinea}</span></span><Flecha />
              </button>
              {whatsapp && (
                <a href={urlWhatsapp(whatsapp)} target="_blank" rel="noopener noreferrer" className="iv2-menu-item" data-inv2="menu-escribirle">
                  <span className="iv2-menu-txt"><span className="iv2-menu-it">{M.escribirle}</span><span className="iv2-menu-s">{M.escribirleLinea}</span></span><Flecha />
                </a>
              )}
            </nav>
          </section>
        </div>
      )}
      {preguntas && (
        <VentanaDocumento nombre="preguntas" titulo={TITULO_PREGUNTAS_INVIERTE} variante="lista" alCerrar={() => setPreguntas(false)}>
          <ListaPreguntas preguntas={PREGUNTAS_INVIERTE} />
        </VentanaDocumento>
      )}
    </>
  );
}

/** Los enlaces del menú en la columna derecha de la base, en el PC (lámina 3.3-base-pc): perfil, documentos, preguntas
 *  frecuentes y escribirle (las preguntas las sumó Fabrizio el 19-nov-2026: la lámina las omitió). */
export function EnlacesBase({ whatsapp }: { whatsapp: string | null }) {
  const [preguntas, setPreguntas] = useState(false);
  return (
    <nav className="iv2-enlaces-base" aria-label="Más de tu inversión" data-inv2="enlaces-base">
      <Link href={URL_PERFIL} className="iv2-enlace-fila" data-inv2="pc-perfil">{M.perfil}</Link>
      <Link href={URL_DOCUMENTOS} className="iv2-enlace-fila" data-inv2="pc-documentos">{M.documentos}</Link>
      <button type="button" className="iv2-enlace-fila" onClick={() => setPreguntas(true)} aria-haspopup="dialog" data-inv2="pc-preguntas">{M.preguntas}</button>
      {whatsapp && <a href={urlWhatsapp(whatsapp)} target="_blank" rel="noopener noreferrer" className="iv2-enlace-fila" data-inv2="pc-escribirle">{M.escribirle}</a>}
      {preguntas && (
        <VentanaDocumento nombre="preguntas" titulo={TITULO_PREGUNTAS_INVIERTE} variante="lista" alCerrar={() => setPreguntas(false)}>
          <ListaPreguntas preguntas={PREGUNTAS_INVIERTE} />
        </VentanaDocumento>
      )}
    </nav>
  );
}
