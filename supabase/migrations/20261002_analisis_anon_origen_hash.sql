-- El navegador de origen (02-oct-2026). Al reclamar un análisis anónimo (anon-claim.ts), el hash del
-- token de la cookie `franco_anon` se borra de `anon_claim_token_hash` (la ventana de claim se cierra)
-- y desde ese momento el informe, abierto SIN sesión en el mismo navegador donde se hizo, se veía como
-- ajeno: «Compartido contigo» y contenido recortado. Le pasaba a quien pagó el pack desde el ticket (el
-- pago reclama el informe) y a quien abandonó el pago.
--
-- `anon_origen_hash` conserva ese mismo hash después del claim. NO es una ventana de claim (nada se
-- adopta con él): solo deja que informe-ltr / informe-str reconozcan al navegador de origen —sin
-- sesión, cookie cuyo sha256 calza— y le muestren su informe completo, con el header «Tu análisis».
-- Otro navegador no tiene la cookie: sigue viéndolo como compartido. Con sesión manda la sesión.
--
-- Sin índice: se compara contra la fila ya leída por id, nunca se busca por esta columna.
ALTER TABLE public.analisis
  ADD COLUMN IF NOT EXISTS anon_origen_hash TEXT DEFAULT NULL;

COMMENT ON COLUMN public.analisis.anon_origen_hash IS
  'sha256 del token franco_anon del navegador donde se creó el análisis anónimo, conservado tras el claim. Solo reconoce al navegador de origen para mostrarle su informe completo sin sesión; no habilita ningún claim.';
