'use client';
import { useEffect } from 'react';
import posthog from 'posthog-js';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const LS_KEY = 'franco_utm';

export function useUTMCapture() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const utmParams: Record<string, string> = {};

    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) utmParams[key] = value;
    }

    if (Object.keys(utmParams).length > 0) {
      localStorage.setItem(LS_KEY, JSON.stringify(utmParams));
      posthog.register(utmParams);
    } else {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        try {
          posthog.register(JSON.parse(stored));
        } catch { /* ignore corrupt data */ }
      }
    }
  }, []);
}
