import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as cargarSerif } from "@remotion/google-fonts/SourceSerif4";
import { loadFont as cargarSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as cargarMono } from "@remotion/google-fonts/JetBrainsMono";
import {
  COLOR_L,
  EMOJI_POR_DEFECTO,
  H,
  PADB,
  PADL,
  PADR,
  PALETA,
  W,
  XMIN,
  ejeAmortiguado,
  pathRecto,
  puntas,
  tEnSegundo,
  type DatasetLineas,
} from "./lineas";

// Las tres familias las carga Remotion (SIL OFL 1.1), no el sistema: el render headless
// no tiene por qué tener instalado nada.
const { fontFamily: SERIF } = cargarSerif();
const { fontFamily: SANS } = cargarSans();
const { fontFamily: MONO } = cargarMono();

/** El prototipo se diseñó a 405×720; el reel sale a 1080×1920. */
const S = 1080 / 405;
/** Convierte una medida del prototipo al lienzo final. */
const px = (n: number) => n * S;

export type PropsLineas = {
  dataset: DatasetLineas;
  antetitulo: string;
  /** El titular se parte en dos líneas, como en el prototipo. */
  titulo: [string, string];
  /** Trozo exacto de `titulo[0]` que va en rojo. */
  resaltado: string;
  colores: string[];
  emojis: Record<string, string>;
};

export const LineasTop5: React.FC<PropsLineas> = ({
  dataset,
  antetitulo,
  titulo,
  resaltado,
  colores,
  emojis,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const n = dataset.anios.length;
  const anio0 = dataset.anios[0];
  const tt = tEnSegundo(frame / fps, n);
  const xmax = Math.max(tt, XMIN);

  // Un paso de 60 Hz cada medio cuadro: el amortiguado del prototipo corre sobre rAF.
  const ys = ejeAmortiguado(dataset, fps, durationInFrames);
  const ymax = ys[Math.min(Math.round((frame / fps) * 60), ys.length - 1)];

  const X = (i: number) => PADL + (i / xmax) * (W - PADL - PADR);
  const Y = (v: number) => H - PADB - (v / ymax) * (H - PADB - 16);
  const y0 = Y(0);

  const tips = puntas(dataset.filas, colores, tt, n, Y);
  const paso = xmax > 7 ? 2 : 1;
  const anios: number[] = [];
  for (let yr = 0; yr <= Math.floor(xmax) && yr <= n - 1; yr += paso) anios.push(yr);

  const [antes, despues] = titulo[0].split(resaltado);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(178deg,#201E1B 0%,#141311 55%,#0B0A09 100%)",
      }}
    >
      {/* ---------- TÍTULO ---------- */}
      <div style={{ position: "absolute", top: px(40), left: px(28), right: px(28) }}>
        <div
          style={{
            fontFamily: SANS,
            fontSize: px(10.5),
            fontWeight: 600,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
            color: COLOR_L.tx3,
            marginBottom: px(8),
          }}
        >
          {antetitulo}
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: px(25),
            lineHeight: 1.16,
            color: COLOR_L.ink,
          }}
        >
          {antes}
          <span style={{ color: COLOR_L.rojo }}>{resaltado}</span>
          {despues}
          <br />
          {titulo[1]}
        </div>
      </div>

      {/* ---------- GRÁFICO ----------
          El viewBox y las coordenadas internas son los del prototipo, sin reescalar. */}
      <div
        style={{
          position: "absolute",
          top: px(150),
          left: px(26),
          right: px(26),
          bottom: px(112),
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ overflow: "visible" }}
        >
          {/* grilla horizontal */}
          {[1, 2, 3, 4].map((k) => {
            const vv = (ymax * k) / 4;
            const y = Y(vv);
            return (
              <g key={`g${k}`}>
                <line x1={PADL} x2={W - PADR} y1={y} y2={y} stroke={COLOR_L.grid} strokeWidth={1} />
                <text
                  x={PADL - 6}
                  y={y + 3}
                  fill={COLOR_L.tx3}
                  fontFamily={MONO}
                  fontSize={9}
                  textAnchor="end"
                >
                  +{Math.round(vv)}%
                </text>
              </g>
            );
          })}

          {/* ejes */}
          <line x1={PADL} x2={W - PADR} y1={y0} y2={y0} stroke={COLOR_L.eje} strokeWidth={1.2} />
          <text
            x={PADL - 6}
            y={y0 + 3}
            fill={COLOR_L.tx3}
            fontFamily={MONO}
            fontSize={9}
            textAnchor="end"
          >
            0%
          </text>
          <line x1={PADL} x2={PADL} y1={Y(ymax)} y2={y0} stroke={COLOR_L.eje} strokeWidth={1.2} />

          {/* años */}
          {anios.map((yr) => {
            const x = X(yr);
            return (
              <g key={`a${yr}`}>
                <line x1={x} x2={x} y1={y0} y2={y0 + 4} stroke={COLOR_L.eje} />
                <text
                  x={x}
                  y={y0 + 14}
                  fill={COLOR_L.tx3}
                  fontFamily={MONO}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {anio0 + yr}
                </text>
              </g>
            );
          })}

          {/* año como marca de agua, detrás de las series */}
          <text
            x={W - PADR - 6}
            y={y0 - 12}
            fill={COLOR_L.ink}
            opacity={0.15}
            fontFamily={MONO}
            fontWeight={700}
            fontSize={34}
            textAnchor="end"
          >
            {Math.round(anio0 + tt)}
          </text>

          {/* series */}
          {dataset.filas.map((f, i) =>
            f.referencia ? null : (
              <path
                key={f.nombre}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                stroke={colores[i % colores.length]}
                strokeWidth={2.4}
                d={pathRecto(f.valores, tt, n, X, Y)}
              />
            ),
          )}
          {dataset.filas
            .filter((f) => f.referencia)
            .map((f) => (
              <path
                key={f.nombre}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                stroke={COLOR_L.tx3}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                d={pathRecto(f.valores, tt, n, X, Y)}
              />
            ))}

          {/* etiquetas de punta: conector, punto y texto */}
          {tips.map((o) => {
            const x = X(tt);
            const em = o.referencia || !emojis[o.nombre] ? "" : `${emojis[o.nombre]} `;
            return (
              <g key={o.nombre}>
                <line
                  x1={x}
                  x2={x + 6}
                  y1={o.yDato}
                  y2={o.yTexto}
                  stroke={o.color}
                  strokeWidth={0.8}
                  opacity={0.5}
                />
                <circle cx={x} cy={o.yDato} r={o.referencia ? 2.2 : 2.8} fill={o.color} />
                <text
                  x={x + 8}
                  y={o.yTexto + 3.5}
                  fill={o.color}
                  fontSize={9.5}
                  fontWeight={o.referencia ? 500 : 600}
                  fontFamily={SANS}
                >
                  {em}
                  {o.nombre}{" "}
                  <tspan fontFamily={MONO} fontWeight={700}>
                    {o.v >= 0 ? "+" : ""}
                    {o.v.toFixed(0)}%
                  </tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ---------- PIE ---------- */}
      <div style={{ position: "absolute", left: px(28), right: px(28), bottom: px(36) }}>
        <div style={{ fontFamily: SERIF, fontSize: px(14), color: COLOR_L.ink }}>
          <span style={{ fontStyle: "italic", fontWeight: 400, color: COLOR_L.tx3 }}>re</span>
          <b style={{ fontWeight: 700 }}>franco</b>
          <span style={{ color: COLOR_L.rojo, fontSize: px(9.5), fontWeight: 600 }}>.ai</span>
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: px(7.2),
            color: COLOR_L.fondoSrc,
            marginTop: px(3),
            lineHeight: 1.4,
          }}
        >
          {dataset.meta.fuente}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const PROPS_LINEAS_POR_DEFECTO = {
  antetitulo: "Las 5 comunas más analizadas en Franco",
  titulo: ["Diez años de plusvalía.", "¿Cuál ganó?"] as [string, string],
  resaltado: "plusvalía",
  colores: PALETA,
  emojis: EMOJI_POR_DEFECTO,
};
