-- ─────────────────────────────────────────────────────────────────────────────
-- B4: PRESENTAR Y RESPONDER (23-nov-2026; decisiones de Fabrizio en el LEEME del paquete «ficha-y-b4»). APLICADA POR FABRIZIO el
-- 23-nov-2026; este archivo queda igual a lo aplicado (verificado contra pg_constraint y pg_indexes). Solo agrega columnas, reglas y
-- tipos de tarea: no cambia filas (había una sola oferta, firmada, de prueba).
--
-- · La contraoferta lleva su vencimiento: lo fija quien vende y lo carga Franco; si no dice nada, 5 días corridos (lo pone la app).
-- · «Franco sugiere»: lo calcula una regla y el admin lo puede corregir, igual que el rango. Se guarda lo que dio la regla y lo que se
--   muestra (si el admin lo cambió, quién y cuándo). Nunca menos que la oferta de la persona ni más que lo que piden.
-- · La respuesta fuera de plazo: la oferta vencida queda sin acuerdo (no obliga); Franco carga igual lo que respondieron, y la persona
--   decide si la reactiva (pasa por «Revisa y firma» y crea una ronda nueva) o no.
-- · La tarea del día 3: se marca en la oferta para que la noche no la cree dos veces.
-- · Retirarla: desde firmada, en cola, presentada, contraoferta («No aceptar la contraoferta») o aceptada con la visita pendiente;
--   nunca desde en firme (lo fija la base).
-- · Aceptar una contraoferta: la persona firma ese monto (ronda nueva) y queda la tarea comunicar_aceptacion; cuando una persona de
--   Franco la marca como comunicada, la ronda queda aceptada sujeta a visita.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.inv_ofertas
  add column if not exists contraoferta_vence    timestamptz,
  add column if not exists sugerida_uf           numeric(12,2),
  add column if not exists sugerida_regla_uf     numeric(12,2),
  add column if not exists sugerida_fuente       text,
  add column if not exists sugerida_regla_version text,
  add column if not exists sugerida_por          uuid references auth.users(id),
  add column if not exists sugerida_at           timestamptz,
  add column if not exists respuesta_tardia      text,
  add column if not exists respuesta_tardia_uf   numeric(12,2),
  add column if not exists respuesta_tardia_at   timestamptz,
  add column if not exists respuesta_tardia_por  uuid references auth.users(id),
  add column if not exists tardia_decision       text,
  add column if not exists tardia_decision_at    timestamptz,
  add column if not exists insistir_tarea_at     timestamptz,
  add column if not exists retirada_at           timestamptz,
  add column if not exists retirada_desde        text;

alter table public.inv_ofertas
  add constraint inv_ofertas_contraoferta_vence check (estado <> 'contraoferta' or contraoferta_vence is not null),
  add constraint inv_ofertas_sugerida_fuente check (sugerida_fuente is null or sugerida_fuente in ('regla', 'admin')),
  add constraint inv_ofertas_sugerida_admin check (sugerida_fuente is distinct from 'admin' or (sugerida_por is not null and sugerida_at is not null)),
  add constraint inv_ofertas_sugerida_tramo check (sugerida_uf is null or (contraoferta_uf is not null and sugerida_uf >= monto_uf and sugerida_uf <= contraoferta_uf)),
  add constraint inv_ofertas_respuesta_tardia check (respuesta_tardia is null or respuesta_tardia in ('aceptada_sujeta', 'contraoferta')),
  add constraint inv_ofertas_respuesta_tardia_persona check (respuesta_tardia is null or (respuesta_tardia_por is not null and respuesta_tardia_at is not null)),
  add constraint inv_ofertas_respuesta_tardia_vencida check (respuesta_tardia is null or sin_acuerdo_motivo = 'vencida'),
  add constraint inv_ofertas_respuesta_tardia_monto check (respuesta_tardia is distinct from 'contraoferta' or respuesta_tardia_uf is not null),
  add constraint inv_ofertas_tardia_decision check (tardia_decision is null or (tardia_decision in ('reactivar', 'no_gracias') and respuesta_tardia is not null and tardia_decision_at is not null)),
  add constraint inv_ofertas_retirada check (estado <> 'retirada' or (retirada_at is not null and retirada_desde is not null)),
  add constraint inv_ofertas_retirada_desde check (retirada_desde is null or retirada_desde in ('firmada', 'en_cola', 'presentada', 'contraoferta', 'aceptada_sujeta'));

-- Las tareas nuevas: insistir al día 3, avisarle a quien vende que la retiraron, el precio publicado que bajó de la oferta, y comunicar
-- una aceptación.
alter table public.inv_tareas drop constraint inv_tareas_tipo_check;
alter table public.inv_tareas add constraint inv_tareas_tipo_check check (tipo = any (array[
  'revisar_preaprobacion', 'contactar_listo', 'explicar_preaprobacion', 'gestionar_corredor', 'avisar_alcance', 'cambio_publicacion',
  'cambio_publicador', 'confirmar_depto', 'confirmar_depto_atrasado', 'confirmar_ubicacion', 'responder_preguntas', 'cargar_recomendacion',
  'presentar_oferta', 'registrar_respuesta', 'hablar_oferta', 'hablar_con_franco', 'agendar_visita', 'hacer_visita', 'publicar_reporte',
  'fijar_hito', 'enviar_whatsapp',
  'insistir_oferta', 'avisar_retiro', 'precio_bajo_oferta', 'comunicar_aceptacion'
]::text[]));

-- La noche busca las contraofertas que vencen (las presentadas ya tienen su índice: inv_ofertas_vencen).
create index if not exists inv_ofertas_contraofertas_vencen on public.inv_ofertas (contraoferta_vence) where estado = 'contraoferta';
