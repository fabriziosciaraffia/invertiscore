# InvertiScore

## Qué es
SaaS de análisis de inversión inmobiliaria en Chile. El usuario ingresa datos de un departamento y recibe un score de 1-100 con análisis completo. Posicionamiento: anti-corredor.

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

## Estilo visual
- Colores: verde #059669 (primario), blanco, grises
- Tipografía: serif (Georgia) para títulos, sans-serif para body
- Cards con bordes finos, border-radius 12px
- Tooltips en todas las métricas explicando qué significan
- Toggle CLP/UF que cambia TODOS los valores de la página

## Reglas importantes
- Todos los textos en español chileno
- Caracteres UTF-8 directos, nunca secuencias de escape \uXXXX
- Separador de miles con punto: $420.000 no $420000
- Formato UF: "UF 3.200" (símbolo antes del número)
- No mencionar Portal Inmobiliario ni TocToc como fuentes de datos
- Sí mencionar Banco Central, SII, CMF (fuentes públicas)
