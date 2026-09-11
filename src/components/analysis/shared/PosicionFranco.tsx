"use client";

import { useRef, useState, type ReactNode } from "react";
import { usePostHog } from "posthog-js/react";
import { Modal } from "@/components/analysis/hallazgos/vocabulario";
import type { TipoInforme } from "@/components/analysis/informeTelemetry";
import { useRediseno } from "@/components/analysis/RedisenoContexto";

/**
 * "La posición de Franco" — la única caja del hero (contrato CONGELADO, T2), con la
 * firma y el footer "Lo que te separa" / "Cuánto aguanta" que abre el modal de vías.
 *
 * En LTR v21 se llama "Lo que haría yo" y absorbe la prosa de negociación (que dejó
 * de ser capítulo aparte) más el chip con el precio objetivo. Los dos son props
 * OPCIONALES: STR y el camino de prosa vieja la montan como siempre, con el mismo
 * DOM byte a byte.
 * Extraída de HeroLTR en T1 (04-sep-2026) para que STR la monte con el mismo DOM y la
 * misma telemetría (`informe_posicion_abierta` con `tipo` por prop, un disparo por
 * montaje). Presentacional: el caller trae la caja IA ya renderizada (plumón), la
 * fecha de la firma y el cuerpo del modal.
 */
export type FooterPosicion = {
  /** Destino que se reporta en telemetría ("distanciaVeredicto" · "sensibilidad"). */
  key: string;
  /** Rótulo mono del footer ("Lo que te separa del veredicto de arriba"). */
  k: string;
  /** Línea bajo el rótulo ("Franco probó cuatro ajustes. Tres mueven el veredicto."). */
  l: string;
  /** Texto del botón, sin la flecha ("Ver ajustes"). */
  btn: string;
  /** Bajada del modal. */
  sub?: ReactNode;
  cuerpo: ReactNode;
};

export function PosicionFranco({
  cajaAccionable,
  bloque,
  prosa,
  chip,
  extraPopup,
  fechaFirma,
  footer,
  tipo,
  veredicto,
  titulo = "La posición de Franco",
  className = "pb-2 md:ml-9",
  bajada,
}: {
  cajaAccionable: ReactNode | null;
  /**
   * Cuerpo DETERMINISTA (v22.1): las palancas con su chip, el mix y el descarte, que
   * el motor calcula y esta caja dibuja. Va ARRIBA de todo lo demás porque es la
   * respuesta; la prosa que quede abajo es contexto, no la posición.
   */
  bloque?: ReactNode;
  /** Cuerpo que ENTRA ANTES de la caja (v21: el argumento de negociación). */
  prosa?: ReactNode;
  /** Chip mono a la derecha del título (v21: el precio objetivo del plan). */
  chip?: ReactNode;
  /** Se agrega al final del POP-UP, después del cuerpo del footer. Lo usa la
   *  alternativa de comunas (§5): la línea de la card nombra dos comunas y el
   *  detalle de por qué vive acá, que es donde el lector viene a ver qué se probó. */
  extraPopup?: ReactNode;
  fechaFirma?: string;
  footer: FooterPosicion | null;
  tipo: TipoInforme;
  veredicto: string;
  titulo?: string;
  /** Cuelga del texto del título (md:ml-9) igual que la prosa del hero. */
  className?: string;
  /** Contrato §5: la bajada bajo el título. La arma el caller, que es quien tiene el
   *  estado — «Para que el veredicto pase a Comprar», «Cierra al precio pedido» o
   *  «No hay forma de que este departamento convenga». Esta pieza es presentacional. */
  bajada?: string;
}) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const rediseno = useRediseno();
  // Evento propio de la posición de Franco: su apertura NO es un hallazgo (la
  // distancia al veredicto está excluida de la pirámide por diseño), así que
  // colgaba de `informe_drawer_abierto` sin par de hallazgo. Tiene su propia serie.
  const posthog = usePostHog();
  const posicionMedida = useRef(false);
  const abrirPosicion = () => {
    if (posicionMedida.current) return;
    posicionMedida.current = true;
    try {
      posthog?.capture("informe_posicion_abierta", { veredicto, tipo, destino: footer?.key });
    } catch {
      /* la telemetría jamás rompe la lectura */
    }
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      (window.__informeEvents ??= []).push({
        name: "informe_posicion_abierta",
        props: { veredicto, tipo, destino: footer?.key },
      });
    }
  };
  if (!cajaAccionable && !prosa && !bloque && !footer) return null;
  if (rediseno) {
    return (
      <>
        {/* EL ANCHO ES EL DEL INFORME (contrato §2). El default «md:ml-9» cuelga la caja
            del texto del título, que es como se leía cuando la recomendación vivía DENTRO
            del hero. Es una sección del informe, y colgada quedaba 36 px más angosta y
            desalineada contra todas las demás. El gate va acá y no en el default de la
            firma para que STR —que usa ese mismo default y no entra nunca en esta rama—
            no se mueva ni un píxel. Se filtra por token y no por regex para no morder
            una clase que lo contenga como prefijo. */}
        <div className={className.split(" ").filter((c) => c !== "md:ml-9").join(" ")}>
          {/* ES LA ÚNICA PIEZA CUYO FONDO DEPENDE DEL VEREDICTO (contrato §5): del tono
              profundo del veredicto a tinta. El hero usa el mismo espectro para los tres
              justamente para que esta caja pueda no hacerlo. El filtro va en la capa,
              nunca sobre el texto — misma razón que en el hero. */}
          <div className="rec-card" data-verdict={veredicto}>
            <div className="rec-bg" aria-hidden="true" />
            <div className="rec-grain" aria-hidden="true" />
            <p className="rec-t">{titulo}</p>
            {bajada && <p className="rec-sub">{bajada}</p>}
            {bloque}
            {/* SIN FIRMA Y SIN «análisis generado por IA» (contrato §5): la recomendación
                es del informe, no de un narrador, y la línea de la IA acá pedía leer la
                caja como una opinión. */}
            {footer && (
              <button
                type="button"
                className="rec-cta"
                onClick={() => {
                  abrirPosicion();
                  setModalAbierto(true);
                }}
              >
                <span className="rec-cta-ico" aria-hidden="true">▶</span>
                {footer.btn}
              </button>
            )}
          </div>
        </div>
        {footer && (
          <Modal abierto={modalAbierto} onClose={() => setModalAbierto(false)} titulo={footer.k} sub={footer.sub}>
            <div className="doc-tokens">
              {footer.cuerpo}
              {extraPopup}
            </div>
          </Modal>
        )}
      </>
    );
  }
  return (
    <>
      <div className={className}>
        <div className="pos-card">
          <div className="pos-main">
            <span className="pos-t">
              {titulo}
              {chip && <em className="pos-chip">{chip}</em>}
            </span>
            {bloque}
            {prosa && <div className="pos-p">{prosa}</div>}
            {cajaAccionable && <div className="pos-p">{cajaAccionable}</div>}
            <div className="pos-firma">
              <span className="doc-fmark-inline shrink-0 select-none" aria-hidden="true" style={{ width: 22, height: 22, fontSize: 10 }}>
                f.
              </span>
              <span>
                Franco
                <small>Análisis generado por IA{fechaFirma ? ` · ${fechaFirma}` : ""}</small>
              </span>
            </div>
          </div>
          {footer && (
            <div className="pos-foot">
              <div>
                <span className="k">{footer.k}</span>
                <span className="l">{footer.l}</span>
              </div>
              <button
                type="button"
                className="doc-btn"
                onClick={() => {
                  abrirPosicion();
                  setModalAbierto(true);
                }}
              >
                {footer.btn} →
              </button>
            </div>
          )}
        </div>
      </div>
      {footer && (
        <Modal abierto={modalAbierto} onClose={() => setModalAbierto(false)} titulo={footer.k} sub={footer.sub}>
          {/* .doc-tokens: los cuerpos de los drawers resuelven --doc-* también fuera de .doc-dictamen */}
          <div className="doc-tokens">{footer.cuerpo}</div>
        </Modal>
      )}
    </>
  );
}
