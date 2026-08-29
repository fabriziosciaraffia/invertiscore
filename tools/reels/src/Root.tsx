import React from "react";
import { Composition } from "remotion";
import { BarRace, type PropsBarRace, type TrozoPayoff } from "./BarRace";
import { FPS, GUION, LIENZO } from "./canon";
import type { Dataset, Evento } from "./carrera";
import bruto from "../data/dataset-plusvalia-2015-2025.json";
import { LineasTop5, PROPS_LINEAS_POR_DEFECTO } from "./LineasTop5";
import { CTA, DUR, TEMAS, type DatasetLineas } from "./lineas";
import { PortadaLineas, PROPS_PORTADA_POR_DEFECTO } from "./PortadaLineas";
import brutoLineas from "../data/dataset-lineas-top5.json";

const dataset = bruto as Dataset;

/**
 * Los textos del reel se ARMAN desde el dataset, no se escriben a mano. La carrera de
 * septiembre se hace cambiando el JSON: el titular, el payoff y el rótulo del pie se
 * recalculan solos y las cifras no pueden quedar desfasadas de lo que muestra el
 * producto. Lo único fijo es la forma de la frase.
 */
const final = (nombre: string) => {
  const f = dataset.filas.find((x) => x.nombre === nombre)!;
  return f.valores[f.valores.length - 1];
};

const ranking = [...dataset.filas].sort(
  (a, b) => final(b.nombre) - final(a.nombre),
);
const ganador = ranking[0];
const caras = dataset.filas.filter((f) => f.grupo === "cara");
const carasMin = Math.round(Math.min(...caras.map((f) => final(f.nombre))));
const carasMax = Math.round(Math.max(...caras.map((f) => final(f.nombre))));

const NUMERO_EN_PALABRAS: Record<number, string> = {
  4: "cuatro",
  5: "cinco",
  6: "seis",
  7: "siete",
  8: "ocho",
};
const nCaras = dataset.meta.nCaras;
const carasEnPalabras = NUMERO_EN_PALABRAS[nCaras] ?? String(nCaras);

const titular: PropsBarRace["titular"] = {
  antetitulo: `refranco.ai · plusvalía ${dataset.meta.subtitulo}`,
  // "Al fondo de la tabla" es literal y lo verifica una guarda en el generador: las
  // más caras caen todas dentro de las últimas nCaras+1 posiciones. "Terminaron
  // últimas" habría sido atacable — hoy se cuela Estación Central en el puesto 11.
  texto: `Las ${nCaras} comunas más caras de Santiago terminaron al fondo de la tabla.`,
  resaltado: "al fondo",
};

const payoff: TrozoPayoff[] = [
  { t: `${ganador.nombre} +${Math.round(final(ganador.nombre))}%`, fuerte: true },
  { t: ` — más que duplicó. Las ${carasEnPalabras} comunas más caras cerraron entre ` },
  { t: `+${carasMin}% y +${carasMax}%`, fuerte: true },
  { t: "." },
];

/**
 * Los cuatro momentos con pulso, aprobados uno por uno. Cada uno tiene que existir en
 * `dataset.eventos` o el render revienta: el reel no destaca nada que la serie no
 * tenga. Verificados contra el ranking año a año antes de fijarlos.
 */
const beats: Evento[] = [
  { nombre: "Las Condes", anio: 2018, tipo: "sale" },
  { nombre: "La Reina", anio: 2019, tipo: "sale" },
  { nombre: "Puente Alto", anio: 2020, tipo: "podio" },
  { nombre: "Las Condes", anio: 2025, tipo: "entra" },
];

const datasetLineas = brutoLineas as DatasetLineas;

export const RemotionRoot: React.FC = () => (
  <>
    {/* Reel 1 — carrera de barras. */}
    <Composition
      id="BarRacePlusvalia"
      component={BarRace}
      durationInFrames={GUION.total}
      fps={FPS}
      width={LIENZO.w}
      height={LIENZO.h}
      defaultProps={{
        dataset,
        titular,
        payoff,
        beats,
        pieDerecho: `plusvalía acumulada ${dataset.meta.subtitulo}`,
      }}
    />
    {/* Reel 2. La dirección de color se decidió en celular: ganó NEÓN, que es el
        tema por defecto (TEMA_POR_DEFECTO). Light queda renderizable por su
        composición, pero no es default. */}
    <Composition
      id="LineasNeon"
      component={LineasTop5}
      durationInFrames={(DUR + CTA) * FPS}
      fps={FPS}
      width={LIENZO.w}
      height={LIENZO.h}
      defaultProps={{ dataset: datasetLineas, ...PROPS_LINEAS_POR_DEFECTO, tema: TEMAS.neon }}
    />
    <Composition
      id="LineasLight"
      component={LineasTop5}
      durationInFrames={(DUR + CTA) * FPS}
      fps={FPS}
      width={LIENZO.w}
      height={LIENZO.h}
      defaultProps={{ dataset: datasetLineas, ...PROPS_LINEAS_POR_DEFECTO, tema: TEMAS.light }}
    />
    {/* Portadas: heredan el tema del video — no hay HTML de portada por variante. */}
    <Composition
      id="PortadaNeon"
      component={PortadaLineas}
      durationInFrames={1}
      fps={FPS}
      width={LIENZO.w}
      height={LIENZO.h}
      defaultProps={{ ...PROPS_PORTADA_POR_DEFECTO, tema: TEMAS.neon }}
    />
    <Composition
      id="PortadaLight"
      component={PortadaLineas}
      durationInFrames={1}
      fps={FPS}
      width={LIENZO.w}
      height={LIENZO.h}
      defaultProps={{ ...PROPS_PORTADA_POR_DEFECTO, tema: TEMAS.light }}
    />
  </>
);
