// Puntos de densidad y centroides de comuna para el mapa de la landing, desde
// `scraped_properties` (avisos activos con coordenadas). Muestra fija commiteada:
// el mapa es material de la página, no un dato vivo; se regenera a mano.
//
//   node --env-file=.env.local tools/mapa/puntos.mjs
//
// Escribe src/components/landing-v14/mapa-puntos.gen.json:
//   { centroides: [{ comuna, lat, lng, n }], puntos: [[lat, lng], …] }

import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const COMUNAS = ["Santiago","Ñuñoa","Las Condes","La Florida","Estación Central","Providencia","San Miguel","Independencia","Macul","Vitacura","La Cisterna","Lo Barnechea","Quinta Normal","Recoleta","San Joaquín","Peñalolén","Maipú","Huechuraba","Puente Alto","Cerrillos","Conchalí","Pudahuel","La Reina","Quilicura"];
const S = -33.70, N = -33.30, W = -70.86, E = -70.44;

// Paginado a 1.000 (PostgREST capa cada respuesta) — la tabla tiene ~44k activas.
async function todas() {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb
      .from("scraped_properties")
      .select("comuna, lat, lng")
      .eq("is_active", true)
      .not("lat", "is", null)
      .order("id")
      .range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

const filas = await todas();
const porComuna = new Map();
for (const f of filas) {
  if (!COMUNAS.includes(f.comuna)) continue;
  const c = porComuna.get(f.comuna) ?? { comuna: f.comuna, lat: 0, lng: 0, n: 0 };
  c.lat += f.lat; c.lng += f.lng; c.n += 1;
  porComuna.set(f.comuna, c);
}
const centroides = [...porComuna.values()]
  .map((c) => ({ comuna: c.comuna, lat: +(c.lat / c.n).toFixed(4), lng: +(c.lng / c.n).toFixed(4), n: c.n }))
  .sort((a, b) => b.n - a.n);

// Muestra determinista: una de cada k dentro de la caja, sin duplicados exactos
// (un edificio con 40 unidades es un punto, no cuarenta).
const dentro = filas.filter((f) => f.lat >= S && f.lat <= N && f.lng >= W && f.lng <= E);
const vistos = new Set();
const unicos = dentro.filter((f) => { const k = `${f.lat.toFixed(4)},${f.lng.toFixed(4)}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
const k = Math.max(1, Math.floor(unicos.length / 900));
const puntos = unicos.filter((_, i) => i % k === 0).slice(0, 900).map((f) => [+f.lat.toFixed(4), +f.lng.toFixed(4)]);

writeFileSync("src/components/landing-v14/mapa-puntos.gen.json", JSON.stringify({ generado: new Date().toISOString().slice(0, 10), activas: filas.length, centroides, puntos }));
console.log(`activas con coords: ${filas.length} · únicas en caja: ${unicos.length} · puntos: ${puntos.length} · comunas: ${centroides.length}`);
