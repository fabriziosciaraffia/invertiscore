# Facturación electrónica — OpenFactura / Haulmer

Emisión de **boleta electrónica afecta (TipoDTE 39)** cuando Flow confirma un
pago. Emisor: **Yape Digital SpA**. Proveedor: **OpenFactura / Haulmer**.

---

## Arquitectura

| Pieza | Ubicación | Rol |
|---|---|---|
| Helper de emisión | `src/lib/openfactura/client.ts` | Arma el DTE, llama a la API, persiste el resultado. Nunca lanza. |
| Emisor fijo | `src/lib/openfactura/emisor.ts` | Datos del emisor (RUT, razón social, giro, Acteco, dirección, comuna, CdgSIISucur) de Yape, obtenidos de `GET /v2/dte/organization`. |
| Tabla | `documentos_tributarios` (`supabase/migrations/20260610_documentos_tributarios.sql`) | Un DTE por pago confirmado (1:1 con `payments.id`). |
| Diagnóstico org | `scripts/of-organization.mjs` | Lee los datos del emisor en prod. |
| Test de estructura | `scripts/of-test-emision.ts` | Valida el body del DTE contra dev-api con el contribuyente demo público. |

### Tabla `documentos_tributarios`
Campos clave: `payment_id` (FK a `payments`), `user_id`, `tipo_dte` (39),
`folio`, `monto_total` / `monto_neto` / `monto_iva`, `estado`
(`pendiente|emitido|error|anulado`), `ambiente` (`dev|prod`), `token` (TOKEN de
OpenFactura para reconstruir el PDF on-demand), `error_mensaje`,
`openfactura_response` (JSONB, **sin el PDF base64** — se elimina antes de
guardar para no inflar la fila). `pdf_url`/`xml_url` quedan NULL en V1 (reservados
para cuando se monte Storage).

**Idempotencia a nivel DB:** índice único parcial sobre `payment_id`
`WHERE estado IN ('pendiente','emitido')` → un pago no puede tener dos boletas
vivas, pero se permite re-emitir tras un `error`/`anulado`.

**RLS:** el dueño solo LEE (`user_id = auth.uid()`); toda escritura es vía
service role.

### Ambiente y kill-switch

| Env var | Valores | Efecto |
|---|---|---|
| `OPENFACTURA_ENV` | `dev` (default) / `prod` | `dev` → `https://dev-api.haulmer.com` (CAF simulado, NO válido ante SII). `prod` → `https://api.haulmer.com` (folios reales). |
| `OPENFACTURA_ENABLED` | `"true"` / cualquier otro | **Kill-switch.** Solo emite si vale exactamente `"true"`. Cualquier otro valor (o ausente) = no-op total: el helper retorna `{ ok:false, skipped:true }` sin tocar DB ni API. |
| `OPENFACTURA_API_KEY` | — | apikey del emisor (Yape). |

El monto cobrado por Flow es **IVA incluido**: `neto = round(total / 1.19)`,
`IVA = total − neto`. (Ej. single $9.990 → neto 8.395 + IVA 1.595.)

---

## Qué está cableado

**Boleta de pagos `single`** en `src/app/api/payments/confirm/route.ts` (webhook
de confirmación de Flow), dentro de `if (flowStatus === 2)`, solo para
`product === "single"` (NO legacy `pro`/`pack3`).

- **Doble guarda de idempotencia:**
  1. DB — el índice único parcial sobre `payment_id` impide dos boletas vivas.
  2. OpenFactura — header `Idempotency-Key: <commerce_order>`.
- **Doble guarda del kill-switch:** la condición del bloque incluye
  `process.env.OPENFACTURA_ENABLED === "true"` (evita trabajo inútil con la flag
  apagada), y el helper repite el chequeo internamente como segunda capa.
- **try/catch cinturón de seguridad:** una falla de boleta JAMÁS rompe el `200`
  que Flow espera, ni afecta créditos/emails ya procesados. El helper ya no
  lanza; el try/catch es redundancia defensiva.

---

## Qué NO está cableado y por qué

**Suscripciones** (`register-callback` = alta, `payment-callback` = cobro
recurrente). La emisión está marcada con `// TODO(facturación)` en ambos
webhooks, en el punto exacto donde iría, pero NO se cablea por:

- **`payment-callback` nunca se ha ejercitado en prod** — 0 filas
  `franco-sub-pay-<flowOrder>` en la DB pese a varias suscripciones reales.
- **Las altas traen `flow_order = null`** — señal de que el alta puede NO ser un
  cobro real, sino el registro de la suscripción / tokenización de la tarjeta.
- **Riesgo de facturar dinero no cobrado** si se emite en el alta, y **riesgo de
  doble boleta** del primer ciclo si tanto el alta como el cobro materializan
  filas paid para el mismo cargo.

Se resuelve **tras entender el modelo de cobro de Flow y observar un cobro real
con túnel**. Decisión probable: emitir solo en `payment-callback` (idempotencia
más fuerte: INSERT-first + `commerce_order` UNIQUE + `flowOrder`), que cubriría
alta + renovaciones sin solape. Falta además resolver el email en ese camino
(hoy no lo carga en el flujo de éxito).

> Detalle empírico en `scripts/of-audit-suscripciones.mjs` (read-only).

---

## Cómo activar en prod

1. Setear envs en prod:
   - `OPENFACTURA_ENV=prod`
   - `OPENFACTURA_ENABLED=true`
   - `OPENFACTURA_API_KEY=<apikey real de Yape>`
2. Confirmar que el contribuyente Yape (`78410649-7`) está **activo** en el
   ambiente prod de OpenFactura (en dev aparece desactivado → OF-03).
3. **Secuencia de emisión controlada:** activar primero con volumen bajo
   (pagos `single`), monitorear la sección admin "Documentos tributarios",
   verificar folio/estado de las primeras boletas reales, y recién entonces
   considerar cablear suscripciones.
4. El kill-switch permite desplegar el código a prod **sin emitir** (flag en
   `false`) y activar la emisión por separado cuando todo esté verificado.

---

## Admin

- **Sección "Documentos tributarios"** en `src/app/admin/page.tsx`: tabla con
  Fecha, Email, Folio, Producto, Monto, Estado (badge), Ambiente, Acción.
  Estados con `StatusBadge` (Capa 1: `emitido→ink-400`, `pendiente→muted`,
  `error→signal-red`, `anulado→ink-500`). Bajo el badge de error se muestra el
  `error_mensaje`.
- **Retry:** botón "Reintentar" (solo en filas `error`) →
  `POST /api/admin/documentos/retry` con `{ documentoId }`. Guard `isAdminUser`.
  Re-llama `emitirBoletaDTE` con el `payment` asociado; el índice parcial permite
  la nueva emisión porque la fila previa quedó en `error`. Si no hay email del
  usuario → `422` sin emitir. Respeta el kill-switch (si está off, responde
  `skipped` y el botón muestra "emisión desactivada").

---

## Pendiente operacional (NO del facturador)

Usuario **`5a8091f9`** pagó un plan `plan10_mensual` ($39.990, alta el
2026-06-02) y **no recibió créditos** (sin grant en `credit_grants`). Es un caso
de la Ruta B de suscripciones (problemas de sandbox), independiente de la
facturación. **Revisar y otorgar los créditos manualmente.**
