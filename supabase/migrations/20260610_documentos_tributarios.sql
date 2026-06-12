-- Facturación · Boleta electrónica (TipoDTE 39) vía OpenFactura/Haulmer.
-- Una fila = un DTE asociado 1:1 a un pago confirmado (payments.id).
-- Sin ejecutar todavía: revisar antes de correr contra Supabase.

CREATE TABLE IF NOT EXISTS documentos_tributarios (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id           UUID NOT NULL REFERENCES payments(id),
  user_id              UUID NOT NULL,
  tipo_dte             INTEGER NOT NULL,               -- 39 = boleta electrónica afecta
  folio                BIGINT,                         -- NULL hasta que OpenFactura asigna folio del CAF
  monto_total          INTEGER NOT NULL,               -- bruto cobrado (IVA incluido)
  monto_neto           INTEGER,                        -- round(monto_total / 1.19)
  monto_iva            INTEGER,                         -- monto_total - monto_neto
  estado               TEXT NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente','emitido','error','anulado')),
  ambiente             TEXT NOT NULL CHECK (ambiente IN ('dev','prod')),
  token                TEXT,   -- TOKEN OpenFactura — permite reconstruir el PDF on-demand; pdf_url/xml_url quedan para cuando se monte Storage
  pdf_url              TEXT,
  xml_url              TEXT,
  autoservicio_url     TEXT,
  error_mensaje        TEXT,
  openfactura_response JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un pago no puede tener dos boletas VIVAS (pendiente o emitida). El índice
-- parcial deja re-emitir tras un 'error' o 'anulado' (esas filas no cuentan),
-- pero bloquea una segunda emisión mientras haya una viva → idempotencia a nivel DB.
CREATE UNIQUE INDEX IF NOT EXISTS uq_documentos_tributarios_payment_vivo
  ON documentos_tributarios (payment_id)
  WHERE estado IN ('pendiente','emitido');

-- RLS: el dueño solo LEE sus documentos. Toda escritura (INSERT/UPDATE) ocurre
-- exclusivamente desde el servidor con el service role (que bypassa RLS); por eso
-- NO se define ninguna policy de INSERT/UPDATE para usuarios autenticados.
ALTER TABLE documentos_tributarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY documentos_tributarios_select_own ON documentos_tributarios
  FOR SELECT USING (auth.uid() = user_id);
