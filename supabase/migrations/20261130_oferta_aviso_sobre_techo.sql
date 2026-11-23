-- ─────────────────────────────────────────────────────────────────────────────
-- EL AVISO «DEJA DE CONVENIR» DE LA OFERTA (22-nov-2026, decisión de Fabrizio). PARA QUE LO APLIQUE CLAUDE; no lo aplica el agente.
-- En un Ajusta supuestos, ofrecer sobre el precio al que el depto vuelve a Comprar trae el aviso «Sobre UF X este depto deja de
-- convenir.» (no bloquea). La firma guarda qué aviso vio la persona en `inv_ofertas.aviso_nivel`: suma el valor 'sobre_techo'.
-- Sin esta migración, firmar una oferta sobre ese precio falla con «No pudimos firmar tu oferta» (el check la rechaza).
-- Nombre del check leído del catálogo el 22-nov-2026 (pg_constraint): inv_ofertas_aviso_nivel_check.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.inv_ofertas drop constraint if exists inv_ofertas_aviso_nivel_check;
alter table public.inv_ofertas add constraint inv_ofertas_aviso_nivel_check
  check (aviso_nivel in ('ninguno','bajo_piso','bajo_piso_fuerte','sobre_recomendado','sobre_techo'));
