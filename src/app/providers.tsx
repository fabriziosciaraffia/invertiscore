'use client'
import { Suspense, useEffect } from 'react'
import { PostHogProvider } from '@/lib/posthog-react'
import { aplicarConsentimientoPostHog, cargarPostHog, posthogCliente } from '@/lib/posthog-cliente'
import { cuandoLaPaginaEsteQuieta } from '@/lib/pagina-quieta'
import { alCambiarConsentimiento } from '@/lib/consentimiento'
import { useUTMCapture } from '@/hooks/useUTMCapture'
import { useAttributionSync } from '@/hooks/useAttributionSync'
import { MetaPixel } from '@/components/analytics/MetaPixel'
import { AvisoCookies } from '@/components/consentimiento/AvisoCookies'

export function PHProvider({ children }: { children: React.ReactNode }) {
  // PostHog (SDK + grabación) se carga cuando la página está quieta (28-sep-2026): las opciones
  // viven en `posthog-cliente.ts`. Hasta entonces la fachada encola lo que se le pida.
  useEffect(() => cuandoLaPaginaEsteQuieta(() => { void cargarPostHog() }), [])
  // El consentimiento (19-oct-2026, lib/consentimiento.ts): sin «si», PostHog mide sin cookies ni grabación; si la
  // persona cambia de elección con la página abierta, se aplica en el momento.
  useEffect(() => alCambiarConsentimiento(aplicarConsentimientoPostHog), [])

  useUTMCapture();
  // Anota la primera visita, sincroniza la atribución cuando hay sesión y ata la
  // persona de PostHog al user_id. Va acá, en el provider global, para cubrir
  // los dos caminos de alta (email confirmado y OAuth) sin duplicar el llamado
  // en cada pantalla de auth.
  useAttributionSync();

  return (
    <PostHogProvider client={posthogCliente}>
      <Suspense fallback={null}>
        <MetaPixel />
      </Suspense>
      {children}
      <AvisoCookies />
    </PostHogProvider>
  )
}
