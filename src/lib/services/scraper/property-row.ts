// Mapeo ScrapedProperty -> fila de `scraped_properties`. Compartido por el pase
// general (/api/data/scrape-properties) y el de obra nueva
// (/api/data/scrape-nuevos), para que las dos rutas escriban EXACTAMENTE el mismo
// shape. Vivía inline en el route general; se extrajo al abrir la segunda ruta.

import type { ScrapedProperty } from "./toctoc";

export function propertyToRow(prop: ScrapedProperty) {
  return {
    source: prop.source,
    source_id: prop.sourceId,
    type: prop.type,
    comuna: prop.comuna,
    direccion: prop.direccion || null,
    lat: prop.lat || null,
    lng: prop.lng || null,
    precio: prop.precio,
    moneda: prop.moneda,
    superficie_m2: prop.superficieM2 || null,
    dormitorios: prop.dormitorios || null,
    banos: prop.banos || null,
    gastos_comunes: prop.gastosComunes || null,
    estacionamientos: prop.estacionamientos || null,
    bodegas: prop.bodegas || null,
    piso: prop.piso || null,
    // NOTA: la fuente NO expone antigüedad. El campo queda mapeado (0 de 47.338
    // filas lo tienen) porque el parser nunca lo puebla: ni el GetProps del mapa
    // ni el listado gw-lista-seo traen el dato. Lo que parecía antigüedad en el
    // array del mapa —posición [14]— es la fecha de PUBLICACIÓN del aviso:
    // filtrando por avisos de <=7 días, el 100% de esos valores cae en el año en
    // curso. Poblarlo exigiría abrir la ficha de cada aviso (1 request por
    // propiedad × ~26k) — decisión aparte, no un efecto colateral del scraper.
    antiguedad: prop.antiguedad || null,
    url: prop.url || null,
    condicion: prop.condicion || "usado",
    is_active: true,
    scraped_at: new Date().toISOString(),
    geocode_attempted: false,
  };
}
