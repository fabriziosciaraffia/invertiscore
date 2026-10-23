// ─────────────────────────────────────────────────────────────────────────────
// El informe que salió del re-análisis al precio recomendado (21-oct-2026, lib/reanalisis.ts): arriba, después de la
// portada, «Analizado a UF X, el precio que Franco recomendó negociar» y el enlace al informe original.
// TARJETA DESTACADA (22-oct-2026, decisión de Fabrizio): ya no es texto plano; va con el mismo material del banner —el
// de «Quiero verlo» y la banda de /deptos (guia.css › .qv-banda: degradado, grano, texto en papel y UN botón en papel)—,
// con la línea como título y «Ver el informe original» como botón.
// ─────────────────────────────────────────────────────────────────────────────
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { REANALISIS_COPY, type Reanalisis } from "@/lib/reanalisis";
import "@/components/guia/guia.css";

export function InformeDeReanalisis({ reanalisis, modalidad }: { reanalisis: Reanalisis; modalidad: "ltr" | "str" }) {
  const original = modalidad === "str" ? `/analisis/renta-corta/${reanalisis.origenId}` : `/analisis/${reanalisis.origenId}`;
  return (
    <div className="qv" data-informe-de-reanalisis>
      <div className="qv-banda" data-reanalisis="tarjeta">
        <div className="qv-texto">
          <p className="qv-t">{REANALISIS_COPY.linea(reanalisis.precioRecomendadoUF)}.</p>
        </div>
        <EnlaceCarga href={original} className="qv-btn" data-reanalisis-original>
          {REANALISIS_COPY.original}
        </EnlaceCarga>
      </div>
    </div>
  );
}
