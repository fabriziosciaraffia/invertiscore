-- Snapshot de la referencia STR contra STR de la zona (strref-zona.ts · StrRefZonaSnapshot),
-- resuelta UNA vez al crear el análisis de renta corta, como capref_comuna_snapshot en LTR.
-- Foto fija: el hallazgo rentabilidad_str compara contra este dato y no se re-resuelve por
-- render; las filas anteriores (NULL) resuelven vivo al leer. Sale del caché de AirROI y de
-- los avisos de venta: cero llamadas nuevas.
--   { nivel: "celda"|"comuna"|"sin_referencia", neto, bruto, ingresoAnual, precio, m2, costosMes,
--     nDirecciones, nVenta, celda: { comuna, dormitorios }, fuente, resolvedAt }
ALTER TABLE analisis ADD COLUMN IF NOT EXISTS strref_zona_snapshot JSONB DEFAULT NULL;
