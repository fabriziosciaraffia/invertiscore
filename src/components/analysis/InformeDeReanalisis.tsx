// ─────────────────────────────────────────────────────────────────────────────
// El informe que salió del re-análisis al precio recomendado (21-oct-2026, lib/reanalisis.ts): arriba, después de la
// portada, «Analizado a UF X, el precio que Franco recomendó negociar» y el enlace al informe original. La misma línea de
// origen que el informe hecho desde un aviso (InformeDeAviso, guia.css › .qv-origen).
// ─────────────────────────────────────────────────────────────────────────────
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { REANALISIS_COPY, type Reanalisis } from "@/lib/reanalisis";
import "@/components/guia/guia.css";

export function InformeDeReanalisis({ reanalisis, modalidad }: { reanalisis: Reanalisis; modalidad: "ltr" | "str" }) {
  const original = modalidad === "str" ? `/analisis/renta-corta/${reanalisis.origenId}` : `/analisis/${reanalisis.origenId}`;
  return (
    <div className="qv" data-informe-de-reanalisis>
      <p className="qv-origen">
        {REANALISIS_COPY.linea(reanalisis.precioRecomendadoUF)}.{" "}
        <EnlaceCarga href={original} className="underline underline-offset-2" data-reanalisis-original>
          {REANALISIS_COPY.original}
        </EnlaceCarga>
      </p>
    </div>
  );
}
