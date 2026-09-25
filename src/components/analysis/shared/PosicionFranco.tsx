"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChipVeredicto } from "./ChipVeredicto";
import { usePostHog } from "posthog-js/react";
import { Modal } from "@/components/analysis/hallazgos/vocabulario";
import type { TipoInforme } from "@/components/analysis/informeTelemetry";
import { BAJADA_RECOMENDACION, type EstadoRecomendacion } from "@/lib/lo-que-haria-yo";

/**
 * "La posición de Franco" — la única caja del hero (contrato CONGELADO, T2), con la
 * firma y el footer "Lo que te separa" / "Cuánto aguanta" que abre el modal de vías.
 *
 * En LTR v21 absorbe la prosa de negociación (que dejó de ser capítulo aparte) más el
 * chip con el precio objetivo. Los dos son props OPCIONALES: STR y la prosa vieja no
 * los pasan.
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

/**
 * UNA PUERTA PROPIA, y la historia de por qué (17-sep-2026).
 *
 * La tabla «Dónde sí convendría» —el mismo depto corrido en las otras comunas, con lo
 * que cuesta y lo que renta en cada una— se montaba DENTRO del modal del footer, después
 * del cuerpo del pop-up de ajustes, con un prop `extraPopup` que era un ReactNode suelto.
 * Nunca fue una decisión: era el único modal que había a mano.
 *
 * El 17-sep el pop-up de ajustes dejó de dibujarse en 237 filas —correctamente, porque
 * ahí no hay ningún ajuste que llegue a COMPRAR— y se llevó la tabla puesta. Medido: 35
 * filas LTR quedaron con la línea «En Puente Alto un departamento como este sí
 * convendría» en la card, que por contrato va SIN cifras porque las cifras vivían en la
 * tabla, y sin ninguna superficie donde verlas. Apagar una apagó la otra.
 *
 * Son dos preguntas distintas —«qué se probó acá» y «dónde sí convendría»— y ahora cada
 * una tiene su botón y su modal. Que hoy sean excluyentes (medido: 0 filas del parque
 * encienden las dos) no las hace la misma puerta: las hacía la misma puerta el hecho de
 * que solo hubiera una.
 */
export type PuertaExtra = {
  /** Destino que se reporta en telemetría. */
  key: string;
  /** Título del modal. La pieza de adentro ya NO lo repite. */
  k: string;
  /** Texto del botón, sin la flecha. */
  btn: string;
  sub?: ReactNode;
  cuerpo: ReactNode;
};

export function PosicionFranco({
  cajaAccionable,
  bloque,
  prosa,
  puertaExtra,
  footer,
  tipo,
  veredicto,
  titulo = "La posición de Franco",
  className = "pb-2 md:ml-9",
  estado,
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
  /** LA SEGUNDA PUERTA, con su botón y su modal. La usa la alternativa de comunas (§5).
   *  Ver el acta de `PuertaExtra`: hasta el 17-sep esto era un ReactNode que viajaba
   *  dentro del modal del footer, y por eso apagar el pop-up apagaba la tabla. */
  puertaExtra?: PuertaExtra | null;
  fechaFirma?: string;
  footer: FooterPosicion | null;
  tipo: TipoInforme;
  veredicto: string;
  titulo?: string;
  /** Cuelga del texto del título (md:ml-9) igual que la prosa del hero. */
  className?: string;
  /** Contrato §5 revisado: la bajada bajo el título se dibuja SEGÚN EL ESTADO, que lo
   *  calcula el caller (`estadoRecomendacion`). Con salida lleva el texto y la píldora
   *  neutra «✓ COMPRAR»; COMPRAR y sin salida, solo el texto. El destino no viaja como
   *  string adentro de la bajada: esta pieza lo dibuja. */
  estado?: EstadoRecomendacion;
}) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalExtra, setModalExtra] = useState(false);
  // Evento propio de la posición de Franco: su apertura NO es un hallazgo (la
  // distancia al veredicto está excluida de la pirámide por diseño), así que
  // colgaba de `informe_drawer_abierto` sin par de hallazgo. Tiene su propia serie.
  const posthog = usePostHog();
  const posicionMedida = useRef(false);
  // EL DESTINO LO TRAE LA PUERTA QUE SE ABRIÓ. Con dos puertas, `footer?.key` ya no
  // describe el evento. El disparo sigue siendo UNO POR MONTAJE, como dice el acta de
  // arriba: si alguien abriera las dos, la serie cuenta la primera.
  const abrirPosicion = (destino: string | undefined) => {
    if (posicionMedida.current) return;
    posicionMedida.current = true;
    try {
      posthog?.capture("informe_posicion_abierta", { veredicto, tipo, destino });
    } catch {
      /* la telemetría jamás rompe la lectura */
    }
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      (window.__informeEvents ??= []).push({
        name: "informe_posicion_abierta",
        props: { veredicto, tipo, destino },
      });
    }
  };
  if (!cajaAccionable && !prosa && !bloque && !footer && !puertaExtra) return null;
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
            {estado && (
              <p className="rec-sub">
                {BAJADA_RECOMENDACION[estado]}
                {/* EL CHIP DE VEREDICTO ÚNICO (25-sep-2026), en su variante sobre fondo: la card
                    es oscura en los dos temas. Ver ChipVeredicto.tsx. */}
                {estado === "con_salida" && <ChipVeredicto v="COMPRAR" variante="sobre-fondo" />}
              </p>
            )}
            {bloque}
            {/* SIN FIRMA Y SIN «análisis generado por IA» (contrato §5): la recomendación
                es del informe, no de un narrador, y la línea de la IA acá pedía leer la
                caja como una opinión. */}
            {footer && (
              <button
                type="button"
                className="rec-cta"
                onClick={() => {
                  abrirPosicion(footer.key);
                  setModalAbierto(true);
                }}
              >
                <span className="rec-cta-ico" aria-hidden="true">▶</span>
                {footer.btn}
              </button>
            )}
            {/* EL SEGUNDO BOTÓN. Hoy no convive con el de arriba —son estados excluyentes
                y está medido en 0 filas— pero no cuelga de eso: cuelga de que exista su
                propia puerta, que es lo que evita que apagar una apague la otra. */}
            {puertaExtra && (
              <button
                type="button"
                className="rec-cta"
                onClick={() => {
                  abrirPosicion(puertaExtra.key);
                  setModalExtra(true);
                }}
              >
                <span className="rec-cta-ico" aria-hidden="true">▶</span>
                {puertaExtra.btn}
              </button>
            )}
          </div>
        </div>
        {footer && (
          <Modal abierto={modalAbierto} onClose={() => setModalAbierto(false)} titulo={footer.k} sub={footer.sub}>
            <div className="doc-tokens">{footer.cuerpo}</div>
          </Modal>
        )}
        {puertaExtra && (
          <Modal abierto={modalExtra} onClose={() => setModalExtra(false)} titulo={puertaExtra.k} sub={puertaExtra.sub}>
            <div className="doc-tokens">{puertaExtra.cuerpo}</div>
          </Modal>
        )}
      </>
    );
}
