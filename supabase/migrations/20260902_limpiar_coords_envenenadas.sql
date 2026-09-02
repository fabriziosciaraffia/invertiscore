-- ─────────────────────────────────────────────────────────────────────────────
-- Limpieza de coordenadas envenenadas por el geocoder (enrich-coords y
-- geocodePendingProperties). Aplicar A MANO en el SQL Editor.
--
-- QUÉ PASÓ. Con GOOGLE_MAPS_API_KEY presente, geocodeAddress nunca cae a
-- Nominatim; y Google, ante un título vago ("Departamento en arriendo en
-- Santiago"), devuelve el centroide de la comuna o de la ciudad. El mismo punto
-- quedó escrito en filas de comunas DISTINTAS: 165 filas en un punto repartidas
-- en 7 comunas, 79 filas en 13 comunas. Esas filas entran a
-- properties_within_radius y por lo tanto a la sugerencia de arriendo del wizard.
--
-- CRITERIO (exacto del audit del 02-sep-2026): filas con geocode_attempted = true
-- y coordenada no nula cuyo (lat, lng) aparece en >= 2 comunas distintas DENTRO de
-- ese mismo conjunto. Control: entre las filas vía mapa (geocode_attempted = false)
-- la misma señal es 1,6% (618 de 38.379) y son fugas de viewport, no centroides;
-- entre las del geocoder es 17% (946 de 5.674).
--
-- NO se toca el grupo "misma coordenada en >= 20 filas de UNA comuna" (1.198 filas
-- del geocoder): pueden ser edificios reales y se evalúan aparte.
--
-- Conteo previo, 02-sep-2026, con esta query (SELECT, no escribe):
--
--   WITH g AS (
--     SELECT lat, lng, count(*) c, count(DISTINCT comuna) k
--     FROM scraped_properties
--     WHERE geocode_attempted = true AND lat IS NOT NULL
--     GROUP BY 1, 2
--   )
--   SELECT sum(c) AS filas_coord_multicomuna, count(*) AS coords_multicomuna
--   FROM g WHERE k >= 2;
--
--   → filas_coord_multicomuna = 946 · coords_multicomuna = 85
--
-- Se espera que el UPDATE reporte ~946 filas (más las que el cron haya sumado
-- entre el audit y la aplicación; enrich-coords sale del cron en el mismo cambio).
--
-- EFECTO POR FILA:
--   lat, lng, location → NULL  (sale de properties_within_radius, que filtra
--                               location IS NOT NULL; el trigger update_location
--                               no rehace location con lat NULL)
--   geocode_attempted  → false (vuelve a ser candidata a coordenada real)
--   geocoded           → false (la fila ya no tiene coordenada; el audit contó
--                               7.022 filas con geocoded = true y lat NULL como
--                               inconsistencia — no se agregan más)
--
-- El backfill (Fase B) trae la coordenada real desde el listado y su upsert
-- escribe sobre NULL sin pisar coordenadas existentes.
--
-- Idempotente: una segunda corrida no encuentra filas (geocode_attempted queda
-- en false). Verificación posterior: la query de conteo de arriba debe dar 0.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

WITH envenenadas AS (
  SELECT lat, lng
  FROM scraped_properties
  WHERE geocode_attempted = true AND lat IS NOT NULL AND lng IS NOT NULL
  GROUP BY lat, lng
  HAVING count(DISTINCT comuna) >= 2
)
UPDATE scraped_properties sp
SET lat = NULL,
    lng = NULL,
    location = NULL,
    geocode_attempted = false,
    geocoded = false
FROM envenenadas e
WHERE sp.geocode_attempted = true
  AND sp.lat = e.lat
  AND sp.lng = e.lng;

COMMIT;
