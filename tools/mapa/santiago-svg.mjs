// Mapa de Santiago para la landing: calles principales de OpenStreetMap → SVG estático.
//
//   node tools/mapa/santiago-svg.mjs            # descarga de Overpass y escribe el SVG
//
// Sale un SVG monocromo con capas: rio (Mapocho), autopistas, primarias,
// secundarias. Va a `public/landing/` y la landing lo carga como <img> (Vercel
// lo sirve comprimido y cacheado aparte del HTML); por eso los trazos llevan
// sus atributos de estilo adentro — un <img> no hereda CSS de la página. Los
// puntos de densidad, etiquetas y el pin van en un SVG inline encima, con la
// misma proyección (`mapa-santiago.proj.json`). Proyección equirectangular
// corregida por cos(lat): a esta escala es indistinguible de Mercator.
// Coordenadas enteras en unidades del viewBox para que pese poco.
// Datos © OpenStreetMap contributors (ODbL) — atribuido en la página.

import { writeFileSync, mkdirSync } from "node:fs";

// Caja: Gran Santiago urbano. Un poco más que CAJA_COBERTURA para que las
// autopistas no terminen en seco en el borde.
const S = -33.70, N = -33.30, W = -70.86, E = -70.44;
const VW = 900, VH = 1000;
const OUT = "public/landing/mapa-santiago.svg";

const query = `
[out:json][timeout:180];
(
  way["highway"~"^(motorway|trunk|primary|secondary)$"](${S},${W},${N},${E});
  way["waterway"="river"]["name"~"Mapocho"](${S},${W},${N},${E});
);
out geom;
`;

const kLat = Math.cos(((S + N) / 2) * Math.PI / 180);
// Escala común para no deformar: el ancho manda.
const sx = VW / ((E - W) * kLat);
const sy = VH / (N - S);
const s = Math.min(sx, sy);
const ox = (VW - (E - W) * kLat * s) / 2;
const oy = (VH - (N - S) * s) / 2;
const px = (lng) => Math.round((lng - W) * kLat * s + ox);
const py = (lat) => Math.round((N - lat) * s + oy);

async function main() {
  // Overpass devuelve 406 sin User-Agent (mod_security). Dos espejos por si uno
  // está saturado; el primero que responda 200 gana.
  const ESPEJOS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  let j = null, ultimo = "";
  for (const url of ESPEJOS) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
        "user-agent": "refranco.ai landing map generator (tools/mapa/santiago-svg.mjs)",
      },
      body: "data=" + encodeURIComponent(query),
    });
    if (r.ok) { j = await r.json(); break; }
    ultimo = `${url} → ${r.status}: ${(await r.text()).slice(0, 200)}`;
    console.warn(ultimo);
  }
  if (!j) throw new Error("Overpass sin respuesta: " + ultimo);
  const capas = { rio: [], autopista: [], primaria: [], secundaria: [] };
  for (const el of j.elements) {
    if (el.type !== "way" || !el.geometry) continue;
    const t = el.tags || {};
    const capa = t.waterway ? "rio"
      : /^(motorway|trunk)$/.test(t.highway) ? "autopista"
      : t.highway === "primary" ? "primaria" : "secundaria";
    // Simplificación tosca: a 900px de ancho un vértice cada ~3 unidades sobra.
    // Se conserva siempre el último vértice para que las calles no queden cortas.
    const pts = el.geometry.map((p) => [px(p.lon), py(p.lat)]);
    let d = "", last = null;
    pts.forEach(([x, y], i) => {
      const ultimo = i === pts.length - 1;
      if (last && !ultimo && Math.abs(last[0] - x) < 3 && Math.abs(last[1] - y) < 3) return;
      if (last && last[0] === x && last[1] === y) return;
      d += (last ? "L" : "M") + x + " " + y;
      last = [x, y];
    });
    if (d.includes("L")) capas[capa].push(d);
  }
  // Tinta sobre tinta: trazos en papel (#FAFAF8) con opacidad por jerarquía.
  // fill="none" en CADA path: sin él, Chrome rellena de negro las polilíneas al
  // cargar el SVG como <img> (medido 07-sep-2026).
  const ESTILO = {
    rio: 'fill="none" stroke="#FAFAF8" stroke-opacity=".38" stroke-width="2.2"',
    autopista: 'fill="none" stroke="#FAFAF8" stroke-opacity=".42" stroke-width="1.3"',
    primaria: 'fill="none" stroke="#FAFAF8" stroke-opacity=".28" stroke-width=".9"',
    secundaria: 'fill="none" stroke="#FAFAF8" stroke-opacity=".16" stroke-width=".55"',
  };
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" fill="none" stroke-linecap="round" stroke-linejoin="round">`,
    `<!-- Generado por tools/mapa/santiago-svg.mjs · datos © OpenStreetMap contributors (ODbL) · caja ${S},${W},${N},${E} -->`,
    ...Object.entries(capas).map(([k, ds]) => `<path ${ESTILO[k]} d="${ds.join("")}"/>`),
    `</svg>`,
  ].join("\n");
  mkdirSync("src/components/landing-v14", { recursive: true });
  writeFileSync(OUT, svg);
  const kb = Buffer.byteLength(svg) / 1024;
  console.log(`${OUT}: ${kb.toFixed(0)} KB ·`, Object.fromEntries(Object.entries(capas).map(([k, v]) => [k, v.length])));
  // Proyección para que el componente ubique puntos y etiquetas con la misma fórmula.
  writeFileSync("src/components/landing-v14/mapa-santiago.proj.json", JSON.stringify({ S, N, W, E, VW, VH, kLat, s, ox, oy }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
