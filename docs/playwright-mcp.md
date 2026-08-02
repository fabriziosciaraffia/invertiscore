# Playwright MCP — Validación visual con Claude Code

## Cómo invocarlo
En Claude Code, pedir explícitamente "usa playwright mcp para...". La primera vez es importante mencionar "playwright mcp" textualmente para que no intente usar bash en su lugar.

## Casos de uso típicos en Franco

### Validar wizard v3 paso por paso
"Usa playwright mcp para abrir localhost:3000/analisis/nuevo-v2, completar el formulario con un caso de Providencia 2D2B 75m² UF 6500, y tomar screenshot de cada step."

### Inspeccionar payload del submit
"Usa playwright mcp para llenar el wizard v3 y verificar en la pestaña network que el POST a /api/analisis incluye valorMercadoFranco en el payload."

### Validar página de resultados
"Usa playwright mcp para navegar a un análisis existente y tomar screenshots del widget Precio Alineado, gráfico patrimonio, y barras de negociación."

### Verificar consola sin errores
"Usa playwright mcp para abrir el wizard y reportar cualquier error en la consola del browser."

## Limitaciones a tener presentes
- El MCP usa un browser visible (Chromium) que se abre en la pantalla. Para flujos que requieren login (Supabase, Vercel, Flow.cl), Fabrizio puede loguearse manualmente la primera vez y las cookies persisten en la sesión.
- Para CI o ejecución headless, configurar `--headless` en el MCP args. Por ahora dejarlo headed para debug.
- El estado del browser persiste entre llamadas dentro de una misma sesión de Claude Code.
