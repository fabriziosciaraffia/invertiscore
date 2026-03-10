# InvertiScore — Resumen del Codebase

SaaS de análisis de inversión inmobiliaria en Chile. Next.js 14 + App Router + TypeScript + Tailwind + shadcn/ui + Supabase + Claude API.

---

## Árbol de archivos (`src/`)

```
src/
├── middleware.ts                              # Auth middleware (redirige no-auth a /login)
├── app/
│   ├── layout.tsx                             # Root layout (fuentes, metadata, Supabase provider)
│   ├── globals.css                            # Estilos globales + Tailwind + animaciones
│   ├── page.tsx                               # Landing page (scroll snap, hero, demo, pricing)
│   ├── login/page.tsx                         # Página de login con Supabase Auth
│   ├── register/page.tsx                      # Página de registro con Supabase Auth
│   ├── pricing/page.tsx                       # Planes y precios ($4.990 / $14.990)
│   ├── perfil/
│   │   ├── page.tsx                           # Perfil del usuario (datos + plan)
│   │   └── change-password-form.tsx           # Formulario cambio de contraseña
│   ├── dashboard/
│   │   ├── page.tsx                           # Server component: fetch análisis del usuario
│   │   ├── dashboard-client.tsx               # Lista de análisis con filtros, sort, selección para comparar
│   │   └── delete-button.tsx                  # Botón eliminar análisis (con protección demo)
│   ├── analisis/
│   │   ├── nuevo/page.tsx                     # Formulario de nuevo análisis (4 secciones)
│   │   └── [id]/
│   │       ├── page.tsx                       # Server component: fetch análisis + UF + zone data
│   │       ├── results-client.tsx             # Client component principal: métricas, charts, IA
│   │       ├── analysis-nav.tsx               # Navbar con score, nombre, menú hamburguesa móvil
│   │       ├── cashflow-chart.tsx             # Gráfico de flujo de caja mensual (recharts)
│   │       ├── score-circle.tsx               # Círculo SVG animado del score
│   │       ├── share-button.tsx               # Menú compartir (WhatsApp, email, X, copiar link)
│   │       ├── delete-button.tsx              # Botón eliminar con confirmación
│   │       └── metric-tooltips.tsx            # Tooltips de métricas (Rentabilidad Bruta, etc.)
│   ├── comparar/
│   │   ├── page.tsx                           # Server component: fetch múltiples análisis por IDs
│   │   └── comparar-client.tsx                # Tabla comparativa + radar + veredicto
│   └── api/
│       ├── analisis/
│       │   ├── route.ts                       # POST: crear análisis (runAnalysis + save DB)
│       │   ├── ai/route.ts                    # POST: generar análisis IA con Claude
│       │   └── recalculate/route.ts           # POST: recalcular con parámetros ajustados
│       ├── config/route.ts                    # GET: config global (tasa hipotecaria default)
│       ├── market-data/route.ts               # GET: datos de mercado por comuna + dormitorios
│       ├── payment/create/route.ts            # POST: procesar pago (marca is_premium=true)
│       ├── uf/route.ts                        # GET: valor UF actual desde API Banco Central
│       └── scraping/
│           ├── parse-listing/route.ts         # POST: extraer datos de URL de publicación
│           ├── parse-quotation/route.ts       # POST: extraer datos de PDF/imagen cotización
│           └── update-market-data/route.ts    # POST: actualizar cache de datos de mercado
├── components/
│   ├── logout-button.tsx                      # Botón cerrar sesión
│   └── ui/                                    # Componentes shadcn/ui
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       └── tooltip.tsx
└── lib/
    ├── analysis.ts                            # Motor de análisis (todas las fórmulas)
    ├── types.ts                               # Interfaces TypeScript
    ├── comunas.ts                             # Lista de comunas de Chile (~50 entries)
    ├── currency.ts                            # Helpers de formato CLP/UF
    ├── market-data.ts                         # Queries de datos de mercado (seed + DB)
    ├── market-seed.ts                         # Datos de referencia hardcoded por comuna/tipo
    ├── uf.ts                                  # Fetch UF desde API BCCh con caché
    ├── utils.ts                               # Utilidades generales (cn, etc.)
    └── supabase/
        ├── client.ts                          # Cliente Supabase browser-side
        ├── server.ts                          # Cliente Supabase server-side (cookies)
        └── middleware.ts                      # Lógica de auth middleware
```

---

## Archivos clave en detalle

### `src/lib/analysis.ts` — Motor de análisis

Funciones exportadas:

| Función | Parámetros | Retorno | Descripción |
|---------|-----------|---------|-------------|
| `setUFValue` | `(value: number)` | `void` | Setea valor UF para cálculos |
| `getUFCLP` | `()` | `number` | Retorna valor UF actual |
| `getMantencionRate` | `(antiguedad: number)` | `number` | Tasa de mantención según antigüedad (0.3%-1.5%) |
| `calcFlujoDesglose` | `(datos: {arriendo, dividendo, ggcc, contribuciones, mantencion, vacanciaMeses})` | `FlujoDesglose` | Flujo neto mensual centralizado con todos los componentes |
| `calcMetrics` | `(input: AnalisisInput)` | `AnalysisMetrics` | Calcula las 12+ métricas financieras |
| `calcScoreFromMetrics` | `(input: AnalisisInput, metrics: AnalysisMetrics)` | `number` | Score 0-100 ponderado en 5 dimensiones |
| `runAnalysis` | `(input: AnalisisInput)` | `FullAnalysisResult` | Función principal: ejecuta TODO el análisis |

Funciones internas (no exportadas):

| Función | Descripción |
|---------|-------------|
| `calcDividendo` | Cuota hipotecaria mensual (amortización francesa) |
| `saldoCredito` | Saldo de crédito en mes N |
| `calcTIR` | Tasa Interna de Retorno (Newton-Raphson) |
| `calcIngresoMensual` | Arriendo ajustado por piso |
| `calcCashflowYear1` | Flujo mes a mes del año 1 |
| `calcProjections` | Proyecciones a 20 años con inflación |
| `calcExitScenario` | Escenario de venta en año N con TIR |
| `calcRefinanceScenario` | Escenario de refinanciamiento |
| `calcSensitivity` | Análisis de sensibilidad (tasa, arriendo, vacancia) |
| `calcBreakEvenTasa` | Tasa de interés donde flujo = 0 |
| `calcValorMaximoCompra` | Precio máximo para CAP rate 5% |
| `calcEficienciaScore` | Score de eficiencia vs mercado de la zona |
| `generatePros` | Lista de puntos a favor |
| `generateContras` | Lista de puntos en contra |

Constantes clave:
- `PLUSVALIA_ANUAL = 0.04` (4% apreciación anual)
- `ARRIENDO_INFLACION = 0.035` (3.5% crecimiento arriendo)
- `GGCC_INFLACION = 0.03` (3% crecimiento costos)
- `COMISION_VENTA = 0.02` (2% comisión de venta)

Fórmulas de rentabilidad:
- **Rentabilidad Bruta** = (arriendo × 12) / precio — sin descontar nada
- **Rentabilidad Operativa (CAP Rate)** = NOI / precio — NOI = arriendo×12 - (GGCC + contribuciones + mantención)×12
- **Rentabilidad Neta** = (arriendo×12 - TODOS los gastos×12) / precio — incluye vacancia, corretaje, recambio

Score (5 dimensiones ponderadas):
- Rentabilidad: 30% (basado en rentabilidad bruta + bonus/penalty por neta)
- Flujo de Caja: 25% (positivo=80-100, negativo escalonado)
- Plusvalía: 20% (por comuna + antigüedad + piso)
- Riesgo: 15% (tipo, antigüedad, CAP rate, oversupply)
- Eficiencia: 10% (precio/m² y yield vs mercado zona)

---

### `src/app/analisis/[id]/results-client.tsx` — Resultados (client component)

**Estados (useState):**

| Estado | Default | Descripción |
|--------|---------|-------------|
| `horizonYears` | `10` | Horizonte de proyección |
| `exitMode` | `"venta"` | Modo de salida (venta/refinanciamiento) |
| `currency` | `"CLP"` | Toggle moneda CLP/UF |
| `plusvaliaRate` | `4.0` | Tasa plusvalía ajustable |
| `arriendoGrowth` | `3.5` | Crecimiento arriendo ajustable |
| `costGrowth` | `3.0` | Crecimiento costos ajustable |
| `refiPct` | `80` | LTV refinanciamiento |
| `adjPrecio` | input | Precio ajustable |
| `adjPiePct` | input | Pie % ajustable |
| `adjPlazo` | input | Plazo ajustable |
| `adjTasa` | input | Tasa ajustable |
| `adjArriendo` | input | Arriendo ajustable |
| `adjGastos` | input | Gastos ajustable |
| `adjContribuciones` | input | Contribuciones ajustable |
| `adjVacancia` | input | Vacancia ajustable |
| `drawerOpen` | `false` | Panel lateral de parámetros |
| `recalcLoading` | `false` | Estado recálculo |
| `recalcSuccess` | `false` | Feedback recálculo |
| `fabShown` | `false` | FAB visible |
| `isTouchDevice` | `false` | Detección touch |
| `aiAnalysis` | DB/null | Análisis IA cargado |
| `aiLoading` | `false` | Cargando IA |
| `aiError` | `null` | Error IA |

**Secciones principales (en orden de aparición):**

1. **Toggle CLP/UF** — Cambia todos los valores de la página
2. **3 Métricas Free** — Rentabilidad Bruta, Flujo Mensual, Precio/m² (visibles sin registro)
3. **CTA Registro** — Si es guest, invita a registrarse
4. **Radar de Dimensiones** — Gráfico radar 5 ejes (recharts)
5. **Métricas de Inversión** — 8 métricas con tooltips (gate: login)
6. **Análisis de Sensibilidad** — Tablas tasa×arriendo, vacancia×plusvalía + escenarios (gate: login)
7. **Puntos Críticos** — Break-even tasa + valor máximo de compra (gate: login)
8. **Comparación con Zona** — Barras comparativas vs mercado (gate: login)
9. **Cascada de Costos** — Waterfall chart ingresos→egresos (gate: premium)
10. **Flujo de Caja Año 1** — Tabla mes a mes (gate: premium)
11. **Proyección Patrimonial** — Gráfico 20 años con sliders (gate: premium)
12. **Escenario de Salida** — Venta año 10 o refinanciamiento año 5 (gate: premium)
13. **Pros y Contras** — Listas generadas por el motor (gate: premium)
14. **Análisis IA** — Análisis con Claude, animación typewriter (gate: premium)

---

### `src/app/analisis/nuevo/page.tsx` — Formulario de nuevo análisis

**Campos del formulario (4 secciones colapsables):**

**Sección 1 — Ubicación:**
- `comuna` — Dropdown con búsqueda (lista de ~50 comunas)
- `direccion` — Texto libre, opcional

**Sección 2 — Propiedad:**
- `superficie` — m² útiles (number)
- `dormitorios` — Select: 1, 2, 3, 4+
- `banos` — Select: 1, 2, 3
- `estacionamiento` — "si" / "no" / "opcional" + `precioEstacionamiento` si opcional
- `cantidadEstacionamientos` — Número
- `bodega` — Checkbox
- `cantidadBodegas` — Número
- `piso` — Select: 1-3, 4-8, 9-15, 16+
- `antiguedad` — Años
- `enConstruccion` — Toggle automático si estadoVenta ≠ inmediata

**Sección 3 — Financiamiento:**
- `precio` — UF o CLP (toggle)
- `piePct` — % de pie (20-50)
- `plazoCredito` — Años (15-30)
- `tasaInteres` — % anual (auto-fetched de /api/config)
- `gastos` — Gastos comunes mensuales CLP
- `contribuciones` — Contribuciones trimestrales CLP
- `provisionMantencion` — Mensual CLP (auto-calculado o manual)

**Sección 4 — Arriendo:**
- `arriendo` — Arriendo esperado mensual CLP
- `vacanciaMeses` — Meses de vacancia al año (default 1)
- `estadoVenta` — "inmediata" / "blanco" / "verde"
- `fechaEntrega` — Mes/año si blanco o verde

**Features del formulario:**
- Extracción de link: pegar URL → Firecrawl + Claude extrae datos
- Carga de cotización: PDF/imagen → Claude Vision extrae datos
- Sugerencias automáticas de mercado al seleccionar comuna
- Cálculos en tiempo real: dividendo, mantención, precio/m², pie en CLP
- Barra de progreso sticky con % completado + campos faltantes
- Auto-guardado en localStorage cada 3 segundos

**Lógica de submit:**
1. Valida campos requeridos (comuna, superficie, precio, arriendo)
2. Convierte valores a unidades correctas (UF para precio, CLP para costos)
3. `POST /api/analisis` con payload `AnalisisInput`
4. El servidor ejecuta `runAnalysis()`, guarda en Supabase, retorna ID
5. Redirect a `/analisis/[id]`

---

### API Routes

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/analisis` | POST | Crea análisis: valida input, ejecuta `runAnalysis()`, guarda en Supabase, retorna `{id}` |
| `/api/analisis/ai` | POST | Genera análisis IA: lee análisis de DB, construye prompt con métricas y datos de zona, llama Claude (claude-sonnet-4-20250514), parsea JSON, guarda en campo `ai_analysis` |
| `/api/analisis/recalculate` | POST | Recalcula con parámetros ajustados: recibe `{id, changes}`, re-ejecuta `runAnalysis()`, actualiza DB |
| `/api/config` | GET | Retorna valor de config global (ej: `?key=tasa_hipotecaria_default`) desde tabla `config` |
| `/api/market-data` | GET | Retorna datos de mercado para `?comuna=X&dormitorios=Y` (seed data + DB) |
| `/api/payment/create` | POST | Procesa pago: recibe `{analysisId}`, marca `is_premium=true` en DB |
| `/api/uf` | GET | Retorna valor UF actual consultando API del Banco Central de Chile |
| `/api/scraping/parse-listing` | POST | Recibe `{url}`, usa Firecrawl para extraer HTML, Claude extrae datos estructurados |
| `/api/scraping/parse-quotation` | POST | Recibe imagen/PDF en base64, Claude Vision extrae datos de cotización |
| `/api/scraping/update-market-data` | POST | Actualiza datos de mercado en caché/DB |

---

## Base de datos (Supabase)

**Tabla `analisis`:**
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | ID único |
| `user_id` | uuid FK | Usuario dueño |
| `nombre` | text | Nombre del análisis |
| `comuna`, `ciudad`, `direccion` | text | Ubicación |
| `tipo` | text | Tipo de propiedad |
| `dormitorios`, `banos` | int | Configuración |
| `superficie` | float | m² útiles |
| `antiguedad` | int | Años |
| `precio` | float | Precio en UF |
| `arriendo` | float | Arriendo mensual CLP |
| `gastos` | float | GGCC mensual CLP |
| `contribuciones` | float | Contribuciones trimestral CLP |
| `score` | int | InvertiScore 0-100 |
| `desglose` | jsonb | `{rentabilidad, flujoCaja, plusvalia, riesgo, eficiencia}` |
| `resumen` | text | Resumen textual |
| `results` | jsonb | `FullAnalysisResult` completo |
| `input_data` | jsonb | `AnalisisInput` original |
| `ai_analysis` | jsonb | `AIAnalysis` (generado bajo demanda) |
| `is_premium` | boolean | Análisis premium pagado |
| `created_at` | timestamp | Fecha creación |

**Tabla `config`:** key-value global (ej: `tasa_hipotecaria_default`)

**Tabla `market_data`:** datos de referencia por comuna/tipo (arriendo, precio/m², publicaciones)

---

## Control de acceso

| Nivel | Qué ve |
|-------|--------|
| **Guest** (sin registro) | Score + 3 métricas (rent. bruta, flujo, precio/m²) |
| **Free** (registrado) | + 8 métricas + radar + sensibilidad + puntos críticos + zona |
| **Premium** ($4.990) | + cascada costos + flujo año 1 + proyección + salida + pros/contras + análisis IA |
| **Admin** (fabriziosciaraffia@gmail.com) | Todo desbloqueado siempre |

Análisis demo (`6db7a9ac-...`) siempre muestra todo como premium.
