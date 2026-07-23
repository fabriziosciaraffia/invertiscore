'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { Suspense, useEffect } from 'react'
import { useUTMCapture } from '@/hooks/useUTMCapture'
import { MetaPixel } from '@/components/analytics/MetaPixel'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        capture_pageview: true,
        capture_pageleave: true,
      })
    }
  }, [])

  useUTMCapture();

  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <MetaPixel />
      </Suspense>
      {children}
    </PostHogProvider>
  )
}
