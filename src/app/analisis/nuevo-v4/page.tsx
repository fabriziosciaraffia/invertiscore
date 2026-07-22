"use client";

// Wizard v4 — ruta paralela al v3 (/analisis/nuevo-v2). Se construye completo
// acá y solo se conecta a producción cuando Fabrizio lo valide. NO reemplaza al
// v3 hasta entonces.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WizardV4 } from "@/components/formulario-v4/WizardV4";

function NuevoAnalisisV4Inner() {
  const searchParams = useSearchParams();
  const resume = searchParams.get("resume") === "1";
  return <WizardV4 resume={resume} />;
}

export default function NuevoAnalisisV4Page() {
  // useSearchParams exige límite de Suspense en App Router (igual que v3).
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--franco-bg)]" />}>
      <NuevoAnalisisV4Inner />
    </Suspense>
  );
}
