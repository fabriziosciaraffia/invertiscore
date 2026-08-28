import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as cargarSerif } from "@remotion/google-fonts/SourceSerif4";
import { loadFont as cargarSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as cargarMono } from "@remotion/google-fonts/JetBrainsMono";
import {
  CTA_DELAY_L1,
  CTA_DELAY_L2,
  CTA_DELAY_L3,
  CTA_FADE,
  CTA_SUBIDA,
  DUR,
  EMOJI_POR_DEFECTO,
  H,
  PADB,
  PADL,
  PADR,
  TEMAS,
  TRAZO_REFERENCIA,
  TRAZO_SERIE,
  W,
  XMIN,
  ejeAmortiguado,
  pathRecto,
  puntas,
  px,
  tEnSegundo,
  type DatasetLineas,
  type Tema,
} from "./lineas";

// Las tres familias las carga Remotion (SIL OFL 1.1), no el sistema: el render headless
// no tiene por qué tener instalado nada.
const { fontFamily: SERIF } = cargarSerif();
const { fontFamily: SANS } = cargarSans();
const { fontFamily: MONO } = cargarMono();

/** La curva `ease` de CSS, que es la que usa el prototipo en sus transiciones. */
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

// Layout del prototipo SAFEZONE, en escala del prototipo. El bloque entero bajó para
// despejar la franja superior que tapa la UI de Instagram, y el pie subió por lo mismo.
const TITULO_FS = 25;
const TITULO_LH = 1.16;
const ANTETITULO_FS = 11.5;
const HOOK_TOP = 100;
/** Techo y piso del gráfico. */
const STAGE_TOP = 206;
const STAGE_BOTTOM = 118;
/** Distancia del pie al borde inferior. */
const FOOT_BOTTOM = 48;

export type PropsLineas = {
  dataset: DatasetLineas;
  antetitulo: string;
  /** El titular se parte en dos líneas, como en el prototipo. */
  titulo: [string, string];
  /** Trozo exacto de `titulo[0]` que va en rojo. */
  resaltado: string;
  /** Toda la decisión de color, incluida la paleta de series. */
  tema: Tema;
  emojis: Record<string, string>;
  /** Acto de cierre: las tres líneas del titular y el subtítulo. */
  cta: {
    lineas: string[];
    /** Trozo de la última línea que va en rojo. */
    resaltado: string;
    sub: string;
    subResaltado: string;
    emoji: string;
  };
};

export const LineasTop5: React.FC<PropsLineas> = ({
  dataset,
  antetitulo,
  titulo,
  resaltado,
  tema,
  emojis,
  cta,
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

  const tips = puntas(dataset.filas, tema.series, tema.tx3Grafico, tt, n, Y);
  const paso = xmax > 7 ? 2 : 1;
  const anios: number[] = [];
  for (let yr = 0; yr <= Math.floor(xmax) && yr <= n - 1; yr += paso) anios.push(yr);

  const [antes, despues] = titulo[0].split(resaltado);

  // ── Acto CTA ──
  // A los DUR segundos el gráfico y el hook se van en un fundido de 0,7s, y las dos
  // líneas del cierre entran desde abajo con 0,5s y 1,05s de retardo. En CSS opacidad y
  // transform comparten la misma transición, así que el desplazamiento es el
  // complemento exacto de la opacidad: una sola progresión por línea.
  const el = frame / fps;
  const opContenido = interpolate(el, [DUR, DUR + CTA_FADE], [1, 0], {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const entrada = (retardo: number) =>
    interpolate(el, [DUR + retardo, DUR + retardo + CTA_FADE], [0, 1], {
      easing: EASE,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const opL1 = entrada(CTA_DELAY_L1);
  const opL2 = entrada(CTA_DELAY_L2);
  const opL3 = entrada(CTA_DELAY_L3);
  const subir = (op: number) => `translateY(${px(CTA_SUBIDA) * (1 - op)}px)`;

  return (
    <AbsoluteFill
      style={{
        background: tema.fondo,
      }}
    >
      {/* ---------- TÍTULO ---------- */}
      <div
        style={{
          position: "absolute",
          top: px(HOOK_TOP),
          left: px(28),
          right: px(28),
          opacity: opContenido,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: px(ANTETITULO_FS),
            fontWeight: 600,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
            color: tema.tx3,
            marginBottom: px(9),
          }}
        >
          {antetitulo}
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: px(TITULO_FS),
            lineHeight: TITULO_LH,
            color: tema.ink,
          }}
        >
          {antes}
          <span style={{ color: tema.rojo }}>{resaltado}</span>
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
          top: px(STAGE_TOP),
          left: px(26),
          right: px(26),
          bottom: px(STAGE_BOTTOM),
          opacity: opContenido,
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
                <line x1={PADL} x2={W - PADR} y1={y} y2={y} stroke={tema.grid} strokeWidth={1} />
                <text
                  x={PADL - 6}
                  y={y + 3}
                  fill={tema.tx3Grafico}
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
          <line x1={PADL} x2={W - PADR} y1={y0} y2={y0} stroke={tema.eje} strokeWidth={1.2} />
          <text
            x={PADL - 6}
            y={y0 + 3}
            fill={tema.tx3Grafico}
            fontFamily={MONO}
            fontSize={9}
            textAnchor="end"
          >
            0%
          </text>
          <line x1={PADL} x2={PADL} y1={Y(ymax)} y2={y0} stroke={tema.eje} strokeWidth={1.2} />

          {/* años */}
          {anios.map((yr) => {
            const x = X(yr);
            return (
              <g key={`a${yr}`}>
                <line x1={x} x2={x} y1={y0} y2={y0 + 4} stroke={tema.eje} />
                <text
                  x={x}
                  y={y0 + 14}
                  fill={tema.tx3Grafico}
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
            fill={tema.marcaAgua}
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
                stroke={tema.series[i % tema.series.length]}
                strokeWidth={TRAZO_SERIE}
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
                stroke={tema.tx3Grafico}
                strokeWidth={TRAZO_REFERENCIA}
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

      {/* ---------- ACTO CTA ----------
          Entra cuando el gráfico se va. El pie NO se desvanece: en el prototipo el
          `.dim` solo alcanza a `.stage` y `.hook`, así que la firma queda en pantalla
          todo el cierre. */}
      <div
        style={{
          position: "absolute",
          left: px(26),
          right: px(22),
          top: "50%",
          transform: "translateY(-50%)",
          textAlign: "left",
        }}
      >
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: px(44),
            lineHeight: 1.1,
            color: tema.ink,
            opacity: opL1,
            transform: subir(opL1),
          }}
        >
          {cta.lineas.map((linea, i) => {
            const [ini, fin] = linea.split(cta.resaltado);
            const parte = linea.includes(cta.resaltado);
            return (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {parte ? (
                  <>
                    {ini}
                    <span style={{ color: tema.rojo, fontWeight: 700 }}>{cta.resaltado}</span>
                    {fin}
                  </>
                ) : (
                  linea
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div
          style={{
            marginTop: px(26),
            fontFamily: SANS,
            fontSize: px(26),
            fontWeight: 600,
            color: tema.ink,
            opacity: opL2,
            transform: subir(opL2),
          }}
        >
          {cta.sub.split(cta.subResaltado)[0]}
          <span style={{ color: tema.rojo }}>{cta.subResaltado}</span>
          {cta.sub.split(cta.subResaltado)[1]}{" "}
          <span style={{ fontSize: px(27) }}>{cta.emoji}</span>
        </div>
        {/* Tercer escalón de la cascada: la firma cierra el acto. */}
        <div
          style={{
            marginTop: px(30),
            fontFamily: SERIF,
            fontSize: px(19),
            color: tema.ink,
            opacity: opL3,
            transform: subir(opL3),
          }}
        >
          <span style={{ fontStyle: "italic", fontWeight: 400, color: tema.tx3 }}>re</span>
          <b style={{ fontWeight: 700 }}>franco</b>
          <span style={{ color: tema.rojo, fontSize: px(12), fontWeight: 600 }}>.ai</span>
        </div>
      </div>

      {/* ---------- PIE ---------- */}
      <div style={{ position: "absolute", left: px(28), right: px(28), bottom: px(FOOT_BOTTOM) }}>
        {/* Se va con el gráfico: en el acto de cierre la firma la pone el tercer
            escalón de la cascada, y dos wordmarks a la vez se estorban. La línea de
            fuente NO se desvanece — la atribución del dato queda en pantalla. */}
        <div
          style={{ fontFamily: SERIF, fontSize: px(14), color: tema.ink, opacity: opContenido }}
        >
          <span style={{ fontStyle: "italic", fontWeight: 400, color: tema.tx3 }}>re</span>
          <b style={{ fontWeight: 700 }}>franco</b>
          <span style={{ color: tema.rojo, fontSize: px(9.5), fontWeight: 600 }}>.ai</span>
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: px(7.2),
            color: tema.fondoSrc,
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
  tema: TEMAS.neon,
  cta: {
    lineas: ["Analiza tu depto", "de inversión", "con Franco."],
    resaltado: "Franco",
    sub: "El primero es gratis",
    subResaltado: "gratis",
    emoji: "🚀",
  },
  titulo: ["Diez años de plusvalía.", "¿Cuál ganó?"] as [string, string],
  resaltado: "plusvalía",
  emojis: EMOJI_POR_DEFECTO,
};
