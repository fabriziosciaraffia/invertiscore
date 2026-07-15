"use client";

import { ShareButton } from "@/components/chrome/ShareButton";
import { DeleteButton } from "./delete-button";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";

/**
 * Nav de la página de resultados. Wrapper fino sobre UnifiedNav variant="app"
 * (Phase 2.40) que inyecta las acciones contextuales propias de esta ruta —
 * Compartir y Eliminar — vía `actionsSlot`. La navegación general (Mis
 * análisis, Nuevo, avatar, logout) la provee UnifiedNav.
 *
 * ShareButton/DeleteButton son client components con UI propia (dropdown de
 * compartir, confirmación de borrado); por eso van como slot y no como items
 * planos del menú.
 */
export function AnalysisNav({
  userId,
  analysisId,
  score,
  nombre,
  comuna,
  isSharedView = false,
  subordinated = false,
}: {
  userId?: string | null;
  analysisId: string;
  score: number;
  nombre: string;
  comuna?: string;
  isSharedView?: boolean;
  /** Hijo subordinado de un AMBAS: sin Compartir/PDF/Eliminar propios — el share
   * y el delete viven en el comparativo (subordinación, migración 20260715). */
  subordinated?: boolean;
}) {
  const isGuest = !userId;

  // Guest o hijo subordinado: sin acciones propias (share/delete). UnifiedNav
  // conserva la navegación general.
  const actions = (isGuest || subordinated) ? null : (
    <div className="flex items-center gap-2">
      <ShareButton
        path={`/analisis/${analysisId}`}
        pdfUrl={`/api/analisis/${analysisId}/pdf`}
        analysisId={analysisId}
        modalidad="LTR"
        title={`Análisis Franco: ${nombre}`}
        text={`Mira el análisis de este depto. Score: ${score}/100`}
        score={score}
        nombre={nombre}
        comuna={comuna}
      />
      {!isSharedView && <DeleteButton id={analysisId} />}
    </div>
  );

  return <UnifiedNav variant="app" actionsSlot={actions} />;
}
