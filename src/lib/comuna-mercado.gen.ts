// GENERADO — no editar a mano. Regenerar con:
//   node --env-file=.env.local --import tsx scripts/data/generar-comuna-mercado.ts
//
// Mercado por comuna que consume la ALTERNATIVA DE COMUNAS (contrato §5): dado un
// depto que no cierra en su comuna, en cuáles del roster sí cerraría. Con este
// módulo el cálculo en runtime es PURO — ninguna query — y el catch-test corre sin
// credenciales.
//
// LOS CORTES SON LOS DEL MOTOR: ventana de 90 días, universo nuevo/usado
// separado y nunca mezclado, y los umbrales de muestra de `comuna-stats` y
// `referencia-arriendo`. Una celda bajo el umbral NO se emite: no hay relleno.
//
// EL PRECIO ES PUBLICADO, no de cierre. El factor publicado→cierre lo aplica el
// consumidor con `getFactorCierre`, igual que el resto del motor.
//
// CUÁNDO REGENERAR: cada celda trae su `n` y el módulo su fecha. El scraper corre
// seguido, así que la ventana se mueve sola; regenerar cuando la fecha quede a más
// de un par de meses, o cuando una comuna entre o salga del roster.

/** Una celda de venta: UF/m² mediano publicado y el n que lo sostiene. */
export interface CeldaVentaComuna {
  ufM2: number;
  n: number;
}

/** El arriendo pooled de una comuna, en UF/m² al mes. */
export interface CeldaArriendoComuna {
  ufM2Mes: number;
  n: number;
}

/** Fecha de la corrida que produjo este módulo (YYYY-MM-DD). */
export const COMUNA_MERCADO_FECHA = "2026-09-11";
/** UF con que se normalizaron las publicaciones en CLP. */
export const COMUNA_MERCADO_UF = 40902;
/** Ventana de frescura, en días. */
export const COMUNA_MERCADO_VENTANA_DIAS = 90;

/** Clave: `${comuna}|${dormitorios}|${"nuevo"|"usado"}`. */
export const VENTA_POR_COMUNA: Record<string, CeldaVentaComuna> = {
  "Cerrillos|1|nuevo": { ufM2: 77.3876, n: 28 },
  "Cerrillos|1|usado": { ufM2: 76.666, n: 24 },
  "Cerrillos|2|nuevo": { ufM2: 61.022, n: 23 },
  "Cerrillos|2|usado": { ufM2: 42.7455, n: 24 },
  "Cerrillos|3|usado": { ufM2: 36.2872, n: 32 },
  "Conchalí|1|nuevo": { ufM2: 88.7674, n: 76 },
  "Conchalí|2|nuevo": { ufM2: 73.2698, n: 45 },
  "Conchalí|2|usado": { ufM2: 39.7652, n: 26 },
  "Conchalí|3|usado": { ufM2: 35.1172, n: 37 },
  "Estación Central|1|nuevo": { ufM2: 70.7445, n: 82 },
  "Estación Central|1|usado": { ufM2: 51.5889, n: 973 },
  "Estación Central|2|nuevo": { ufM2: 61.4395, n: 94 },
  "Estación Central|2|usado": { ufM2: 47.278, n: 729 },
  "Estación Central|3|usado": { ufM2: 41.437, n: 110 },
  "Huechuraba|2|nuevo": { ufM2: 88.5533, n: 87 },
  "Huechuraba|2|usado": { ufM2: 76.2054, n: 62 },
  "Huechuraba|3|nuevo": { ufM2: 86.9128, n: 43 },
  "Huechuraba|3|usado": { ufM2: 60.8482, n: 112 },
  "Huechuraba|4|usado": { ufM2: 57.4425, n: 18 },
  "Independencia|1|nuevo": { ufM2: 89.7, n: 148 },
  "Independencia|1|usado": { ufM2: 51.6427, n: 410 },
  "Independencia|2|nuevo": { ufM2: 69.5353, n: 242 },
  "Independencia|2|usado": { ufM2: 48.1258, n: 503 },
  "Independencia|3|nuevo": { ufM2: 70.8914, n: 60 },
  "Independencia|3|usado": { ufM2: 43.9493, n: 150 },
  "La Cisterna|1|nuevo": { ufM2: 80.308, n: 167 },
  "La Cisterna|1|usado": { ufM2: 63.1303, n: 180 },
  "La Cisterna|2|nuevo": { ufM2: 71.6332, n: 219 },
  "La Cisterna|2|usado": { ufM2: 54.0249, n: 287 },
  "La Cisterna|3|nuevo": { ufM2: 61.63, n: 24 },
  "La Cisterna|3|usado": { ufM2: 42.411, n: 165 },
  "La Florida|1|nuevo": { ufM2: 93.2116, n: 366 },
  "La Florida|1|usado": { ufM2: 75.2983, n: 279 },
  "La Florida|2|nuevo": { ufM2: 77.4982, n: 497 },
  "La Florida|2|usado": { ufM2: 60.9921, n: 477 },
  "La Florida|3|nuevo": { ufM2: 69.9589, n: 120 },
  "La Florida|3|usado": { ufM2: 48.3109, n: 329 },
  "La Reina|2|usado": { ufM2: 87.4594, n: 51 },
  "La Reina|3|usado": { ufM2: 78.905, n: 86 },
  "La Reina|4|usado": { ufM2: 84.6269, n: 22 },
  "Las Condes|1|nuevo": { ufM2: 158.6449, n: 53 },
  "Las Condes|1|usado": { ufM2: 126.4118, n: 275 },
  "Las Condes|2|nuevo": { ufM2: 139.6338, n: 74 },
  "Las Condes|2|usado": { ufM2: 104.1621, n: 612 },
  "Las Condes|3|nuevo": { ufM2: 110.6726, n: 133 },
  "Las Condes|3|usado": { ufM2: 88.5415, n: 1111 },
  "Las Condes|4|nuevo": { ufM2: 106.4886, n: 43 },
  "Las Condes|4|usado": { ufM2: 82.2319, n: 720 },
  "Lo Barnechea|1|usado": { ufM2: 114.8115, n: 17 },
  "Lo Barnechea|2|nuevo": { ufM2: 116.0815, n: 37 },
  "Lo Barnechea|2|usado": { ufM2: 97.589, n: 184 },
  "Lo Barnechea|3|nuevo": { ufM2: 114.883, n: 15 },
  "Lo Barnechea|3|usado": { ufM2: 99.1275, n: 341 },
  "Lo Barnechea|4|nuevo": { ufM2: 111.2335, n: 16 },
  "Lo Barnechea|4|usado": { ufM2: 91.0688, n: 235 },
  "Macul|1|nuevo": { ufM2: 105.0873, n: 220 },
  "Macul|1|usado": { ufM2: 69.9675, n: 143 },
  "Macul|2|nuevo": { ufM2: 82.2986, n: 437 },
  "Macul|2|usado": { ufM2: 60.5076, n: 341 },
  "Macul|3|nuevo": { ufM2: 75.1143, n: 99 },
  "Macul|3|usado": { ufM2: 53.3997, n: 194 },
  "Maipú|1|usado": { ufM2: 68.7181, n: 15 },
  "Maipú|2|nuevo": { ufM2: 69.1743, n: 81 },
  "Maipú|2|usado": { ufM2: 47.6662, n: 99 },
  "Maipú|3|nuevo": { ufM2: 62.4325, n: 59 },
  "Maipú|3|usado": { ufM2: 39.862, n: 143 },
  "Ñuñoa|1|nuevo": { ufM2: 108.445, n: 425 },
  "Ñuñoa|1|usado": { ufM2: 93.1385, n: 620 },
  "Ñuñoa|2|nuevo": { ufM2: 96.568, n: 536 },
  "Ñuñoa|2|usado": { ufM2: 81.9064, n: 1039 },
  "Ñuñoa|3|nuevo": { ufM2: 98.4828, n: 98 },
  "Ñuñoa|3|usado": { ufM2: 74.6634, n: 608 },
  "Ñuñoa|4|usado": { ufM2: 71.8757, n: 60 },
  "Peñalolén|2|nuevo": { ufM2: 94.3638, n: 92 },
  "Peñalolén|2|usado": { ufM2: 63.4019, n: 60 },
  "Peñalolén|3|nuevo": { ufM2: 90.1505, n: 145 },
  "Peñalolén|3|usado": { ufM2: 63.8664, n: 96 },
  "Peñalolén|4|nuevo": { ufM2: 91.2859, n: 57 },
  "Peñalolén|4|usado": { ufM2: 66.3409, n: 33 },
  "Providencia|1|nuevo": { ufM2: 139.2497, n: 76 },
  "Providencia|1|usado": { ufM2: 103.0133, n: 215 },
  "Providencia|2|nuevo": { ufM2: 122.3733, n: 240 },
  "Providencia|2|usado": { ufM2: 95.1109, n: 480 },
  "Providencia|3|nuevo": { ufM2: 113.1645, n: 126 },
  "Providencia|3|usado": { ufM2: 84.2466, n: 529 },
  "Providencia|4|usado": { ufM2: 72.0425, n: 176 },
  "Pudahuel|2|nuevo": { ufM2: 77.1972, n: 49 },
  "Pudahuel|2|usado": { ufM2: 43.1058, n: 30 },
  "Pudahuel|3|nuevo": { ufM2: 72.223, n: 41 },
  "Pudahuel|3|usado": { ufM2: 39.0139, n: 55 },
  "Puente Alto|2|nuevo": { ufM2: 60.0175, n: 49 },
  "Puente Alto|2|usado": { ufM2: 27.9414, n: 50 },
  "Puente Alto|3|nuevo": { ufM2: 51.5735, n: 119 },
  "Puente Alto|3|usado": { ufM2: 38.8956, n: 78 },
  "Quilicura|1|nuevo": { ufM2: 76.6564, n: 35 },
  "Quilicura|2|nuevo": { ufM2: 72.3267, n: 30 },
  "Quilicura|2|usado": { ufM2: 33.4494, n: 36 },
  "Quilicura|3|nuevo": { ufM2: 68.7107, n: 22 },
  "Quilicura|3|usado": { ufM2: 35.6977, n: 39 },
  "Quinta Normal|1|nuevo": { ufM2: 79.1818, n: 33 },
  "Quinta Normal|1|usado": { ufM2: 55.8377, n: 112 },
  "Quinta Normal|2|nuevo": { ufM2: 56.7664, n: 24 },
  "Quinta Normal|2|usado": { ufM2: 44.9677, n: 194 },
  "Quinta Normal|3|usado": { ufM2: 39.8488, n: 216 },
  "Recoleta|1|nuevo": { ufM2: 86.3729, n: 83 },
  "Recoleta|1|usado": { ufM2: 52.4928, n: 83 },
  "Recoleta|2|nuevo": { ufM2: 75.1459, n: 78 },
  "Recoleta|2|usado": { ufM2: 50.2924, n: 144 },
  "Recoleta|3|nuevo": { ufM2: 66.8552, n: 21 },
  "Recoleta|3|usado": { ufM2: 46.2964, n: 120 },
  "San Joaquín|1|usado": { ufM2: 63.3436, n: 54 },
  "San Joaquín|2|usado": { ufM2: 55.2935, n: 113 },
  "San Joaquín|3|usado": { ufM2: 42.8201, n: 81 },
  "San Miguel|1|nuevo": { ufM2: 87.6519, n: 34 },
  "San Miguel|1|usado": { ufM2: 64.3386, n: 371 },
  "San Miguel|2|nuevo": { ufM2: 85.1436, n: 77 },
  "San Miguel|2|usado": { ufM2: 56.7044, n: 659 },
  "San Miguel|3|usado": { ufM2: 49.9768, n: 410 },
  "San Miguel|4|usado": { ufM2: 54.4899, n: 30 },
  "Santiago|1|nuevo": { ufM2: 93.137, n: 1124 },
  "Santiago|1|usado": { ufM2: 59.3474, n: 3012 },
  "Santiago|2|nuevo": { ufM2: 79.9585, n: 685 },
  "Santiago|2|usado": { ufM2: 52.833, n: 2622 },
  "Santiago|3|usado": { ufM2: 46.86, n: 800 },
  "Santiago|4|usado": { ufM2: 44.3675, n: 56 },
  "Vitacura|1|nuevo": { ufM2: 156.0236, n: 20 },
  "Vitacura|1|usado": { ufM2: 121.4301, n: 37 },
  "Vitacura|2|nuevo": { ufM2: 145.3623, n: 101 },
  "Vitacura|2|usado": { ufM2: 116.244, n: 236 },
  "Vitacura|3|nuevo": { ufM2: 144.3561, n: 86 },
  "Vitacura|3|usado": { ufM2: 99.1385, n: 616 },
  "Vitacura|4|nuevo": { ufM2: 143.3852, n: 16 },
  "Vitacura|4|usado": { ufM2: 89.9582, n: 334 },
};

/** Clave: nombre canónico de la comuna. */
export const ARRIENDO_POR_COMUNA: Record<string, CeldaArriendoComuna> = {
  "Cerrillos": { ufM2Mes: 0.2354, n: 207 },
  "Conchalí": { ufM2Mes: 0.24, n: 78 },
  "Estación Central": { ufM2Mes: 0.2083, n: 784 },
  "Huechuraba": { ufM2Mes: 0.2607, n: 41 },
  "Independencia": { ufM2Mes: 0.2245, n: 594 },
  "La Cisterna": { ufM2Mes: 0.2139, n: 477 },
  "La Florida": { ufM2Mes: 0.2445, n: 759 },
  "La Reina": { ufM2Mes: 0.3097, n: 25 },
  "Las Condes": { ufM2Mes: 0.422, n: 585 },
  "Lo Barnechea": { ufM2Mes: 0.3998, n: 87 },
  "Macul": { ufM2Mes: 0.2468, n: 398 },
  "Maipú": { ufM2Mes: 0.22, n: 51 },
  "Ñuñoa": { ufM2Mes: 0.296, n: 673 },
  "Peñalolén": { ufM2Mes: 0.2314, n: 15 },
  "Providencia": { ufM2Mes: 0.3586, n: 302 },
  "Pudahuel": { ufM2Mes: 0.2084, n: 16 },
  "Puente Alto": { ufM2Mes: 0.1936, n: 52 },
  "Quilicura": { ufM2Mes: 0.2037, n: 31 },
  "Quinta Normal": { ufM2Mes: 0.2017, n: 237 },
  "Recoleta": { ufM2Mes: 0.2176, n: 90 },
  "San Joaquín": { ufM2Mes: 0.221, n: 223 },
  "San Miguel": { ufM2Mes: 0.2237, n: 557 },
  "Santiago": { ufM2Mes: 0.2375, n: 2363 },
  "Vitacura": { ufM2Mes: 0.3993, n: 177 },
};
