'use client'
import { Suspense, useEffect } from 'react'
import { PostHogProvider } from '@/lib/posthog-react'
import { cargarPostHog, posthogCliente } from '@/lib/posthog-cliente'
import { cuandoLaPaginaEsteQuieta } from '@/lib/pagina-quieta'
import { useUTMCapture } from '@/hooks/useUTMCapture'
import { useAttributionSync } from '@/hooks/useAttributionSync'
import { MetaPixel } from '@/components/analytics/MetaPixel'

export function PHProvider({ children }: { children: React.ReactNode }) {
  // PostHog (SDK + grabación) se carga cuando la página está quieta (28-sep-2026): las opciones
  // viven en `posthog-cliente.ts`. Hasta entonces la fachada encola lo que se le pida.
  useEffect(() => cuandoLaPaginaEsteQuieta(() => { void cargarPostHog() }), [])

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
    </PostHogProvider>
  )
}
