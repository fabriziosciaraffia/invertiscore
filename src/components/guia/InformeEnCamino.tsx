"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL POP-UP DESPUÉS DE «ANALIZAR» (03-nov-2026, regla y texto en lib/guia/informe-en-camino.ts). Reemplaza al cuerpo del aviso
// antes de analizar sin cerrarlo: «Generando el informe de [depto]…» con su barra; listo, abre el informe solo; a los 10 s,
// «Abrir informe» como un enlace de verdad (si la apertura del router se trabó, el enlace igual navega); si salió otro veredicto,
// lo dice antes de abrir; si falló, lo dice con palabras. Mientras genera no se cierra: ni la X ni Escape.
// Y EL AVISO DE ARRIBA (InformeListoAviso): si se cerró con el informe listo sin abrirlo, «Tu informe de [depto] está listo ·
// Abrirlo», que no se cierra solo.
// Mide: `analisis_apertura_fallida` cuando el informe estaba listo y la página seguía acá 10 s después de pedir abrirlo; el
// tiempo hasta el informe lo cuenta el informe (lib/informe-visto.ts › registrarInformeVisto, con el viaje anotado acá).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { usePostHog } from "@/lib/posthog-react";
import {
  APERTURA_FALLIDA_TRAS_MS, EVENTO_APERTURA_FALLIDA, INFORME_COPY, anotarViaje, avance, cerrable, desdeDeRuta, muestraAbrir, textoFallo,
  type PasoInforme, type ViaInforme,
} from "@/lib/guia/informe-en-camino";
import "@/components/formulario-v4/wizard-v4.css";
import "./informe-en-camino.css";

const almacen = (): Storage | null => { try { return window.sessionStorage; } catch { return null; } };

export function InformeEnCamino({ paso, alCerrar, alReintentar = null }: {
  paso: PasoInforme;
  /** Cerrar: solo cuando se puede (cerrable); con el informe listo, quien lo monta deja el aviso de arriba. */
  alCerrar: () => void;
  /** Tras un fallo: volver a intentar con lo mismo. */
  alReintentar?: (() => void) | null;
}) {
  const router = useRouter();
  const posthog = usePostHog();
  const [ahora, setAhora] = useState(() => Date.now());
  const primario = useRef<HTMLElement | null>(null);
  const abierto = useRef<string | null>(null);
  const puedeCerrar = cerrable(paso, ahora);

  // El reloj de la barra y de «Abrir informe».
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  // Listo: se abre solo, una vez por informe. El viaje queda anotado para medir cuánto tardó en verse.
  const id = paso.paso === "listo" || paso.paso === "distinto" ? paso.id : null;
  useEffect(() => {
    if (paso.paso !== "listo" || abierto.current === paso.id) return;
    abierto.current = paso.id;
    anotarViaje(almacen(), { id: paso.id, t0: paso.t0, desde: desdeDeRuta(window.location.pathname), via: "auto" });
    try { router.push(paso.ruta); } catch { /* «Abrir informe» lo cubre */ }
  }, [paso, router]);

  // Listo y la página sigue acá 10 s después de pedir abrirlo: la apertura automática falló.
  useEffect(() => {
    if (paso.paso !== "listo") return;
    const falta = APERTURA_FALLIDA_TRAS_MS - (Date.now() - paso.listoEn);
    const t = window.setTimeout(() => {
      try {
        posthog?.capture(EVENTO_APERTURA_FALLIDA, { analysis_id: paso.id, desde: desdeDeRuta(window.location.pathname), ms_desde_listo: Date.now() - paso.listoEn, ms_desde_analizar: Date.now() - paso.t0 });
      } catch { /* sin PostHog */ }
    }, Math.max(0, falta));
    return () => window.clearTimeout(t);
    // Una vez por informe listo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso.paso, id]);

  // Escape cierra solo cuando se puede; el foco va al botón que aparece.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); if (puedeCerrar) alCerrar(); } };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [puedeCerrar, alCerrar]);
  const conAbrir = muestraAbrir(paso, ahora);
  useEffect(() => { primario.current?.focus(); }, [conAbrir, paso.paso]);

  // Abrir a mano (el enlace navega igual si el router se trabó): se anota cómo se abrió.
  const anotar = (via: ViaInforme) => { if (id) anotarViaje(almacen(), { id, t0: paso.t0, desde: desdeDeRuta(window.location.pathname), via }); };

  if (typeof document === "undefined") return null;
  return createPortal(
    <PopupInforme paso={paso} ahora={ahora} alCerrar={alCerrar} alReintentar={alReintentar} alAbrir={() => anotar("boton")} refPrimario={(el) => { primario.current = el; }} />,
    document.body,
  );
}

/** LO QUE SE VE (sin portal ni reloj propio: el tier INFORME-EN-CAMINO lo dibuja con la hora que quiere). */
export function PopupInforme({ paso, ahora, alCerrar, alReintentar = null, alAbrir, refPrimario }: {
  paso: PasoInforme;
  ahora: number;
  alCerrar: () => void;
  alReintentar?: (() => void) | null;
  alAbrir?: () => void;
  refPrimario?: (el: HTMLElement | null) => void;
}) {
  const puedeCerrar = cerrable(paso, ahora);
  const conAbrir = muestraAbrir(paso, ahora);
  const enCurso = paso.paso === "generando" || paso.paso === "listo";
  const fallo = paso.paso === "fallo";
  const reintenta = fallo && paso.motivo === "error" && !!alReintentar;
  return (
    <div className="wz4 wz-modal-velo wz-modal-velo-compacto" style={{ height: "100dvh" }} role="dialog" aria-modal="true" aria-labelledby="informe-en-camino-titulo" data-informe={paso.paso} data-motivo={fallo ? paso.motivo : undefined}>
      <div className="wz-modal wz-modal-compacto ie">
        <div className="wz-modal-mc">
          <div className="wz-modal-mt">
            <span className="ie-cab">{INFORME_COPY.cabecera}</span>
            {/* Mientras genera, sin X: nunca se vuelve a la lista o al mapa en silencio. */}
            {puedeCerrar && (
              <button type="button" onClick={alCerrar} aria-label={INFORME_COPY.cerrar} className="wz-disco" data-informe="cerrar">×</button>
            )}
          </div>
          {enCurso && (
            <>
              <h2 id="informe-en-camino-titulo" className="ie-titulo" data-informe="titulo">{paso.paso === "listo" ? INFORME_COPY.abriendo(paso.depto) : INFORME_COPY.generando(paso.depto)}</h2>
              {/* La barra del wizard (wz-barra): la misma tinta que el resto del pop-up. */}
              <div className="wz-barra ie-barra" role="progressbar" aria-label={INFORME_COPY.generando(paso.depto)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(avance(paso, ahora) * 100)} data-informe="barra">
                <i style={{ width: `${Math.round(avance(paso, ahora) * 100)}%` }} />
              </div>
            </>
          )}
          {paso.paso === "distinto" && (
            <>
              <h2 id="informe-en-camino-titulo" className="ie-titulo">{INFORME_COPY.listo(paso.depto)}</h2>
              <p className="ie-texto" role="status" data-informe="distinto">{INFORME_COPY.distinto(paso.hoy, paso.esperado)}</p>
            </>
          )}
          {fallo && (
            <>
              <h2 id="informe-en-camino-titulo" className="ie-titulo" role="alert" data-informe="fallo-titulo">{textoFallo(paso.motivo).titulo}</h2>
              <p className="ie-texto" data-informe="fallo-que">{textoFallo(paso.motivo).que}</p>
            </>
          )}
        </div>
        {(conAbrir || fallo) && (
          <div className="wz-modal-mb">
            {/* En tinta, no en rojo: abrir el informe no compra nada (el rojo es para comprar, la oferta y el regalo). */}
            {conAbrir && (paso.paso === "listo" || paso.paso === "distinto") && (
              <a ref={refPrimario} href={paso.ruta} className="wz-btn2 tinta ie-abrir" onClick={alAbrir} data-informe="abrir">
                {paso.paso === "distinto" ? INFORME_COPY.verCompleto : INFORME_COPY.abrir}
              </a>
            )}
            {reintenta && (
              <button ref={refPrimario} type="button" className="wz-btn2 tinta" onClick={alReintentar ?? undefined} data-informe="reintentar">{INFORME_COPY.reintentar}</button>
            )}
            {fallo && (
              <button ref={reintenta ? undefined : refPrimario} type="button" className={reintenta ? "wz-modal-cancelar" : "wz-btn2 tinta"} onClick={alCerrar} data-informe="fallo-cerrar">{INFORME_COPY.cerrar}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** EL AVISO DE ARRIBA: el informe quedó listo y no se abrió. No se cierra solo; la X lo quita. */
export function InformeListoAviso({ depto, ruta, id, t0, alCerrar }: { depto: string; ruta: string; id: string; t0: number; alCerrar: () => void }) {
  return (
    <p className="ie-aviso" role="status" data-informe="aviso-listo">
      <span>{INFORME_COPY.listo(depto)} · </span>
      <a href={ruta} onClick={() => anotarViaje(almacen(), { id, t0, desde: desdeDeRuta(window.location.pathname), via: "aviso" })} data-informe="aviso-abrir">{INFORME_COPY.abrirlo}</a>
      <button type="button" className="ie-aviso-x" aria-label={INFORME_COPY.cerrar} onClick={alCerrar} data-informe="aviso-cerrar">×</button>
    </p>
  );
}
