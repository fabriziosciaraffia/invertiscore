-- ─────────────────────────────────────────────────────────────────────────────
-- LA ASESORÍA · LOS DOS TOPES, EL CAMINO DEL PIE Y «AVÍSAME» DE LOS NUEVOS (27-nov-2026, ajuste de Fabrizio). PARA QUE LO APLIQUE
-- CLAUDE; no lo aplica el agente.
--
-- El pie está pensado solo para usados (20 % al contado); después vienen los nuevos con pie en cuotas y bono pie. Para no cerrarles la
-- puerta, el perfil guarda los DOS topes por separado —el de la renta y el del pie según la regla del camino—, no solo el menor
-- (tope_uf sigue siendo el menor), y el camino con que se calculó el pie (hoy, siempre «usado»; «nuevo» queda permitido para cuando
-- exista). Y la respuesta a «En deptos nuevos el pie se paga en cuotas. Pronto los sumo: ¿te aviso?» (true si tocó «Avísame»; null si
-- no), con su fecha. No se manda ningún correo todavía: solo queda guardado.
-- Columnas nuevas, todas con valor nulo o por defecto: ninguna fila existente cambia (las de Invierte quedan con camino «usado» y los
-- dos topes nulos). Sin funciones nuevas. Lo escribe /api/asesoria/perfil (filaPerfil) y /api/asesoria/interes-nuevos.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.inv_perfiles
  add column if not exists camino text not null default 'usado'
    constraint inv_perfiles_camino_check check (camino in ('usado', 'nuevo')),
  add column if not exists tope_renta_uf numeric
    constraint inv_perfiles_tope_renta_check check (tope_renta_uf is null or tope_renta_uf >= 0),
  add column if not exists tope_pie_uf numeric
    constraint inv_perfiles_tope_pie_check check (tope_pie_uf is null or tope_pie_uf >= 0),
  add column if not exists interes_nuevos boolean,
  add column if not exists interes_nuevos_at timestamptz;
