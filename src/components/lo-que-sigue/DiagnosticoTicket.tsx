"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El recuadro de `?lqs=1` (12-oct-2026): por qué sale o no sale el ticket del pack. Herramienta de prueba, no
// producto: sin el parámetro no se dibuja nada, y no se mide en PostHog. Las líneas salen de
// `lineasDiagnostico` (puro); acá solo se juntan los datos y se refrescan cada medio segundo.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { diagnosticoTicket, lineasDiagnostico, pideDiagnostico, type MotivoOferta } from "@/lib/lo-que-sigue/diagnostico-ticket";
import { esRegreso, leerEstadoTicket } from "@/lib/lo-que-sigue/estado-ticket";
import { horaVencimiento, ofertaPackVigente } from "@/lib/lo-que-sigue/oferta-pack";
import { usoBanner } from "@/lib/lo-que-sigue/uso-banner";

export function DiagnosticoTicket({ motivo, analysisId, createdAt, conSesion, recienDentro, bannerMontado }: {
  motivo: MotivoOferta;
  analysisId: string;
  createdAt: string;
  conSesion: boolean;
  recienDentro: boolean;
  bannerMontado: boolean;
}) {
  const [lineas, setLineas] = useState<string[] | null>(null);
  useEffect(() => {
    if (!pideDiagnostico(window.location.search)) return;
    const leer = () => {
      let almacen: Storage | null = null;
      try { almacen = window.localStorage; } catch { /* sin storage: «nunca» */ }
      const estadoLocal = leerEstadoTicket(almacen, analysisId);
      setLineas(lineasDiagnostico({
        motivo,
        vigente: ofertaPackVigente(createdAt),
        venceHora: horaVencimiento(createdAt),
        estadoLocal,
        regreso: esRegreso({ estadoLocal, conSesion, recienDentro }),
        bannerMontado,
        bannerLibreEnMs: usoBanner.libreEnMs(),
        vivo: diagnosticoTicket.leer(),
      }));
    };
    leer();
    const t = window.setInterval(leer, 500);
    return () => window.clearInterval(t);
  }, [motivo, analysisId, createdAt, conSesion, recienDentro, bannerMontado]);
  if (!lineas) return null;
  return (
    <div
      data-lqs="diagnostico"
      role="status"
      style={{
        position: "fixed", left: 12, bottom: "calc(52px + env(safe-area-inset-bottom, 0px))", zIndex: 80,
        maxWidth: "min(330px, calc(100vw - 24px))", padding: "8px 10px", borderRadius: 8,
        background: "rgba(15, 15, 15, 0.9)", color: "#FAFAF8", font: "11px/1.45 var(--font-mono, ui-monospace), monospace",
        pointerEvents: "none",
      }}
    >
      {lineas.map((l) => <div key={l}>{l}</div>)}
    </div>
  );
}
