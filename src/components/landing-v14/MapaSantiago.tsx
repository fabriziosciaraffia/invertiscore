// ─────────────────────────────────────────────────────────────────────────────
// Mapa de Santiago (sección 3) — opción (c) del goal: SVG estático de calles
// principales desde OpenStreetMap, en tres capas y un título:
//
//  1. Calles: `public/landing/mapa-santiago.svg` (tools/mapa/santiago-svg.mjs),
//     cargado como <img> para que Vercel lo sirva comprimido y cacheado aparte
//     del HTML (282 KB en disco, ~111 KB comprimido).
//  2. Puntos: TODOS los avisos activos con coordenadas, en <canvas>
//     (`MapaPuntos`, datos por /api/landing/mapa-puntos, ISR 24 h), en loop.
//  3. Etiquetas de comuna en su centroide real (mapa-puntos.gen.json, de
//     tools/mapa/puntos.mjs), en un SVG inline con la misma proyección.
//  4. "BASE DE DATOS EN VIVO" arriba a la izquierda, con el punto latiendo.
//
// El contenedor lleva una máscara en los cuatro bordes (CSS) para que el mapa
// flote sobre la tinta, sin rectángulo. La atribución de OpenStreetMap (ODbL)
// vive en el footer de la página. Sin pin: el mapa es la base, no un depto.
// ─────────────────────────────────────────────────────────────────────────────

import proj from "./mapa-santiago.proj.json";
import centroides from "./mapa-puntos.gen.json";
import { MapaPuntos } from "./MapaPuntos";

const px = (lng: number) => (lng - proj.W) * proj.kLat * proj.s + proj.ox;
const py = (lat: number) => (proj.N - lat) * proj.s + proj.oy;

/** Etiquetas que se tapan con las vecinas a esta escala: se corren un poco. */
const AJUSTE: Record<string, { dx?: number; dy?: number }> = {
  Providencia: { dy: -8 },
  "Ñuñoa": { dy: 14 },
  Santiago: { dx: -10 },
  Macul: { dy: 8 },
  "San Joaquín": { dy: -6 },
};

export function MapaSantiago() {
  const { VW, VH } = proj;
  return (
    <div className="lv-mapa">
      <div className="lv-mapwrap" style={{ aspectRatio: `${VW} / ${VH}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático, sin optimizador */}
        <img
          className="lv-map-calles"
          src="/landing/mapa-santiago.svg"
          width={VW}
          height={VH}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <MapaPuntos />
        <svg className="lv-map-capa" viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true">
          {centroides.centroides.map((c, k) => (
            <text
              key={c.comuna}
              className="lv-lb"
              x={(px(c.lng) + (AJUSTE[c.comuna]?.dx ?? 0)).toFixed(1)}
              y={(py(c.lat) + (AJUSTE[c.comuna]?.dy ?? 0)).toFixed(1)}
              style={{ ["--d" as string]: `${(1.8 + k * 0.06).toFixed(2)}s` }}
            >
              {c.comuna.toUpperCase()}
            </text>
          ))}
        </svg>
      </div>
      <div className="lv-map-titulo"><i />Base de datos en vivo</div>
    </div>
  );
}
