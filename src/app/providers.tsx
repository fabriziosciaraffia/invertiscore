'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { Suspense, useEffect } from 'react'
import { useUTMCapture } from '@/hooks/useUTMCapture'
import { useAttributionSync } from '@/hooks/useAttributionSync'
import { MetaPixel } from '@/components/analytics/MetaPixel'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        // 'history_change': con `true` solo se capturaba la carga completa de
        // página — toda navegación client-side (Link/router.push) quedaba sin
        // $pageview y los paths de sesión salían truncados.
        capture_pageview: 'history_change',
        capture_pageleave: true,
        // Session Replay: el masking vive acá; la ACTIVACIÓN de la grabación es
        // remote config (settings del proyecto PostHog, sampling 100%). Inputs
        // enmascarados (precio, dirección, email); el texto de la página —el
        // informe que el usuario lee— queda visible, que es lo que interesa.
        session_recording: {
          maskAllInputs: true,
        },
      })
    }
  }, [])

  useUTMCapture();
  // Anota la primera visita, sincroniza la atribución cuando hay sesión y ata la
  // persona de PostHog al user_id. Va acá, en el provider global, para cubrir
  // los dos caminos de alta (email confirmado y OAuth) sin duplicar el llamado
  // en cada pantalla de auth.
  useAttributionSync();

  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <MetaPixel />
      </Suspense>
      {children}
    </PostHogProvider>
  )
}
