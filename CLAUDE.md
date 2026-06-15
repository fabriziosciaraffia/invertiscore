# Franco (refranco.ai)

## Qué es
SaaS de análisis de inversión inmobiliaria para el mercado chileno de departamentos. El usuario ingresa los datos de un depto y recibe un **Franco Score (1-100)** con un veredicto claro — COMPRAR, AJUSTA SUPUESTOS o BUSCAR OTRA — más el análisis completo (IA, comparables, proyección de patrimonio, escenarios de salida).

**Posicionamiento:** pro-mercado, anti-intermediario oportunista. La crítica es a los corredores improvisados que se aprovechan del desconocimiento, no al rubro inmobiliario. Franco no se define en negativo ("no soy corredor") — se define en positivo: "te doy los datos honestos para que decidas bien".

**Taglines oficiales** (de `brand-voice-franco`): marca «RE FRANCO CON TU INVERSIÓN»; página «REAL ESTATE EN SU ESTADO MÁS FRANCO».

## Stack
Next.js 14 + App Router + TypeScript + Tailwind + shadcn/ui + Supabase + Claude API (Anthropic). Pagos: Flow.cl. Email: Resend. Facturación: OpenFactura/Haulmer.

## Estructura de páginas (rutas reales en `src/app/`)
- Público: `/` (landing) · `/about` · `/aprende` · `/comunas` + `/comunas/[slug]` · `/contact` · `/demo` · `/faq` · `/pricing` · `/privacy` · `/terms` · `/proximamente`
- Auth: `/login` · `/register` · `/recuperar` · `/restablecer`
- App: `/dashboard` · `/analisis/nuevo` · `/analisis/nuevo-v2` (wizard nuevo) · `/analisis/nuevo/revisar` · `/analisis/[id]` (resultados) · `/analisis/comparativa` · `/analisis/renta-corta` + `/analisis/renta-corta/[id]` (STR/Airbnb) · `/comparar` · `/checkout` · `/payments/return` · `/cuenta` · `/perfil` · `/admin`
- Share público: `/share/comparativa/[token]`

## Base de datos (Supabase)
- `analisis`: id, user_id, nombre, comuna, ciudad, input_data (jsonb), results (jsonb), is_premium (bool), pending_payment (bool), tipo_analisis, created_at
- `payments`: id, user_id, commerce_order (UNIQUE), flow_order (bigint), product, amount, status, flow_status, analysis_id, payment_data (jsonb)
- `user_credits`: user_id (PK), credits (contador legacy), subscription_status, is_unlimited, active_plan, billing_period, welcome_credit_used, grace_ends_at, subscription_ends_at, flow_customer_id
- `credit_grants`: ledger de créditos comprados (FIFO por expiración). id, user_id, amount, remaining, source, payment_id, granted_at, expires_at, consumed
- `documentos_tributarios`: boletas electrónicas (DTE 39). id, payment_id, user_id, tipo_dte, folio, monto_total/neto/iva, estado (pendiente|emitido|error|anulado), ambiente (dev|prod), token, autoservicio_url, openfactura_response (jsonb)
- `market_data`: datos de referencia por comuna · `config`: key-value global · `scraped_properties`: propiedades scrapeadas

## Modelo de acceso y precios

### Tiers (lógica en `src/lib/access.ts` + gating en `src/app/analisis/[id]/page.tsx`)
4 niveles: `guest | free | premium | subscriber` (admin → subscriber; el análisis demo → premium).
- **guest** (no logueado): contenido limitado + CTAs de registro.
- **free** (logueado, análisis no premium): análisis base, sin el panel interactivo avanzado.
- **premium** (análisis con `is_premium=true`): reporte completo de ese análisis.
- **subscriber** (suscripción activa o `is_unlimited`; admin incluido): todo desbloqueado.
- Gate verificado: el **simulador interactivo** (sliders + recalcular) y la **Advanced Section** (proyección de patrimonio, escenarios venta/refi, indicadores) son solo premium/subscriber.

### Precios (fuente de verdad: `src/lib/flow-products.ts` = montos a Flow · `src/lib/pricing.ts` = UI)
- **Análisis individual (single): $9.990** — 1 crédito al ledger (expira en 1 año).
- **Plan 10**: $39.990/mes · $395.880/año — 10 análisis/mes.
- **Plan 50**: $149.990/mes · $1.499.880/año — 50 análisis/mes.
- **Ilimitado**: $399.990/mes · $3.959.880/año — sin límite (`is_unlimited`).
- Los planes `_annual` cobran el total del año up-front. Email `fabriziosciaraffia@gmail.com` (ADMIN_EMAIL) ve todo desbloqueado.
- Orden de cobro al crear/desbloquear (`chargeAnalysisCredit`): suscripción/ilimitado (gratis) → welcome credit → ledger `credit_grants` → legacy `user_credits.credits` → si nada, cobra (Flow).

## Análisis demo protegido
ID: `6db7a9ac-f030-4ccf-b5a8-5232ae997fb1`. No se puede eliminar (protegido en los delete-button). Siempre premium (`accessLevel="premium"`). Se usa en la landing.

## Facturación electrónica (OpenFactura / Haulmer)
Emisión de **boleta electrónica afecta (TipoDTE 39)** cuando Flow confirma un pago. Emisor: Yape Digital SpA. Doc completo en `docs/facturacion-openfactura.md`.
- Helper aislado: `src/lib/openfactura/client.ts` (`emitirBoletaDTE`). Emisor fijo: `src/lib/openfactura/emisor.ts`. Tabla: `documentos_tributarios` (1:1 con `payments`).
- **Modo autoservicio**: el body lleva `customer` + `selfService` (issueBoleta + allowFactura), `documentReference.ID = flow_order` (fallback a hash del commerce_order). Devuelve FOLIO + PDF + XML + SELF_SERVICE (URL para ver/convertir a factura).
- Montos IVA incluido: `neto = round(total/1.19)`, `IVA = total − neto`.
- **Correo de la boleta**: lo envía Franco vía Resend (`sendBoletaEmail` en `src/lib/email.ts`) con PDF+XML adjuntos y subject único por folio. NO se usa `CorreoRecep`.
- **Kill-switch**: `OPENFACTURA_ENABLED` debe ser exactamente `"true"` para emitir; cualquier otro valor = no-op. `OPENFACTURA_ENV` = `dev` (CAF simulado) | `prod`. Cableado en `payments/confirm` solo para `product === "single"`, en try/catch que nunca rompe el 200 a Flow.
- Admin: sección "Documentos tributarios" en `/admin` + endpoint de reintento `POST /api/admin/documentos/retry`.

## Branding y diseño
La identidad visual completa (paleta Ink + Signal Red, tipografía Source Serif 4 / IBM Plex Sans / JetBrains Mono, patrones, templates) vive en la skill **`franco-design-system`** — consultarla SIEMPRE para cualquier trabajo visual. La voz de marca y el copy van en **`brand-voice-franco`**; UX/microcopy en **`ux-cx-franco`**; doctrina de output IA en **`analysis-voice-franco`**.

Esenciales que no cambian:
- **2 colores: Ink (#0F0F0F) + Signal Red (#C8323C).** Sin ámbar, sin verde — la jerarquía se resuelve con tipografía y escala de grises. Signal Red solo donde requiere atención (veredictos, negativos, .ai, CTAs), nunca decorativo.
- Wordmark: "re" Source Serif 4 Regular (opacity 28%) + "franco" Source Serif 4 Bold + ".ai" en Signal Red.
- Veredictos del motor (3 valores exactos): COMPRAR · AJUSTA SUPUESTOS · BUSCAR OTRA. Tratamiento cromático en `franco-design-system` — BUSCAR OTRA es el único con Signal Red (criticidad); COMPRAR y AJUSTA SUPUESTOS van en Ink.

## Reglas importantes
- Todos los textos en español chileno. Tutea, sin chilenismos ni garabatos.
- Caracteres UTF-8 directos, nunca secuencias de escape `\uXXXX`.
- Separador de miles con punto: `$420.000` (no `$420000`). Formato UF: "UF 3.200" (símbolo antes del número).
- No mencionar Portal Inmobiliario ni TocToc como fuentes. Sí Banco Central, SII, CMF (fuentes públicas).
- Cards con bordes finos (`border-franco-border`), rounded-2xl, shadow-sm. Tooltips en todas las métricas. Toggle CLP/UF que cambia TODOS los valores de la página.

## Operación

### Proceso de trabajo
- **Un paso a la vez:** ejecutar, reportar, esperar confirmación. No encadenar acciones irreversibles.
- **Diagnóstico read-only antes de escribir código:** primero entender el estado real (leer/grep/`SELECT`), recién después modificar.
- **Validar empíricamente antes de optimizar:** medir/probar contra la realidad (API, DB, render) en vez de asumir; no optimizar a ciegas.
- **Staging selectivo:** `git add <paths>` explícitos, **nunca `git add .`**. No commitear `.claude/settings.local.json` ni `scripts/of-*`.
- **Nunca push sin OK explícito del usuario.** Ramas siempre creadas desde `origin/master`; la integración a `master` es vía `git push origin <rama>:master` (fast-forward tras `git merge origin/master`; si hay conflicto, detenerse y reportar sin resolver).

### Type-check, scripts y validación
- **Type-check:** `node_modules/.bin/tsc --noEmit` (no hay script `tsc` propio; `tsx` corre los scripts). El repo puede venir sin `node_modules` → `npm ci` primero.
- **Scripts de diagnóstico/QA** (`scripts/of-*`): facturación, créditos y pruebas de correo. Corren con `node --env-file=.env.local [--import tsx] scripts/of-*.mjs`. Untracked, NO se commitean.
- **Validación visual:** hay **Playwright MCP** disponible (docs en `docs/playwright-mcp.md`).

### Variables de entorno y secrets
- Las env vars se gestionan **solo en VS Code (`.env.local`) / Vercel** — nunca setearlas en la terminal, y **nunca pegar keys/secrets en el chat**.
- **Facturación:** `OPENFACTURA_API_KEY`, `OPENFACTURA_ENV`, `OPENFACTURA_ENABLED` (ver `.env.example`). En prod la emisión está **apagada** por kill-switch hasta setear `OPENFACTURA_ENV=prod` + `OPENFACTURA_ENABLED=true` en Vercel.
