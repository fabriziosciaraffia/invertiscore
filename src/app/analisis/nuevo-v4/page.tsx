"use client";

// Wizard v4 — ruta paralela al v3 (/analisis/nuevo-v2). Se construye completo
// acá y solo se conecta a producción cuando Fabrizio lo valide. NO reemplaza al
// v3 hasta entonces.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WizardV4 } from "@/components/formulario-v4/WizardV4";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
import { COMUNAS } from "@/lib/comunas";

function NuevoAnalisisV4Inner() {
  const searchParams = useSearchParams();
  const resume = searchParams.get("resume") === "1";

  // ?comuna= — llega desde las páginas SEO ("Analizar depto en Ñuñoa"). Antes se
  // ignoraba y el usuario tipeaba todo de cero.
  //
  // Solo PRECARGA contexto: no saltea el paso de dirección, que necesitamos
  // exacta igual (la pantalla exige `direccionConfirmada` de Places para
  // avanzar, y los comparables piden lat/lng). Si Places devuelve otra comuna,
  // la pisa sin conflicto.
  //
  // Se valida contra la cobertura: una comuna no cubierta dispararía el mensaje
  // de "fuera del Gran Santiago" antes de que el usuario escriba nada.
  const comunaParam = searchParams.get("comuna")?.trim() || "";
  const match = COMUNAS.find((c) => c.comuna.toLowerCase() === comunaParam.toLowerCase());
  const comunaInicial = match && isComunaDisponible(match.comuna) ? match : null;

  // ?origen= — superficie del CTA que trajo al usuario. Viaja para que quede en
  // el $current_url del pageview automático; el wizard no lo usa para nada más.
  return (
    <WizardV4
      resume={resume}
      comunaInicial={comunaInicial ? { comuna: comunaInicial.comuna, ciudad: comunaInicial.ciudad } : null}
    />
  );
}

export default function NuevoAnalisisV4Page() {
  // useSearchParams exige límite de Suspense en App Router (igual que v3).
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--franco-bg)]" />}>
      <NuevoAnalisisV4Inner />
    </Suspense>
  );
}
