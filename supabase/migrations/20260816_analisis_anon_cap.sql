-- Cap anónimo (F2-2, 2026-08-16): un análisis completo gratis sin registro.
--
-- `anon_claim_token_hash` guarda el sha256 del token que viaja en la cookie
-- httpOnly `franco_anon` del creador anónimo. Es a la vez la marca de "fila
-- anónima reclamable" y el secreto del claim: el UPDATE de adopción exige
-- coincidencia de hash, así que un logueado cualquiera NO puede adoptar la
-- fila de otro (cierra el riesgo #1 del audit F2-0).
--
-- NULL = fila normal (con dueño, fixture QA, o anónima ya reclamada/expirada).
-- La marca de ORIGEN anónimo es charge_mode = 'anon_cap' y es permanente;
-- el hash es solo la ventana de claim (30 días, la expira el cron expire-anon
-- poniéndolo en NULL — las filas se RETIENEN como data de mercado).
ALTER TABLE public.analisis
  ADD COLUMN IF NOT EXISTS anon_claim_token_hash TEXT DEFAULT NULL;

-- Índice parcial: el lookup del claim y el cron solo miran filas con hash.
-- La tabla completa no paga el índice.
CREATE INDEX IF NOT EXISTS idx_analisis_anon_claim_token
  ON public.analisis (anon_claim_token_hash)
  WHERE anon_claim_token_hash IS NOT NULL;
