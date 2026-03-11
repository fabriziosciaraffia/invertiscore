# Franco (refranco.ai)

## Qué es
SaaS de análisis de inversión inmobiliaria en Chile. El usuario ingresa datos de un departamento y recibe un Franco Score de 1-100 con análisis completo. Posicionamiento: anti-corredor. "Re franco con tu inversión."

## Stack
Next.js 14 + App Router + TypeScript + Tailwind + shadcn/ui + Supabase + Claude API (Anthropic)

## Estructura de páginas
- / → Landing page
- /login, /register → Auth
- /dashboard → Lista de análisis del usuario con filtros y comparador
- /analisis/nuevo → Formulario de nuevo análisis
- /analisis/[id] → Página de resultados
- /comparar?ids=id1,id2 → Comparador lado a lado
- /pricing → Planes y precios

## Base de datos (Supabase)
- analisis: id, user_id, name, comuna, ciudad, region, input_data (jsonb), results (jsonb), is_premium (boolean), created_at
- market_data: datos de referencia por comuna (arriendo, precio/m², publicaciones)
- config: key-value para datos globales

## Modelo free/premium
- Sin registro: score + 3 métricas + radar chart
- Registrado gratis: + 8 métricas + sensibilidad + puntos críticos + comparación zona
- Premium $4.990: + cascada costos + análisis IA + flujo dinámico + proyección patrimonio + escenario salida
- Email fabriziosciaraffia@gmail.com siempre ve todo desbloqueado

## Análisis demo protegido
ID: 6db7a9ac-f030-4ccf-b5a8-5232ae997fb1
No se puede eliminar. Siempre is_premium=true. Se usa en la landing.

## BRANDING — FRANCO (refranco.ai)

### Identidad Visual
- **Nombre**: Franco (antes InvertiScore)
- **Dominio**: refranco.ai
- **Tagline**: RE FRANCO CON TU INVERSIÓN (JetBrains Mono, uppercase, muted)
- **Wordmark**: "re" en Source Serif 4 Regular (opacity 28%) + "franco" en Source Serif 4 Bold + ".ai" en Source Sans 3 SemiBold color Signal Red

### Paleta
- Ink: #0F0F0F (primary, textos, fondos oscuros, CTAs)
- Signal Red: #C8323C (acento, veredictos, .ai, premium CTAs)
- Muted: #71717A (texto secundario)
- Warm Bg: #FAFAF8 (fondo alternativo)
- Cool Bg: #F0F0EC (badges, inputs)
- Border: #E6E6E2

### Tipografía
- Headings: Source Serif 4 (font-heading) — Bold para títulos, Regular para "re" del wordmark
- Body/UI: Source Sans 3 (font-body) — Regular, Medium, SemiBold, Bold
- Data/Mono: JetBrains Mono (font-mono) — métricas, scores, veredictos, tagline

### Colores de Veredicto
- COMPRAR: #16A34A (verde)
- NEGOCIAR: #C8323C (signal red)
- BUSCAR OTRA: #DC2626 (rojo)

### Regla del rojo
Signal Red SOLO aparece cuando hay info que requiere atención: veredictos, métricas negativas, .ai del wordmark, CTAs premium. Nunca como decoración.

### Tono
- Directo > Diplomático
- Accionable > Vago
- Franco > Corporativo
- Contextualiza > Alarma
- Desafía > Se vende

## Reglas importantes
- Todos los textos en español chileno
- Caracteres UTF-8 directos, nunca secuencias de escape \uXXXX
- Separador de miles con punto: $420.000 no $420000
- Formato UF: "UF 3.200" (símbolo antes del número)
- No mencionar Portal Inmobiliario ni TocToc como fuentes de datos
- Sí mencionar Banco Central, SII, CMF (fuentes públicas)
- Cards con bordes finos (border-franco-border), rounded-2xl, shadow-sm
- Tooltips en todas las métricas explicando qué significan
- Toggle CLP/UF que cambia TODOS los valores de la página
