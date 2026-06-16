# Franco (refranco.ai)

> Reglas permanentes de este repo. Léelas al inicio de cada sesión antes de tocar nada.
> Dos bloques: **Producto** (qué es Franco, cómo se ve/escribe) y **Operaciones** (cómo trabajar en el repo).

---

# PRODUCTO

## Qué es
SaaS de análisis de inversión inmobiliaria para el mercado chileno de departamentos (Gran Santiago). El usuario ingresa los datos de un depto y recibe un **Franco Score (1-100)** con un veredicto claro — COMPRAR, AJUSTA SUPUESTOS o BUSCAR OTRA — más el análisis completo (IA, comparables, proyección de patrimonio, escenarios de salida). Tres modalidades: **LTR** (arriendo tradicional), **STR** (renta corta / Airbnb) y **AMBAS** (comparativa).

## Posicionamiento
Franco **no compite contra el corretaje como modelo** — compite contra la mediocridad y la improvisación del corretaje. Es pro-mercado, pro-inmobiliaria y **pro-corredor que genera valor real**. La honestidad precede cualquier transacción. El roadmap incluye una plataforma transaccional (buyer's agent, marketplace) como evolución futura.
**No escribir copy "anti-corredor" ni "no soy corredor".** (El brokerage es legítimo cuando entrega valor; Franco es anti-improvisación, no anti-corredor.)

## Stack
Next.js 14 + App Router + TypeScript + Tailwind + shadcn/ui + Supabase + Claude API (Anthropic). Vercel (auto-deploy desde `master`), Flow.cl (pagos), Resend (email transaccional), PostHog (analytics). Facturación: OpenFactura/Haulmer.

## Estructura de páginas (rutas reales en `src/app/`)
- Público: `/` (landing) · `/about` · `/aprende` · `/comunas` + `/comunas/[slug]` · `/contact` · `/demo` · `/faq` · `/pricing` · `/privacy` · `/terms` · `/proximamente`
- Auth: `/login` · `/register` · `/recuperar` · `/restablecer`
- App: `/dashboard` · `/analisis/nuevo` · `/analisis/nuevo-v2` (wizard nuevo) · `/analisis/nuevo/revisar` · `/analisis/[id]` (resultados) · `/analisis/comparativa` · `/analisis/renta-corta` + `/analisis/renta-corta/[id]` (STR/Airbnb) · `/comparar` · `/checkout` · `/payments/return` · `/cuenta` · `/perfil` · `/admin`
- Share público: `/share/comparativa/[token]`

## Base de datos (Supabase)
- `analisis`: id, user_id, nombre, comuna, ciudad, input_data (jsonb), results (jsonb), is_premium (bool), pending_payment (bool), tipo_analisis, created_at — **fuente de verdad: columnas top-level (`row.X`), no `input_data`** (hay datos duplicados).
- `payments`: id, user_id, commerce_order (UNIQUE), flow_order (bigint), product, amount, status, flow_status, analysis_id, payment_data (jsonb)
- `user_credits`: user_id (PK), credits (contador legacy), subscription_status, is_unlimited, active_plan, billing_period, welcome_credit_used, grace_ends_at, subscription_ends_at, flow_customer_id
- `credit_grants`: ledger de créditos comprados (FIFO por expiración). id, user_id, amount, remaining, source, payment_id, granted_at, expires_at, consumed
- `documentos_tributarios`: boletas electrónicas (DTE 39). id, payment_id, user_id, tipo_dte, folio, monto_total/neto/iva, estado (pendiente|emitido|error|anulado), ambiente (dev|prod), token, autoservicio_url, openfactura_response (jsonb)
- `market_data`: datos de referencia por comuna · `config`: key-value global · `scraped_properties`: propiedades scrapeadas

## Modelo de acceso y precios
- Modelo de crédito: **1 análisis = 1 crédito**, sin distinción de tipo (LTR/STR/AMBAS).

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
Emisión de **boleta electrónica afecta (TipoDTE 39)** cuando Flow confirma un pago. Emisor: **Yape Digital SpA, RUT 78410649-7** (refranco.ai es la marca). Doc completo en `docs/facturacion-openfactura.md`.
- Helper aislado: `src/lib/openfactura/client.ts` (`emitirBoletaDTE`). Emisor fijo: `src/lib/openfactura/emisor.ts`. Tabla: `documentos_tributarios` (1:1 con `payments`).
- **Modo autoservicio**: el body lleva `customer` + `selfService` (issueBoleta + allowFactura), `documentReference.ID = flow_order` (fallback a hash del commerce_order). Devuelve FOLIO + PDF + XML + SELF_SERVICE (URL para ver/convertir a factura).
- Montos IVA incluido: `neto = round(total/1.19)`, `IVA = total − neto`.
- **Correo de la boleta**: lo envía Franco vía Resend (`sendBoletaEmail` en `src/lib/email.ts`) con PDF+XML adjuntos y subject único por folio. NO se usa `CorreoRecep`.
- **Kill-switch**: `OPENFACTURA_ENABLED` debe ser exactamente `"true"` para emitir; cualquier otro valor = no-op. `OPENFACTURA_ENV` = `dev` (CAF simulado) | `prod`. Cableado en dos puntos: `payments/confirm` (compras single) y `subscriptions/payment-callback` (cobros de suscripción — b229d39: monto validado, glosa de plan, idempotencia por `commerce_order`). Ambos en try/catch que nunca rompe el 200 a Flow.
- Admin: sección "Documentos tributarios" en `/admin` + endpoint de reintento `POST /api/admin/documentos/retry`.

## Branding e identidad
La identidad visual completa (paleta, tipografía, patrones, templates) vive en la skill **`franco-design-system`** — consultarla SIEMPRE para cualquier trabajo visual. La voz de marca y el copy van en **`brand-voice-franco`**; UX/microcopy en **`ux-cx-franco`**; doctrina de output IA en **`analysis-voice-franco`**. No dupliques la paleta completa ni los pesos tipográficos acá; leé la skill antes de cualquier cambio de UI.
- **Nombre**: Franco. **Dominio**: refranco.ai.
- **Wordmark**: "re" Source Serif 4 Regular (ghost, opacity 28%) + "franco" Source Serif 4 Bold + ".ai" en IBM Plex Sans SemiBold, Signal Red.
- **Tagline brand**: RE FRANCO CON TU INVERSIÓN · **Tagline página**: REAL ESTATE EN SU ESTADO MÁS FRANCO (JetBrains Mono, uppercase).
- **Fuentes**: Source Serif 4 (headings/wordmark), IBM Plex Sans (body/UI), JetBrains Mono (datos/scores/veredictos/tagline).
- **Colores de marca**: exactamente **2** — Ink `#0F0F0F` + Signal Red `#C8323C`. **Cero ámbar, cero verde** — la jerarquía se resuelve con tipografía y escala de grises. (Neutros de fondo/borde permitidos: Warm Bg `#FAFAF8`, Cool Bg `#F0F0EC`, Border `#E6E6E2`, Muted `#71717A`.)
- **Regla del rojo**: Signal Red solo cuando hay info que requiere atención (veredictos, métricas negativas, ".ai" del wordmark, CTAs premium). Nunca decoración.
- **Veredictos** (3 valores exactos): COMPRAR · AJUSTA SUPUESTOS · BUSCAR OTRA. BUSCAR OTRA es el único con Signal Red (criticidad); COMPRAR y AJUSTA SUPUESTOS van en Ink. No usar "NEGOCIAR" (obsoleto). Tratamiento cromático completo en `franco-design-system`.

## Reglas de formato de texto
- Todos los textos en **español chileno**. Tutea, sin chilenismos ni garabatos.
- Caracteres **UTF-8 directos**, nunca secuencias de escape `\uXXXX`.
- Separador de miles con punto: `$420.000` (no `$420000`). Formato UF: `UF 3.200` (símbolo antes del número).
- **No** mencionar Portal Inmobiliario ni TocToc como fuentes. Sí: Banco Central, SII, CMF (fuentes públicas).
- Cards con bordes finos (`border-franco-border`), `rounded-2xl`, `shadow-sm`. Tooltips en todas las métricas. Toggle CLP/UF que cambia TODOS los valores de la página.

---

# OPERACIONES

## Git — crítico
- **NUNCA hagas push sin OK explícito del usuario.** Aunque el cambio esté validado y tsc limpio, esperá la confirmación.
- **Staging selectivo**: nunca `git add .`. Agregá por path explícito.
- Commits en **bloques temáticos coherentes** (un tema por commit; cada commit buildable).
- Ramas siempre desde `origin/master`: `git checkout -b <rama> origin/master`.
- Push a master desde la rama feature: `git push origin <rama>:master` (fast-forward tras `git merge origin/master`).
- Si llegan commits a `origin/master` durante el trabajo: `git merge origin/master --no-edit`. Si hay **conflicto, detenete sin resolver** y reportá.
- **No commitees**: scripts de QA/diagnóstico (`scripts/of-*` y similares, untracked) ni `.claude/settings.local.json`.
- Se trabaja con **git worktrees** (uno por sesión/feature, más el principal); por eso verificá siempre `pwd` y la branch antes de cualquier operación git/npm.

## Type-check, lint y scripts
- Type-check: `node_modules/.bin/tsc --noEmit` — **NO** `npx tsc`. El repo puede venir sin `node_modules` → `npm ci` primero.
- Lint por archivo: `npx next lint --file <archivo>`.
- `npm run build` puede fallar localmente por env faltante (p.ej. `FIRECRAWL_API_KEY`): usá `tsc` para el chequeo local.
- Antes de cada commit: `tsc` limpio (exit 0) + lint del archivo tocado.
- **Scripts de diagnóstico/QA** (`scripts/of-*`): facturación, créditos y pruebas de correo. Corren con `node --env-file=.env.local [--import tsx] scripts/of-*.mjs`. Untracked, NO se commitean.

## Entorno y seguridad
- Variables de entorno: editalas **solo** en VS Code (`.env.local`) o en el dashboard de Vercel. **Nunca en terminal.**
- **Nunca** pegues keys/secrets en el chat ni en logs — solo nombres de variables.
- Para verificar una variable sin exponer su valor: `Select-String -Path .env.local -Pattern "<NOMBRE>"`.
- **Facturación:** `OPENFACTURA_API_KEY`, `OPENFACTURA_ENV`, `OPENFACTURA_ENABLED` (ver `.env.example`). En prod la emisión está **apagada** por kill-switch hasta setear `OPENFACTURA_ENV=prod` + `OPENFACTURA_ENABLED=true` en Vercel.

## Workflow
- **Diagnóstico read-only primero**: auditá el estado actual (queries SELECT, leer archivos) antes de escribir cualquier código. Nunca escribas sin entender el estado.
- **Un paso a la vez**: ejecutá, reportá el output, esperá antes de continuar. No encadenar acciones irreversibles.
- **Validá empíricamente** (sandbox, mediciones reales) antes de optimizar. No confíes en supuestos ni en docs sin verificar.
- Mostrá el diff antes de que se apruebe un commit.

## Skills y herramientas
- Antes de cualquier cambio de **UI o de prompts de IA**, leé las skills en `~/.claude/skills/`: `franco-design-system`, `analysis-voice-franco`, `brand-voice-franco`, `ux-cx-franco`, `testing-patterns-franco`. El skill activo de diseño es `franco-design-system` (no `design-system-franco`, que es backup).
- Validación visual: hay **Playwright MCP** disponible (invocación: «usa playwright mcp para [acción]»; docs en `docs/playwright-mcp.md`).
