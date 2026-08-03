"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import {
  ATTRIBUTION_SYNCED_KEY,
  UTM_KEYS,
  UTM_STORAGE_KEY,
  type AtribucionInput,
} from "@/lib/attribution";

/**
 * Clave de la PRIMERA visita (referrer + landing path). Aparte de `franco_utm`
 * a propósito: `useUTMCapture` sobrescribe su clave cada vez que llega un UTM
 * nuevo, y acá se necesita lo contrario —el origen de la primera visita, que no
 * se toca nunca más. Separarlas evita tocar ese hook y mezclar dos políticas de
 * escritura distintas en la misma clave.
 */
const ORIGIN_STORAGE_KEY = "franco_origin";

interface OrigenGuardado {
  referrer?: string;
  landing_path?: string;
}

/** Anota la primera visita. No hace nada si ya había una anotada (first-touch). */
function anotarPrimeraVisita(): void {
  try {
    if (localStorage.getItem(ORIGIN_STORAGE_KEY)) return;
    const origen: OrigenGuardado = {
      // El referrer interno no es origen: si venís de otra página del sitio, no
      // te "trajo" nadie. Solo se guarda el externo.
      referrer:
        document.referrer && !document.referrer.startsWith(window.location.origin)
          ? document.referrer
          : undefined,
      landing_path: window.location.pathname,
    };
    localStorage.setItem(ORIGIN_STORAGE_KEY, JSON.stringify(origen));
  } catch {
    /* localStorage puede fallar en modo privado — no es motivo para romper nada */
  }
}

function leerJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Cierra el círculo de la atribución y del cruce con PostHog.
 *
 * Hace tres cosas, todas idempotentes y todas silenciosas ante error:
 *
 *  1. Anota la primera visita (referrer + landing path) apenas carga la app,
 *     haya sesión o no. Tiene que ser ANTES del registro: cuando el usuario se
 *     da de alta, el referrer original ya se perdió.
 *
 *  2. Cuando hay sesión, manda a POST /api/attribution lo que juntó el
 *     navegador (los UTM de `useUTMCapture` + la primera visita). El servidor ya
 *     escribió fbp/fbc desde /auth/callback; la RPC es first-touch y solo
 *     rellena NULLs, así que las dos mitades se suman sin pisarse.
 *     Se hace UNA vez por usuario (marca en localStorage), no por visita.
 *
 *  3. `posthog.identify(user.id)` — sin esto, la persona de PostHog y la fila de
 *     auth.users son dos universos separados y no hay forma de mirar la sesión
 *     de un usuario concreto desde el panel. Es barato y idempotente: PostHog
 *     ignora un identify repetido con el mismo distinct_id.
 */
export function useAttributionSync(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    anotarPrimeraVisita();

    let cancelado = false;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelado) return;

        // ── PostHog: atar la sesión anónima al usuario ──
        try {
          posthog?.identify(user.id, user.email ? { email: user.email } : undefined);
        } catch {
          /* PostHog sin inicializar (sin key en el env) — no es un problema */
        }

        // ── Atribución: una sola vez por usuario ──
        if (localStorage.getItem(ATTRIBUTION_SYNCED_KEY) === user.id) return;

        const utms = leerJson<Record<string, string>>(UTM_STORAGE_KEY) ?? {};
        const origen = leerJson<OrigenGuardado>(ORIGIN_STORAGE_KEY) ?? {};

        const payload: AtribucionInput = {
          referrer: origen.referrer ?? null,
          landing_path: origen.landing_path ?? null,
        };
        for (const k of UTM_KEYS) {
          payload[k] = utms[k] ?? null;
        }

        // Sin nada que contar, igual se marca como sincronizado: un usuario de
        // tráfico directo no tiene por qué pagar un fetch en cada visita.
        const hayAlgo = Object.values(payload).some((v) => v != null);
        if (hayAlgo) {
          const res = await fetch("/api/attribution", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          // Solo se marca si el server respondió. Un 401 (sesión que expiró
          // entremedio) deja el sync pendiente para el próximo intento.
          if (!res.ok) return;
        }

        if (!cancelado) localStorage.setItem(ATTRIBUTION_SYNCED_KEY, user.id);
      } catch {
        /* atribución perdida > login roto: nunca propagamos */
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);
}
