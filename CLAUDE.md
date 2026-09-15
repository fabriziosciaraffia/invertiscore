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
- `config`: key-value global · `scraped_properties`: propiedades scrapeadas · `test_accounts`: cuentas internas (filtro del panel admin) · `waitlist_zonas`: demanda por comuna fuera de cobertura
- **`market_data` NO EXISTE** — nunca se aplicó su migración y sus lectores caían a un seed que subestimaba el precio/m² entre 17% y 30%. Retirada del código el 03-ago-2026 junto con `market_stats` y `market_data_v2`. Si aparece en un comentario o en un plan, es un fantasma: la fuente viva de referencia por comuna es `scraped_properties`.
- **NULL en filtros de exclusión**: en SQL `columna <> 'x'` devuelve NULL —no `true`— cuando la columna es NULL, así que un `.neq('columna','x')` pelado en Supabase **descarta también las filas con NULL**. Para "todo lo que no sea x, incluidos los sin valor" va `.or('columna.is.null,columna.neq.x')`. Esto casi rompe la cancelación de suscripciones `past_due` en el fix del cron `expire-grace`: el `.neq` se habría comido las filas sin procedencia, que son la mayoría.
- **PostgREST capa cada respuesta en 1.000 filas sin avisar** (config del API, no del rol: `.limit(2000)` devuelve 1.000). Toda lectura de `scraped_properties` que pueda superar eso va paginada con `.range` y `.order("id")`, o cuenta con `{ count: "exact", head: true }`. Un `.limit(N)` grande sobre esa tabla es un bug aunque hoy no muerda: `market_stats` calculó medianas sobre 1.000 de 55.466 filas durante meses sin que nada lo dijera.
- **La ficha HTML de TocToc bloquea la IP a los ~36 GETs.** Ningún job la toca: el listado GetProps (paginado a 600, `estado` 1 = obra nueva / 2 = usado) trae todo lo que se persiste, y las unidades de obra nueva salen del GraphQL público de la ficha, no del HTML. Las rutas `geocode-toctoc`, `enrich-coords` y `geocode-pending` se borraron el 04-sep-2026 por eso.
- **Las coordenadas vienen en el listado.** No existe geocodificación de avisos: `lat`/`lng` salen de la fila del GetProps ([2]/[3]) o del `latitud`/`longitud` de gw-lista-seo. El geocoder por dirección que hubo escribió centroides de comuna en 946 filas (migración `20260902_limpiar_coords_envenenadas`); si una fila no trae coordenada, entra sin ella y no se inventa.

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
- **Análisis individual (single): $9.990** — 1 crédito al ledger, **sin caducidad** (`expires_at` NULL, `noExpire: true` en `payments/confirm`). Coherente con el copy "análisis sin caducidad"; los que sí expiran al año son los lotes de plan. Como el FIFO ordena por `expires_at` con los NULL al final, el usuario gasta primero lo que vence.
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
- **Tagline (único vigente)**: REAL ESTATE EN SU ESTADO MÁS FRANCO
- **Fuentes**: Source Serif 4 (headings/wordmark), IBM Plex Sans (body/UI), JetBrains Mono (datos/scores/veredictos/tagline).
- **Colores de marca**: exactamente **2** — Ink `#0F0F0F` + Signal Red `#C8323C`. **Cero ámbar, cero verde fuera de la tríada de veredicto** (ver `franco-design-system` › «Color por veredicto») — la jerarquía se resuelve con tipografía y escala de grises.
- **Color semántico por veredicto y en visualización de datos**: la excepción (tríada `--verdict` / `--verdict-deep` de banda, plumones y barra de score; `--doc-good` / `--doc-warn` del Dial, Thermo y matriz) ya no vive acá: está en `franco-design-system` › «Color por veredicto». **No la "corrijas" a Ink.**
- **Neutros (light)**: la fuente de verdad es `src/app/globals.css`, bloque `[data-theme="light"]` — **no** los hexes citados en este archivo. Tras la migración "GALERÍA" los neutros son **fríos**: `--franco-bg` `#F6F6F7` · `--franco-border` `#DDDDE1` · `--franco-text-muted` `#6B6B72`. Los cálidos viejos (`#FAFAF8`, `#F0F0EC`, `#E6E6E2`, `#71717A`) quedaron obsoletos salvo donde sobreviven como tokens `--landing-*` propios de la landing.
- **Regla del rojo**: Signal Red solo cuando hay info que requiere atención (veredictos, métricas negativas, ".ai" del wordmark, CTAs premium). Nunca decoración.
- **Veredictos** (3 valores exactos): COMPRAR · AJUSTA SUPUESTOS · BUSCAR OTRA. BUSCAR OTRA es el único con Signal Red (criticidad); COMPRAR y AJUSTA SUPUESTOS van en Ink. No usar "NEGOCIAR" (obsoleto). Tratamiento cromático completo en `franco-design-system`.

## Reglas de formato de texto
- Todos los textos en **español chileno**. Tutea, sin chilenismos ni garabatos.
- **Los REPORTES de agentes (finales e intermedios) también van en tuteo chileno neutro — cero voseo.** No es solo copy de producto: aplica a todo texto dirigido a Fabrizio. Octava detección acumulada: tres más en la línea de scraping de sep-2026. Antes de cerrar un reporte, releé la última frase y cada imperativo ("revisá", "mirá", "tenés" → "revisa", "mira", "tienes").
- **Reportes y goals también en tuteo chileno neutro, sin voseo** (nunca querés/tenés/comprás).
- **Y los PROMPTS de IA también.** El guard de voz (`voz-chilena.ts`) mira la SALIDA del modelo, no el texto con que se le pide — así que el voseo en un prompt no lo caza nadie y encima lo modela: si la instrucción dice "arrancá", el modelo aprende a escribir así. Detectado el 30-ago en `ai-generation.ts` (contrato de `negociacion.estrategiaSugerida`), corregido de paso. Al tocar un prompt, revisa los imperativos.
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
- **Worktrees con junction a node_modules**: si se crea un junction/symlink de `node_modules` apuntando al repo principal (para evitar `npm ci` en el worktree), ANTES de `git worktree remove`:
  1. Matar cualquier dev server vivo del worktree (`next dev`, etc.) — el `TaskStop` mata el wrapper de bash, no el proceso node, y deja el dir 'busy'.
  2. Eliminar el junction de forma segura (sin seguir al target).
  Razón: el `rm -rf` interno de `git worktree remove` puede seguir el junction y borrar `node_modules` del repo principal. Si pasa, el daño típico es solo `node_modules/.bin` (shims) → se repara con `npm rebuild`.

## Cierre de goals — la rama llega ff-ready

Antes del push final, en el worktree:
1. `git fetch && git rebase origin/master`
2. Re-correr gates después del rebase: `node_modules/.bin/tsc --noEmit` + `node_modules/.bin/next lint` (nunca npx) + `npm run typecheck:scripts` si se tocó `scripts/` o un tipo del motor
3. `git push --force-with-lease origin <rama>` (solo la rama, nunca master)

**Y antes de cerrar, medir el índice de memoria.** Corta en **23,4 KiB**, un KiB antes del límite real (24,4), que a `276 caracteres por goal son casi cuatro goals de aviso:

```bash
node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');const k=s.length/1024;console.log(k.toFixed(1)+' KiB '+(k>23.4?'⛔ DRENÁ ANTES DE CERRAR':'ok'))" "$HOME/.claude/projects/C--Users-fabri-invertiscore/memory/MEMORY.md"
```

El aviso que el sistema ya da llega **después** de escribir, y cuando dice «over the limit» ya hay algo invisible. Éste llega cuando todavía se puede drenar sin apuro, y es un paso del cierre — no un hook que reacciona.

Si el rebase conflictúa: DETENTE y reporta. No resolver a ciegas sobre trabajo ajeno recién mergeado.

Motivo: master avanza en paralelo. Una rama que no rebasa obliga a ritual manual de dos pasos.

## Type-check, lint y scripts
- Type-check: `node_modules/.bin/tsc --noEmit` — **NO** `npx tsc`. El repo puede venir sin `node_modules` → `npm ci` primero.
- **Type-check del tooling: `npm run typecheck:scripts`** (= `tsc --noEmit -p tsconfig.scripts.json`). El tsconfig del app **excluye `scripts/**`**, así que el gate normal NO ve la carpeta donde viven el golden y los smoke tests. Sin este gate un extractor puede leer un campo renombrado y la red de seguridad mide mal **en silencio** — pasó con el bundle del juez (4 campos rotos, 3 invisibles para `tsc`). Corre junto al type-check del app cuando se toque `scripts/` o un tipo compartido con el motor. `scripts/_archivo/` queda fuera a propósito.
- Lint por archivo: `npx next lint --file <archivo>`.
- **Lint en worktrees, si aparece:** `next lint` puede fallar con exit 1 y `Plugin "@next/next" was conflicted between ".eslintrc.json" and "..\..\..\.eslintrc.json"` — incluso sobre archivos intactos — porque ESLint sube el árbol y carga dos veces el `.eslintrc.json` del repo principal. Es entorno, no código: aíslalo corriendo lint sobre un archivo que no tocaste. Gate alternativo que sí corre: `node_modules/.bin/eslint --no-eslintrc --config .eslintrc.json --resolve-plugins-relative-to <repo-principal> --ext .ts,.tsx <archivos>`. En T5 (03-sep-2026) el conflicto NO apareció en una sesión entera usando `node <repo-principal>/node_modules/next/dist/bin/next lint --file …`; el arreglo de fondo (`"root": true` en `.eslintrc.json`) es config compartida y va en su propio cambio.
- `npm run build` puede fallar localmente por env faltante (p.ej. `FIRECRAWL_API_KEY`): usá `tsc` para el chequeo local.
- Antes de cada commit: `tsc` limpio (exit 0) + lint del archivo tocado.
- **Scripts de diagnóstico/QA** (`scripts/of-*`): facturación, créditos y pruebas de correo. Corren con `node --env-file=.env.local [--import tsx] scripts/of-*.mjs`. Untracked, NO se commitean.

## Testing
- **Un catch-test se verifica EN ROJO mutando el código que vigila, no leyendo el predicado.** Escribir el guard y releerlo no prueba nada: prueba que quien lo escribió cree que mide. La verificación es mecánica y son tres pasos — revierte la línea que el invariante protege, corre el tier, exige que salga rojo, y devuelve la línea. Sin ese paso no hay guard: hay intención.
  **Cuatro veces en el arco del pop-up (13-17 sep 2026) un catch-test estuvo VERDE sobre código roto**, y las cuatro se descubrieron por casualidad —mutando a mano o mirando el navegador—, nunca por el gate. Una auditoría posterior confirmó **102 predicados más que no miden lo que dicen, 94 de ellos en tiers que sí corren en el golden**. Los modos de falla, todos verificados por mutación:
  · **con un COMENTARIO** — el acta que explica la regla nombra el campo que el regex busca, así que la prosa satisface al guard. Borrar el render entero lo deja verde; editar un jsdoc lo pone rojo.
  · **con la FIRMA** — la captura arranca en `function f(r: X, esComprar: boolean)` y ahí está la palabra que el predicado pide.
  · **con un IMPORT** — `/hayAjustesQueMostrar/` sobre el hero lo satisface la línea 9. *Presencia ≠ cableado*: que un identificador aparezca no es que gobierne lo que dice gobernar.
  · **con una GRAFÍA** — prohibir `.map((vd)` se evade renombrando el parámetro a `w`. Un predicado puramente negativo no afirma que lo correcto exista.
  · **con una RAMA LAXA** — en `/A && \(<X|A &&/` la segunda rama es prefijo de la primera y la vuelve trivial. Y un `|` donde hacía falta un `&&` acepta que se cumpla la mitad.
  · **por VECINDAD** — `/A[^]{0,200}B/` en una función de 120 líneas, donde casi todo está a menos de 200 caracteres de casi todo.
  · **y al revés**: un predicado que exige ADYACENCIA muere en silencio cuando alguien mete una condición en el medio. Queda verde y vacío.
  Dos trampas del arnés, las dos medidas: si el extractor no encuentra su propiedad devuelve cadena vacía y el `&&` **deja pasar** (un cero de medición que no distingue «no corrió»); y en este repo **asignarle a un export para mutarlo se ignora en silencio** —tsx/esbuild los emite como getters sin setter—, así que un meta-runner escrito así da verde sin haber mutado nada.
- **Un guard que no corre en el runner se pudre.** `popup-ajustes-catch-test.ts` declaraba «corre dentro del QUICK» y nunca estuvo cableado: 20 invariantes sueltos desde el 13-sep. Y de los 28 catch-tests que solo corren a mano, **nueve están en rojo**: `zona-catch-test.ts` lleva 14 días protegiendo una regla que el repo derogó a propósito el 03-sep (`b822cf1b`). El costo no es solo dejar de cazar — es que después **ese rojo ya no se puede leer**: no se sabe si el producto se rompió o si la regla se derogó.
- **Un catch-test fija la REGLA, no la cifra.** Los que fijan valores recomputados de filas vivas del parque (`deltaPct === -22.5`, `if (umbral !== 3945)`) se ponen rojos solos cuando el motor evoluciona por decisión de producto. La forma sana está en el mismo repo: leer el tope de la constante del motor (`DIST_PIE_TOPE_PCT`) y exigir la relación (`umbral ≡ palanca precio`), no el número.
  **Y al reescribirlo, la regla se lee del módulo, no se supone.** Al sacar los pins de `decisividad-str` se iba a escribir «el 01 de la pirámide es el de mayor decisividad»: es FALSA. `orden-hallazgos.ts` promueve al adverso que pasa el piso por encima de un favorable MÁS decisivo, así que la regla verdadera es una disyunción de dos ramas. Un guard que afirma de más sobre el módulo que vigila es tan inútil como uno que no mide: da rojo sobre código sano.
- **Una fila viva puede no ejercitar la rama que el guard cree vigilar.** En las tres filas de `decisividad-str` el adverso más decisivo YA es el tope del ranking (`iAdv === 0`), así que la promoción del 01 **nunca corre**: borrarla entera dejaba las propiedades del orden en VERDE. Lo que la ejercita es un fixture de cuatro campos sobre la función pura (favorable 0,90 + adverso 0,87 ⇒ abre el adverso; con 0,80 ⇒ no). Mide qué rama corre antes de suponer que el guard la cubre — y cuando la rama no corre con datos reales, el fixture sintético sobre función pura no es un atajo: es lo único que la prueba.
- **Dos constantes que se declaran «espejo» no están atadas por nada.** `DECISIVIDAD_FLOOR` (`analysis.ts`) y `DECISIVIDAD_FLOOR_ORDEN` (`orden-hallazgos.ts`) son dos literales `0.85` en dos archivos, y si se separan el módulo calibra contra un piso y el orden promueve contra otro, en silencio, porque cada archivo sigue siendo coherente consigo mismo. Un `if (A !== B)` de una línea en el gate cuesta nada; el comentario «espejo de» no cuesta nada tampoco, y no sirve.
- **Al sacar pins, mira qué COBERTURA se va con ellos — no solo qué rigidez.** El `pisos` de `decisividad-str` fijaba cifras de filas vivas, pero además hacía `if (!f) F("está ausente")`. Al borrarlo, los 21 chequeos por factor y el invariante pirámide≡módulo quedaron todos detrás de un `if (!f) continue`: con `calcDecisividadesSTR` devolviendo `{}` el tier salía VERDE con la pirámide entera en decisividad 0. Es «un cero de medición que no distingue NO CORRIÓ» aplicado a un objeto completo, y lo agrava que `calibrar()` haga `f?.decisividad ?? 0`: la ausencia se emite como un 0 legítimo. El arreglo es un PISO DE COBERTURA — la lista de lo que siempre tiene que estar (los knobs que no dependen de datos vivos), separada de lo que puede faltar con razón (`sobreprecio` sin mediana, `capex` sin CapEx). Lo encontró una revisión adversarial del archivo ya reescrito, no las ocho mutaciones que se le habían corrido.
- **Reemplazado se retira, apagado se decide, nunca por inercia.** Una superficie sin lector no
  se borra por estar sin lector: primero hay que saber **por qué** lo perdió. Si su contenido se
  mudó a una superficie mejor, es una copia vieja y se retira. Si se apagó sin que nadie lo
  decidiera, puede ser trabajo terminado que nadie enchúfó, y eso se reconecta. Los tres casos
  del 17-sep-2026, que son la evidencia de que la distinción no es teórica:
  · **`sensibilidad` — REEMPLAZADO.** El `SensibilidadDial` ya vive en `CapitulosInversion.tsx`,
    el margen y su banda («colchón amplio/acotado») en el pop-up, y el pop-up además dice a qué
    veredicto CAE, cosa que el drawer nunca dijo. Se retira.
  · **`negociación` — REEMPLAZADO, por el capítulo y no por el pop-up.** `DrawerNegociacion`
    sigue montado en `CapitulosInversion.tsx`; lo muerto era la SEGUNDA montura. Se retira esa.
  · **`reestructuración` — APAGADO.** `EscaleraPie`, `EscaleraPlazo` y `referenciaTasa` no las
    dice ninguna superficie viva: el pop-up hace pie × plazo como GRILLA, que es otra cosa que
    una escalera contra el óptimo, y la tasa no está ahí en ninguna forma. El render se
    conserva; lo que sale es el CAMPO DE PROSA del prompt, que costaba dos bloques de 3-5
    frases para un texto sin superficie. **Lo que no se hace es lo contrario: sacar el render y
    dejar al modelo escribiendo.**
- **«Consumidores reales, no referencias» se aplica al SÍMBOLO, no al archivo.** Un archivo puede
  exportar una superficie muerta y otra viva, y el grep por archivo las confunde.
  `SUBTITULO_PLAN_SALIDA` estuvo a un paso de retirarse porque su único uso está en
  `AnalysisDrawer.tsx` —el archivo del drawer inalcanzable— y ese uso vive DENTRO de
  `DrawerNegociacion`, que el capítulo monta. Mismo error en `GenericFindingCard.tsx`: el
  componente es dev-only, pero `findingDisplay`, en el mismo archivo, alimenta el PDF STR y el
  anexo. Y mismo error al revés en `MiniCard.tsx`, que **no lo importa nadie**: el `<MiniCard>`
  que sí se renderiza es una función local de la landing, sin relación con el módulo.
- **Si un campo se audita, tiene que estar declarado en los DOS lados.** `francoCaveat` lo
  escribe el modelo en LTR y en STR y no lo renderiza nadie; STR lo tenía declarado audit-only
  en `PATHS_SIN_RENDER_STR` —con su razón: se mide, pero no paga reintento quirúrgico— y LTR no
  tenía lista. Del lado sin declaración el campo parece residuo, y alguien lo retira creyendo
  que limpia. Espejo agregado en `PATHS_SIN_RENDER_LTR` (`analysis.ts`).
- **Los tests con shim de storage no modelan el debounce de 500ms.** Cualquier operación que borre y reescriba necesita verificación en navegador midiendo el instante intermedio.

## Entorno y seguridad
- Variables de entorno: editalas **solo** en VS Code (`.env.local`) o en el dashboard de Vercel. **Nunca en terminal.**
- **Nunca** pegues keys/secrets en el chat ni en logs — solo nombres de variables.
- Para verificar una variable sin exponer su valor: `Select-String -Path .env.local -Pattern "<NOMBRE>"`.
- **Facturación:** `OPENFACTURA_API_KEY`, `OPENFACTURA_ENV`, `OPENFACTURA_ENABLED` (ver `.env.example`). En prod la emisión está **apagada** por kill-switch hasta setear `OPENFACTURA_ENV=prod` + `OPENFACTURA_ENABLED=true` en Vercel.

## Workflow
- **El índice de memoria lleva NOMBRES, no resúmenes.** Una entrada de `MEMORY.md` es un puntero: etiqueta de **60 caracteres o menos**, y el detalle en el archivo. Si la etiqueta necesita explicar, el que está mal es el archivo — arreglá el archivo. Medido el 17-sep-2026: **39% de las etiquetas pasaban de 60** y ese solo exceso era el **23% del índice**; ocho transcribían entera la `description` del archivo al que apuntaban. Y no es estética: lo que pasa del corte de lectura **se descarta en silencio**, sin avisar — el 14-sep el 21% del índice era invisible, y lo invisible eran las dos PRIORITARIAS que después fueron goals.
- **Cerrar una cola es MOVERLA.** Si un goal cerró, caducó o refutó una entrada: actualizá la `description` del archivo —no solo el cuerpo— y mové su puntero a `CERRADOS.md` **en el mismo cambio**. Cerrar sin mover no es cerrar: deja el índice creciendo con cosas muertas y la `description` mintiendo, que es peor — la `description` es lo que el recall usa para decidir si una memoria es relevante.
  **Excepción, explícita y no por inercia:** una entrada cerrada se queda en el índice **solo si lo que sobrevive es una LECCIÓN todavía aplicable**, y entonces la etiqueta nombra a la lección, no al goal. Primer uso: `cola-salidas-ia-huerfanas-salida-por-mix`, que cerró como cola y quedó como ««consumidores reales» se aplica al símbolo, no al archivo».
  **Y no todo lo que dice «cerrada» lo está**: cerrado con merge pendiente NO es cerrado — es trabajo terminado esperando una acción, y se queda en el índice diciéndolo.
- **Diagnóstico read-only primero**: auditá el estado actual (queries SELECT, leer archivos) antes de escribir cualquier código. Nunca escribas sin entender el estado.
- **Un paso a la vez**: ejecutá, reportá el output, esperá antes de continuar. No encadenar acciones irreversibles.
- **Validá empíricamente** (sandbox, mediciones reales) antes de optimizar. No confíes en supuestos ni en docs sin verificar.
- Mostrá el diff antes de que se apruebe un commit.
- **Los reportes de los agentes también van en tuteo chileno, sin voseo.** Aplica al texto que el agente escribe para el usuario, no solo al copy del producto (ya se coló voseo 5 veces — regla también en "Reglas de formato de texto").
- **QA vía browser: cada cifra reportada va con la URL exacta desde donde se leyó.** Sin URL la cifra no cuenta. Un mockup abierto en otra pestaña ya generó un bloqueante falso que costó un goal completo de diagnóstico.
- **Al mover un dato entre keys de storage: copiar primero, borrar después.** Nunca borrar y después escribir. El shim de los tests es instantáneo; el navegador real tiene debounce, y en esa ventana el dato no existe en ningún lado. Apareció dos veces: en `adoptarDraftInvitado` (invitado→registro) y en `adoptarEnEstaPestana` ("Retomar"). La segunda la cazó el paseo por el navegador, no los 25 tests.
- **Medir con la geometría del motor (sujeto ±20%), nunca con cortes fijos inventados para la medición** — un instrumento propio produce tablas de costo falsas. Al evaluar el filtro de dormitorios en obra nueva se midió con bandas fijas por tipología (3D = 65-85 m²) que no existen en el repo: en el cono oriente esa banda es la de un 2D y no cabe ni un 3D adentro (mínimo real 88,9 m² en Las Condes), así que el informe dio por perdidas cuatro celdas que con la ventana real del motor no pierden nada.
- **Constraints y esquema se verifican LEYENDO el catálogo** (`pg_constraint`, `information_schema.columns`, `pg_indexes`), nunca insertando filas de prueba: dev y prod comparten base, así que una fila de prueba es una fila en producción.
- **QA en prod: confirmá que el deploy está READY antes de ejercitar el código nuevo.** Push, merge y "deployment created" NO significan desplegado — el build tarda minutos y hasta que termina prod sigue sirviendo el commit anterior. Verificá el estado del deployment (Vercel MCP `get_deployment` → `readyState: READY` + `ready`, o el dashboard) y compará ese timestamp contra la hora de tu prueba. Un `?dry=1` recién mergeado se ejercitó 87 segundos ANTES de que su deploy quedara listo: corrió el código viejo, que ignoró el parámetro y escribió fila + grant + boleta + email. Se diagnosticó como "el dry-run no corta las escrituras" cuando el dry-run nunca había corrido. **Corolario**: que los query params aparezcan en el panel de Vercel solo prueba que llegaron en la request, NO que el código los leyó.
- **La extensión Claude-in-Chrome puede fingir bugs de UI.** Síntoma: los clicks dejan de disparar handlers pero el foco y el tecleo siguen funcionando. Es la extensión, no la app — no persigas el bug en el código. Recovery: pestaña nueva o recargar la extensión.

## Skills y herramientas
- Antes de cualquier cambio de **UI o de prompts de IA**, leé las skills en `~/.claude/skills/`: `franco-design-system`, `analysis-voice-franco`, `brand-voice-franco`, `ux-cx-franco`, `testing-patterns-franco`. El skill activo de diseño es `franco-design-system` (no `design-system-franco`, que es backup).
- **Antes de cualquier trabajo visual en modo light, verificá los tokens contra `src/app/globals.css`** (`[data-theme="light"]`) — grep primero, teoría después. Los hexes de este archivo y de las skills pueden estar stale; el CSS no.
- Validación visual: hay **Playwright MCP** disponible (invocación: «usa playwright mcp para [acción]»; docs en `docs/playwright-mcp.md`).
