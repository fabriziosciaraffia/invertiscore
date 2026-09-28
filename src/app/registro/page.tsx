"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /registro (28-sep-2026): el registro en un paso a pantalla completa, en el material del hero.
// Lo usa el pack (el checkout necesita cuenta) y el cierre del primer informe anónimo. Correo con
// enlace o Google; vuelve por /auth/callback al `next`. La página clásica /register sigue para
// quien llega por otro lado.
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { esDestinoSeguro } from "@/lib/auth-next";
import { RegistroUnPaso } from "@/components/lo-que-sigue/RegistroUnPaso";
import "@/components/lo-que-sigue/lo-que-sigue.css";

export default function RegistroPage() {
  return (
    <Suspense fallback={null}>
      <RegistroContenido />
    </Suspense>
  );
}

function RegistroContenido() {
  const sp = useSearchParams();
  const nextRaw = sp.get("next");
  const next = esDestinoSeguro(nextRaw) ? nextRaw : "/dashboard";
  const analysisId = (() => {
    try {
      return new URL(next, "https://refranco.ai").searchParams.get("analysisId") ?? "";
    } catch {
      return "";
    }
  })();
  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <HeaderFranco contexto="auth" />
      <div className="lqs-mat lqs-pagina">
        <div className="lqs-fondo" aria-hidden="true" />
        <div className="lqs-col">
          <RegistroUnPaso next={next} ctx={{ analysisId, veredicto: "", modalidad: "ltr" }} />
        </div>
      </div>
    </div>
  );
}
