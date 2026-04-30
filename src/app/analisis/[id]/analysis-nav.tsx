"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2 } from "lucide-react";
import { ShareButton } from "./share-button";
import { DeleteButton } from "./delete-button";
import { AppNav } from "@/components/chrome/AppNav";

export function AnalysisNav({
  userId,
  analysisId,
  score,
  nombre,
  comuna,
  isSharedView = false,
}: {
  userId?: string | null;
  analysisId: string;
  score: number;
  nombre: string;
  comuna?: string;
  isSharedView?: boolean;
}) {
  const isGuest = !userId;

  // ctaSlot se renderiza inline tanto en desktop como mobile via AppNav.
  // ShareButton/DeleteButton son client components con UI propia (dropdowns/
  // confirmaciones internas) — no fitean el API simple de mobileMenuItems.
  // Los labels usan `hidden sm:inline` para compactar mobile.
  const ctaSlot = isGuest ? (
    <div className="flex items-center gap-2">
      <Link href="/register" title="Regístrate para compartir este análisis">
        <Button variant="ghost" size="sm" className="gap-2 text-[var(--franco-text-secondary)]">
          <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Compartir</span>
        </Button>
      </Link>
      <Link href="/register">
        <Button size="sm" className="gap-2 bg-signal-red text-white hover:bg-signal-red/90">
          Registrarme gratis
        </Button>
      </Link>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <ShareButton id={analysisId} score={score} nombre={nombre} comuna={comuna} />
      {!isSharedView && <DeleteButton id={analysisId} />}
      <Link href={isSharedView ? "/analisis/nuevo-v2" : "/dashboard"}>
        <Button variant="ghost" size="sm" className="gap-2 text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] hover:bg-[var(--franco-card)]">
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">{isSharedView ? "Analizar mi depto" : "Dashboard"}</span>
        </Button>
      </Link>
    </div>
  );

  return <AppNav variant="app" ctaSlot={ctaSlot} />;
}
