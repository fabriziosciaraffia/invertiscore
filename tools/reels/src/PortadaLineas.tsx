import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont as cargarSerif } from "@remotion/google-fonts/SourceSerif4";
import { COLOR_L, FONDO_LINEAS, px } from "./lineas";

const { fontFamily: SERIF } = cargarSerif();

export type PropsPortada = {
  /** El resaltado se pinta en rojo donde aparezca dentro del texto. */
  texto: string;
  resaltado: string;
};

/**
 * Portada estática del reel — réplica de `ref/portada-reel-v3.html`. Es una composición
 * de un cuadro: se exporta con `remotion still`, no se renderiza a video.
 */
export const PortadaLineas: React.FC<PropsPortada> = ({ texto, resaltado }) => {
  const [antes, despues] = texto.split(resaltado);
  return (
    <AbsoluteFill style={{ background: FONDO_LINEAS }}>
      <div
        style={{
          position: "absolute",
          left: px(26),
          right: px(22),
          top: "50%",
          transform: "translateY(-52%)",
          fontFamily: SERIF,
          fontWeight: 700,
          fontSize: px(56),
          lineHeight: 1.1,
          letterSpacing: "-0.015em",
          color: COLOR_L.ink,
        }}
      >
        {antes}
        <span style={{ color: COLOR_L.rojo }}>{resaltado}</span>
        {despues}
      </div>
      <div
        style={{
          position: "absolute",
          right: px(26),
          bottom: px(26),
          fontFamily: SERIF,
          fontSize: px(13),
          color: COLOR_L.ink,
          opacity: 0.85,
        }}
      >
        <span style={{ fontStyle: "italic", fontWeight: 400, color: COLOR_L.tx3 }}>re</span>
        <b style={{ fontWeight: 700 }}>franco</b>
        <span style={{ color: COLOR_L.rojo, fontSize: px(9), fontWeight: 600 }}>.ai</span>
      </div>
    </AbsoluteFill>
  );
};

export const PROPS_PORTADA_POR_DEFECTO = {
  texto: "La comuna que más rindió por plusvalía en la última década.",
  resaltado: "plusvalía",
};
