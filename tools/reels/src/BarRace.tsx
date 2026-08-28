import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { loadFont as cargarSerif } from "@remotion/google-fonts/SourceSerif4";
import { loadFont as cargarSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as cargarMono } from "@remotion/google-fonts/JetBrainsMono";
import { COLOR, GUION, LIENZO, PISTA, SEGURO, filaY } from "./canon";
import {
  anioEnFrame,
  estadoEn,
  marcasEje,
  pulsoDeBeat,
  type Dataset,
  type Evento,
} from "./carrera";

// Las tres familias de la marca. Las tres son SIL OFL 1.1: el uso en video comercial
// está permitido y no exige atribución en pantalla.
const { fontFamily: SERIF } = cargarSerif();
const { fontFamily: SANS } = cargarSans();
const { fontFamily: MONO } = cargarMono();

export type Titular = {
  antetitulo: string;
  texto: string;
  /** Trozo exacto de `texto` que va en Signal Red. */
  resaltado: string;
}

export type TrozoPayoff = {
  t: string;
  fuerte?: boolean;
}

export type PropsBarRace = {
  dataset: Dataset;
  titular: Titular;
  payoff: TrozoPayoff[];
  /** Momentos que reciben pulso. Tienen que existir en dataset.eventos. */
  beats: Evento[];
  pieDerecho: string;
}

const fmt = (v: number) => (v >= 0 ? "+" : "") + Math.round(v) + "%";

export const BarRace: React.FC<PropsBarRace> = ({
  dataset,
  titular,
  payoff,
  beats,
  pieDerecho,
}) => {
  const frame = useCurrentFrame();

  // El reel no puede marcar un momento que el dato no tiene: `eventos` lo calcula el
  // generador desde la serie, no se escribe acá.
  for (const b of beats) {
    const existe = dataset.eventos.some(
      (e) => e.nombre === b.nombre && e.anio === b.anio && e.tipo === b.tipo,
    );
    if (!existe) {
      throw new Error(`beat inexistente en el dataset: ${b.nombre} ${b.anio} ${b.tipo}`);
    }
  }

  const anio = anioEnFrame(frame, dataset.anios);
  const estado = estadoEn(anio, dataset);
  const marcas = marcasEje(estado.xMax);

  const opHook = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const opPayoff = interpolate(frame, [GUION.carrera - 5, GUION.carrera + 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const altoPista = PISTA.n * PISTA.altoFila;
  const [antes, despues] = titular.texto.split(titular.resaltado);

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.papel }}>
      {/* ---------- TITULAR ---------- */}
      <div
        style={{
          position: "absolute",
          left: PISTA.x,
          top: 120,
          width: LIENZO.w - PISTA.x - 96,
          opacity: opHook,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 23,
            fontWeight: 500,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: COLOR.grisSuave,
            marginBottom: 22,
          }}
        >
          {titular.antetitulo}
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 58,
            fontWeight: 700,
            lineHeight: 1.18,
            letterSpacing: "-0.01em",
            color: COLOR.ink,
          }}
        >
          {antes}
          <span style={{ color: COLOR.rojo }}>{titular.resaltado}</span>
          {despues}
        </div>
      </div>

      {/* ---------- EJE ---------- */}
      <div
        style={{ position: "absolute", left: PISTA.x, top: PISTA.topeEje, width: PISTA.ancho }}
      >
        {marcas.map(({ v, op }) => {
          const x = (v / estado.xMax) * PISTA.ancho;
          return (
            <React.Fragment key={v}>
              <div
                style={{
                  position: "absolute",
                  left: x,
                  top: PISTA.altoEje,
                  width: 1,
                  height: altoPista,
                  backgroundColor: COLOR.grilla,
                  opacity: op,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: x,
                  top: 0,
                  transform: "translateX(-50%)",
                  fontFamily: MONO,
                  fontSize: 24,
                  color: COLOR.grisSuave,
                  opacity: op,
                  whiteSpace: "nowrap",
                }}
              >
                +{v}%
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* ---------- BARRAS ---------- */}
      <div
        style={{
          position: "absolute",
          left: PISTA.x,
          top: filaY(0),
          width: PISTA.ancho,
          height: altoPista,
        }}
      >
        {estado.filas.map((e) => {
          const pulso = pulsoDeBeat(e.fila.nombre, frame, beats, dataset.anios);
          const color =
            e.fila.grupo === "protagonista"
              ? COLOR.rojo
              : e.fila.grupo === "cara"
                ? COLOR.gris
                : COLOR.ink;
          return (
            <div
              key={e.fila.nombre}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: PISTA.altoFila,
                transform: `translateY(${e.y}px)`,
                opacity: e.opacidad,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: (PISTA.altoFila - PISTA.altoBarra) / 2,
                  width: e.ancho,
                  height: PISTA.altoBarra,
                  borderRadius: PISTA.radio,
                  backgroundColor: color,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: e.ancho,
                  top: (PISTA.altoFila - PISTA.altoBarra) / 2,
                  height: PISTA.altoBarra,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: e.dentro ? "flex-end" : "flex-start",
                  paddingLeft: e.dentro ? 0 : 20,
                  paddingRight: e.dentro ? 20 : 0,
                  whiteSpace: "nowrap",
                  transform: `${e.dentro ? "translateX(-100%) " : ""}scale(${1 + 0.09 * pulso})`,
                  transformOrigin: e.dentro ? "right center" : "left center",
                }}
              >
                <div
                  style={{
                    fontFamily: SANS,
                    fontSize: 30,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    color: e.dentro ? COLOR.papel : COLOR.ink,
                  }}
                >
                  {e.fila.nombre}
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 26,
                    fontWeight: 500,
                    lineHeight: 1.2,
                    opacity: 0.7,
                    fontVariantNumeric: "tabular-nums",
                    color: e.dentro ? COLOR.papel : COLOR.ink,
                  }}
                >
                  {fmt(e.valor)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------- AÑO ----------
          Vive dentro del gráfico, abajo a la derecha: ahí las barras son las más
          cortas y el riel de Instagram no lo alcanza. */}
      <div
        style={{
          position: "absolute",
          right: SEGURO.derecha,
          top: 1080,
          fontFamily: MONO,
          fontSize: 110,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: COLOR.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Math.floor(anio + 1e-6)}
      </div>

      {/* ---------- PIE ---------- */}
      <div
        style={{
          position: "absolute",
          left: PISTA.x,
          right: SEGURO.derecha,
          bottom: SEGURO.abajo,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 30,
            lineHeight: 1.4,
            color: COLOR.ink,
            opacity: opPayoff,
            minHeight: 84,
          }}
        >
          {payoff.map((p, i) => (
            <span key={i} style={{ fontWeight: p.fuerte ? 700 : 400 }}>
              {p.t}
            </span>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            borderTop: "1px solid rgba(15,15,15,0.14)",
            marginTop: 26,
            paddingTop: 20,
          }}
        >
          <div style={{ fontFamily: SERIF, fontSize: 34, color: COLOR.ink }}>
            <span style={{ fontStyle: "italic", color: COLOR.grisSuave }}>re</span>
            <span style={{ fontWeight: 700 }}>franco</span>
            <span style={{ color: COLOR.rojo, fontFamily: SANS, fontWeight: 600 }}>.ai</span>
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 20,
              letterSpacing: "0.05em",
              color: COLOR.grisSuave,
              textTransform: "uppercase",
            }}
          >
            {pieDerecho}
          </div>
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 20,
            lineHeight: 1.35,
            color: COLOR.grisSuave,
            marginTop: 14,
          }}
        >
          {dataset.meta.fuente}
        </div>
      </div>
    </AbsoluteFill>
  );
};
