"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL DASHBOARD SE ACTUALIZA SOLO AL VOLVER (21-oct-2026, recorrido real de Fabrizio por la puerta B): al volver del
// informe —atrás, o «Mis análisis» del header—, Next muestra la página que tenía guardada (el caché del router o el del
// navegador), sin el informe nuevo, con el saldo de antes y sin «Ya lo analizaste». Si lo que se ve se dibujó hace más de
// FRESCO_MS, se le pide de nuevo al servidor (router.refresh), sin recargar: la lista, el saldo y la selección. También
// cuando el navegador la restaura de su caché (`pageshow` persistido).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const FRESCO_MS = 8000;

/** ¿Lo que se ve es viejo? Recién dibujado no: el primer montaje no pide dos veces. */
export function debeRefrescar(dibujadoAt: number, ahora: number): boolean {
  return ahora - dibujadoAt > FRESCO_MS;
}

export function FrescoAlVolver({ dibujadoAt }: { dibujadoAt: number }) {
  const router = useRouter();
  useEffect(() => {
    if (debeRefrescar(dibujadoAt, Date.now())) router.refresh();
    const alVolver = (e: PageTransitionEvent) => { if (e.persisted) router.refresh(); };
    window.addEventListener("pageshow", alVolver);
    return () => window.removeEventListener("pageshow", alVolver);
  }, [dibujadoAt, router]);
  return null;
}
