"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL POP-UP DESPUÉS DE «ANALIZAR» (03-nov-2026, regla y texto en lib/guia/informe-en-camino.ts). Reemplaza al cuerpo del aviso
// antes de analizar sin cerrarlo: «Generando el informe de [depto]…» con su barra; listo, abre el informe solo; a los 10 s,
// «Abrir informe» como un enlace de verdad (si la apertura del router se trabó, el enlace igual navega); si salió otro veredicto,
// lo dice antes de abrir; si falló, lo dice con palabras. Mientras genera no se cierra: ni la X ni Escape.
// Y EL AVISO DE ARRIBA (InformeListoAviso): si se cerró con el informe listo sin abrirlo, «Tu informe de [depto] está listo ·
// Abrirlo», que no se cierra solo.
// Y LA VUELTA DEL PAGO DESDE UN DEPTO (InformeEnLaVuelta, 03-nov-2026): la misma regla sin pop-up, debajo de «Pago confirmado.».
// Mide: `analisis_apertura_fallida` cuando el informe estaba listo y la página seguía acá 10 s después de pedir abrirlo; el
// tiempo hasta el informe lo cuenta el informe (lib/informe-visto.ts › registrarInformeVisto, con el viaje anotado acá).
// Abrirlo solo y medir viven en useInformeEnCamino, el mismo para el pop-up y para la vuelta.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { usePostHog } from "@/lib/posthog-react";
import {
  APERTURA_FALLIDA_TRAS_MS, EVENTO_APERTURA_FALLIDA, INFORME_COPY, anotarViaje, avance, cerrable, desdeDeRuta, lugarDeDesde, muestraAbrir, textoFallo,
  type DesdeInforme, type LugarInforme, type PasoInforme, type ViaInforme,
} from "@/lib/guia/informe-en-camino";
import { RETORNO } from "@/lib/compra/compra";
import { PLANO } from "@/components/plano/plano";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import "@/components/formulario-v4/wizard-v4.css";
import "./informe-en-camino.css";

const almacen = (): Storage | null => { try { return window.sessionStorage; } catch { return null; } };

/** LO QUE CORRE MIENTRAS EL INFORME VIENE EN CAMINO, en el pop-up y en la vuelta del pago: el reloj de la barra y de «Abrir
 *  informe»; listo, lo abre solo, una vez por informe, con el viaje anotado para medir cuánto tardó en verse; y si la página
 *  sigue acá 10 s después de pedir abrirlo, la apertura fallida. `desde`: de dónde se analizó (sin él, de la página);
 *  `reemplazar`: la vuelta del pago abre el informe EN SU LUGAR (atrás no vuelve a la vuelta, que lo pediría otra vez). */
export function useInformeEnCamino(paso: PasoInforme, { desde, reemplazar = false }: { desde?: DesdeInforme; reemplazar?: boolean } = {}) {
  const router = useRouter();
  const posthog = usePostHog();
  const [ahora, setAhora] = useState(() => Date.now());
  const abierto = useRef<string | null>(null);

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
    anotarViaje(almacen(), { id: paso.id, t0: paso.t0, desde: desde ?? desdeDeRuta(window.location.pathname), via: "auto" });
    try { if (reemplazar) router.replace(paso.ruta); else router.push(paso.ruta); } catch { /* «Abrir informe» lo cubre */ }
  }, [paso, router, desde, reemplazar]);

  // Listo y la página sigue acá 10 s después de pedir abrirlo: la apertura automática falló.
  useEffect(() => {
    if (paso.paso !== "listo") return;
    const falta = APERTURA_FALLIDA_TRAS_MS - (Date.now() - paso.listoEn);
    const t = window.setTimeout(() => {
      try {
        posthog?.capture(EVENTO_APERTURA_FALLIDA, { analysis_id: paso.id, desde: desde ?? desdeDeRuta(window.location.pathname), ms_desde_listo: Date.now() - paso.listoEn, ms_desde_analizar: Date.now() - paso.t0 });
      } catch { /* sin PostHog */ }
    }, Math.max(0, falta));
    return () => window.clearTimeout(t);
    // Una vez por informe listo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso.paso, id]);

  // Abrir a mano (el enlace navega igual si el router se trabó): se anota cómo se abrió.
  const anotar = (via: ViaInforme) => { if (id) anotarViaje(almacen(), { id, t0: paso.t0, desde: desde ?? desdeDeRuta(window.location.pathname), via }); };
  return { ahora, anotar };
}

export function InformeEnCamino({ paso, alCerrar, alReintentar = null }: {
  paso: PasoInforme;
  /** Cerrar: solo cuando se puede (cerrable); con el informe listo, quien lo monta deja el aviso de arriba. */
  alCerrar: () => void;
  /** Tras un fallo: volver a intentar con lo mismo. */
  alReintentar?: (() => void) | null;
}) {
  const { ahora, anotar } = useInformeEnCamino(paso);
  const primario = useRef<HTMLElement | null>(null);
  const puedeCerrar = cerrable(paso, ahora);

  // Escape cierra solo cuando se puede, y no sigue de largo: la tarjeta de atrás (que escucha Escape en `window`) no se cierra
  // por debajo del pop-up (cazado en el QA del preview, 03-nov-2026). El foco va al botón que aparece.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (puedeCerrar) alCerrar(); } };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [puedeCerrar, alCerrar]);
  const conAbrir = muestraAbrir(paso, ahora);
  useEffect(() => { primario.current?.focus(); }, [conAbrir, paso.paso]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <PopupInforme paso={paso} ahora={ahora} lugar={lugarDeDesde(desdeDeRuta(window.location.pathname))} alCerrar={alCerrar} alReintentar={alReintentar} alAbrir={() => anotar("boton")} refPrimario={(el) => { primario.current = el; }} />,
    document.body,
  );
}

/** LO QUE SE VE (sin portal ni reloj propio: el tier INFORME-EN-CAMINO lo dibuja con la hora que quiere). */
export function PopupInforme({ paso, ahora, lugar = "mapa", alCerrar, alReintentar = null, alAbrir, refPrimario }: {
  paso: PasoInforme;
  ahora: number;
  /** Dónde se analizó: el que se dio de baja dice de dónde se saca (el mapa, la selección o la lista de la guía). */
  lugar?: LugarInforme;
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
              <h2 id="informe-en-camino-titulo" className="ie-titulo" role="alert" data-informe="fallo-titulo">{textoFallo(paso.motivo, lugar).titulo}</h2>
              <p className="ie-texto" data-informe="fallo-que">{textoFallo(paso.motivo, lugar).que}</p>
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

/** LA VUELTA DEL PAGO DESDE UN DEPTO (03-nov-2026): la misma regla sin pop-up, debajo de «Pago confirmado.» (el estado C del mockup
 *  4-ticket-y-popups.html): «Franco está analizando [depto]. En unos segundos se abre el informe.» con la barra de avance y
 *  cuántos le quedan; listo, lo abre en su lugar; a los 10 s, «Abrir informe»; si salió otro veredicto, lo dice antes; si no
 *  salió, lo dice con palabras y qué hacer, ahí mismo: ya no manda al dashboard a intentarlo de nuevo. */
export function InformeEnLaVuelta({ paso, saldo, alReintentar }: { paso: PasoInforme; saldo: number | null; alReintentar: () => void }) {
  const { ahora, anotar } = useInformeEnCamino(paso, { desde: "pago", reemplazar: true });
  return <VueltaInforme paso={paso} ahora={ahora} saldo={saldo} alReintentar={alReintentar} alAbrir={() => anotar("boton")} />;
}

/** LO QUE SE VE EN LA VUELTA (sin reloj propio: el tier INFORME-EN-CAMINO lo dibuja con la hora que quiere). */
export function VueltaInforme({ paso, ahora, saldo = null, alReintentar = null, alAbrir }: {
  paso: PasoInforme;
  ahora: number;
  /** Los análisis de la cuenta contando este (`null` = no se sabe): «Te quedan N para cualquier otro depto». */
  saldo?: number | null;
  alReintentar?: (() => void) | null;
  alAbrir?: () => void;
}) {
  const conAbrir = muestraAbrir(paso, ahora);
  // La vuelta del pago es de un depto de la selección.
  const fallo = paso.paso === "fallo" ? textoFallo(paso.motivo, "seleccion") : null;
  const reintenta = paso.paso === "fallo" && paso.motivo === "error" && !!alReintentar;
  const pct = Math.round(avance(paso, ahora) * 100);
  return (
    <div data-informe={paso.paso} data-motivo={paso.paso === "fallo" ? paso.motivo : undefined}>
      {(paso.paso === "generando" || paso.paso === "listo") && (
        <>
          <p className={PLANO.bajada} data-retorno="al-depto">{RETORNO.desdeDepto.antes}<b className="text-[var(--franco-text)]">{paso.depto}</b>{RETORNO.desdeDepto.despues}</p>
          {/* La barra del pop-up: avanza de verdad y va en tinta (el rojo es para comprar, la oferta y el regalo). */}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--franco-border)]" role="progressbar" aria-label={INFORME_COPY.generando(paso.depto)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} data-retorno-barra data-informe="barra">
            <div className="h-1.5 rounded-full bg-[var(--franco-text)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          {saldo != null && saldo > 0 && <p className="mt-2 text-[12px] text-[var(--franco-text-secondary)]" data-retorno="quedan">{RETORNO.quedanOtros(saldo - 1)}</p>}
        </>
      )}
      {paso.paso === "distinto" && (
        <>
          <p className={PLANO.bajada}>{INFORME_COPY.listo(paso.depto)}.</p>
          <p className="mt-2 text-[15px] leading-[1.5] text-[var(--franco-text)]" role="status" data-informe="distinto">{INFORME_COPY.distinto(paso.hoy, paso.esperado)}</p>
        </>
      )}
      {fallo && (
        <>
          <p className="mt-2 text-[15px] font-semibold leading-[1.45] text-[var(--franco-text)]" role="alert" data-informe="fallo-titulo">{fallo.titulo}</p>
          <p className={PLANO.bajada} data-informe="fallo-que">{fallo.que}</p>
        </>
      )}
      {conAbrir && (paso.paso === "listo" || paso.paso === "distinto") && (
        <div className={PLANO.seccion}>
          <a href={paso.ruta} className={PLANO.principal} onClick={alAbrir} data-informe="abrir">{paso.paso === "distinto" ? INFORME_COPY.verCompleto : INFORME_COPY.abrir}</a>
        </div>
      )}
      {fallo && (
        <div className={`${PLANO.seccion} flex flex-col gap-3`}>
          {reintenta && <button type="button" className={PLANO.principal} onClick={alReintentar ?? undefined} data-informe="reintentar">{INFORME_COPY.reintentar}</button>}
          <EnlaceCarga href="/dashboard" className={reintenta ? PLANO.secundario : PLANO.principal} data-informe="fallo-volver">{RETORNO.volverDeptos}</EnlaceCarga>
        </div>
      )}
    </div>
  );
}
