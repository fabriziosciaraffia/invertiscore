# Franco — Plan de Recuperación ante Desastres

## Servicios críticos y qué hacer si fallan

### 1. Vercel (hosting)
**Si se cae temporalmente:** Esperar. UptimeRobot te avisará cuando vuelva.
**Si pierdes acceso a la cuenta:**
- El código está en GitHub — puedes redesplegar en cualquier hosting que soporte Next.js (Railway, Render, AWS Amplify)
- Las variables de entorno están documentadas en `.env.example`
- Dominio refranco.ai está en Cloudflare — cambiar el DNS al nuevo hosting

### 2. Supabase (base de datos + auth)
**Si se cae temporalmente:** La app mostrará errores. No hay acción inmediata.
**Si pierdes acceso a la cuenta:**
- CRÍTICO: la base de datos es el activo más importante
- Contactar soporte de Supabase con el email de registro
- Si no se recupera: crear nuevo proyecto, restaurar desde backup (ver sección Backups)
**Datos que se pierden sin backup:** usuarios, análisis, pagos, propiedades scrapeadas, configuración

### 3. GitHub (código fuente)
**Si se cae temporalmente:** No afecta la app en producción (ya está desplegada en Vercel).
**Si pierdes acceso:**
- El código local en `C:\Users\fabri\invertiscore` es una copia completa
- Crear nuevo repo y hacer push
- Reconectar Vercel al nuevo repo

### 4. Flow.cl (pagos)
**Si se cae temporalmente:** Los usuarios no podrán pagar. La app sigue funcionando para análisis gratis.
**Si pierdes acceso:** Contactar soporte Flow.cl. Los pagos históricos están también en tu tabla `payments` de Supabase.

### 5. Resend (emails)
**Si se cae temporalmente:** Los emails no se envían pero la app sigue funcionando. Try/catch evita que falle el flujo principal.
**Si pierdes acceso:** Crear nueva cuenta, verificar dominio refranco.ai, actualizar API key en Vercel.

### 6. Cloudflare (dominio + DNS)
**Si pierdes acceso:** Contactar soporte con comprobante de compra del dominio. El dominio refranco.ai fue comprado en Cloudflare Registrar.

### 7. Google Cloud (Maps API + OAuth)
**Si pierdes acceso:** El formulario de análisis no funcionará (autocompletar direcciones) y el login de Google fallará.
- OAuth: reconfigurar en nueva cuenta de Google Cloud + actualizar credenciales en Supabase Auth
- Maps: crear nueva API key + actualizar en Vercel

### 8. PostHog (analytics)
**Si se cae o pierdes acceso:** No afecta la app. Se pierden datos de analytics históricos. Crear nueva cuenta y actualizar key.

### 9. Sentry (error tracking)
**Si se cae o pierdes acceso:** No afecta la app. Se pierden registros de errores. Crear nueva cuenta y actualizar DSN.

## Backups

### Estado actual
⚠️ No hay backups automáticos configurados. Supabase free no incluye backups.

### Qué respaldar (por prioridad)
1. **Base de datos completa** — tablas: analisis, payments, user_credits, scraped_properties, config, market_stats
2. **Código fuente** — GitHub + copia local
3. **Variables de entorno** — documentadas en .env.example

### Cómo hacer backup manual de Supabase
1. Ir a Supabase Dashboard → Settings → Database
2. Copiar el connection string (URI)
3. En terminal con PostgreSQL instalado:
```
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" > backup_franco_$(date +%Y%m%d).sql
```
4. Guardar el archivo en un lugar seguro (Google Drive, disco externo)

### Frecuencia recomendada
- Semanal mientras tengas pocos usuarios
- Diario cuando superes 50 usuarios activos o $100K CLP/mes en ingresos
- Considerar Supabase Pro ($25/mes) para backups automáticos cuando el negocio lo justifique

## Contactos de soporte
| Servicio | Soporte | Cuenta registrada con |
|----------|---------|----------------------|
| Vercel | vercel.com/support | GitHub OAuth |
| Supabase | supabase.com/support | fabriziosciaraffia@gmail.com |
| Flow.cl | soporte@flow.cl | RUT personal |
| Resend | resend.com/support | fabriziosciaraffia@gmail.com |
| Cloudflare | dash.cloudflare.com | fabriziosciaraffia@gmail.com |
| Google Cloud | console.cloud.google.com | fabriziosciaraffia@gmail.com |
| PostHog | posthog.com | fabriziosciaraffia@gmail.com |
| Sentry | sentry.io | fabriziosciaraffia@gmail.com |
| UptimeRobot | uptimerobot.com | fabriziosciaraffia@gmail.com |

## Checklist post-recuperación
- [ ] Sitio responde en refranco.ai
- [ ] Login con Google funciona
- [ ] Formulario de análisis carga (autocompletar dirección)
- [ ] Un análisis nuevo se procesa correctamente
- [ ] Panel admin (/admin) muestra datos
- [ ] Un pago de prueba funciona
- [ ] Emails se envían (verificar en Resend)
- [ ] Sentry captura errores
- [ ] UptimeRobot muestra UP
