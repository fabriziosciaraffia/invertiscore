-- Panel admin · Fase 2 · Paso 0 — audit log de acciones de admin + notas internas.
--
-- SIN EJECUTAR: la aplica Fabrizio desde el SQL Editor. Idempotente
-- (IF NOT EXISTS en tablas e índices) para que re-correrla sea inocua.
--
-- Contexto: el panel admin era 100% lectura. Fase 2 le suma acciones de
-- ESCRITURA (nota interna, reenviar informe, otorgar análisis, toggle ilimitado)
-- y somos DOS operadores → sin audit log toda escritura queda anónima y las
-- colisiones entre operadores son indetectables.
--
-- RLS en ambas tablas con CERO policies: el service role bypassea RLS, así que
-- solo el servidor lee y escribe. Un usuario autenticado no puede ver ni una
-- fila. Mismo patrón que documentos_tributarios (20260610) y credit_grants
-- (20260530), donde la ausencia de policy de INSERT es deliberada.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · admin_audit_log — una fila por INTENTO de acción de admin (ok o error)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- QUIÉN. El UUID es la identidad estable (viene de auth.getUser()); el email
  -- es SNAPSHOT: la allowlist vive en la env ADMIN_EMAIL, así que si mañana
  -- cambia o se saca a un operador, las filas viejas siguen siendo legibles.
  -- Sin ON DELETE: borrar una cuenta de admin queda BLOQUEADO mientras tenga
  -- filas acá. Es el comportamiento correcto para un log de auditoría — que se
  -- pueda borrar al autor vaciando el rastro derrota el propósito de la tabla.
  admin_user_id  UUID NOT NULL REFERENCES auth.users(id),
  admin_email    TEXT NOT NULL,

  -- QUÉ. Las 6 acciones de Fase 2. Espeja AdminAuditAction en
  -- src/lib/admin-audit.ts: agregar una acción exige tocar los DOS lados.
  -- En este paso solo note_* están implementadas; las otras 3 se declaran ya
  -- para que las acciones siguientes no necesiten migrar el CHECK.
  action         TEXT NOT NULL CHECK (action IN (
                   'resend_report',
                   'note_add',
                   'note_edit',
                   'note_delete',
                   'grant_credits',
                   'toggle_unlimited'
                 )),

  -- SOBRE QUIÉN. ON DELETE SET NULL (no CASCADE): el log tiene que SOBREVIVIR al
  -- borrado del usuario — si se borra en cascada se pierde justo la evidencia del
  -- caso que más importa. target_email queda como snapshot legible cuando la FK
  -- se anula. Mismo criterio que payments.consumed_by_analysis_id (20260715).
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email   TEXT,

  -- SOBRE QUÉ objeto concreto. target_user_id responde "qué se le hizo a este
  -- usuario" (por eso el índice); target_type/target_id apuntan al objeto:
  -- para una nota → target_user_id = usuario de la ficha, target_id = id de la
  -- nota. Sin CHECK a propósito: los tipos los define el código (AdminAuditTargetType)
  -- y no vale una migración por cada objeto nuevo que una acción futura toque.
  target_type    TEXT,
  target_id      TEXT,

  -- DIFF. Solo los campos TOCADOS, no la fila entera (volcar todo mete PII
  -- innecesaria y hace el diff ilegible). Ej. toggle: {"is_unlimited": false} →
  -- {"is_unlimited": true}. Van entre comillas porque BEFORE/AFTER son keywords
  -- no reservadas de Postgres: legal sin quotes, pero explícito se lee mejor.
  "before"       JSONB,
  "after"        JSONB,
  -- Payload de entrada / contexto: motivo, monto, destinatario del correo.
  meta           JSONB,

  -- RESULTADO. Los intentos FALLIDOS también se registran: un reenvío que rebotó
  -- o un grant que chocó es exactamente lo que se quiere ver al depurar.
  result         TEXT NOT NULL CHECK (result IN ('ok', 'error')),
  error_mensaje  TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Qué se le hizo a este usuario" (ficha de usuario, cronológico inverso).
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON admin_audit_log (target_user_id, created_at DESC);

-- "Qué hizo este operador" (revisión por admin).
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin
  ON admin_audit_log (admin_user_id, created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
-- Sin policies a propósito: solo service role.

COMMENT ON TABLE admin_audit_log IS
  'Un intento de acción de admin por fila (ok o error). Solo service role. Ver src/lib/admin-audit.ts.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · admin_notas — notas internas del equipo sobre un usuario
-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla y no columna: una columna TEXT en user_credits daría UNA nota que se
-- sobreescribe y sin autor — con dos operadores eso es una pelea silenciosa por
-- el mismo campo. La tabla da N notas, cronología y autor por nota.
CREATE TABLE IF NOT EXISTS admin_notas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ON DELETE CASCADE (a diferencia del audit log): la nota es CONTENIDO sobre
  -- un usuario, no evidencia de una acción. Si el usuario se borra (derecho a
  -- supresión), su contenido se va con él; el rastro de que hubo notas
  -- sobrevive en admin_audit_log con el email snapshoteado.
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Autor = quien CREÓ la nota. No se reescribe al editar: quién editó queda en
  -- admin_audit_log (action='note_edit'). Sin ON DELETE, igual que admin_user_id
  -- del log: la autoría no se borra sola.
  autor_user_id  UUID NOT NULL REFERENCES auth.users(id),
  autor_email    TEXT NOT NULL,

  texto          TEXT NOT NULL,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Soft delete: una nota borrada desaparece del timeline pero no del historial.
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_notas_target
  ON admin_notas (target_user_id, created_at DESC);

ALTER TABLE admin_notas ENABLE ROW LEVEL SECURITY;
-- Sin policies a propósito: solo service role. Las notas son internas del
-- equipo — el usuario NO debe poder leer lo que se escribió sobre él.

COMMENT ON TABLE admin_notas IS
  'Notas internas del equipo sobre un usuario. Soft delete via deleted_at. Solo service role.';
