"use client";

// El cierre del informe anónimo (28-sep-2026): el registro en el papel, sin material, como única
// repetición. Reemplaza al «Crear cuenta para guardarlo» de NextAnalysisCTA en el primer informe.
import { CIERRE_REGISTRO, OFERTA_REGISTRO, veredictoLqs } from "@/lib/lo-que-sigue/copy";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import "./lo-que-sigue.css";

export function CierreRegistro({ veredicto, next }: { veredicto: string; next: string }) {
  return (
    <div className="lqs-cierre" data-lqs="cierre">
      <p className="lqs-cierre-t">{CIERRE_REGISTRO[veredictoLqs(veredicto)]}</p>
      <EnlaceCarga href={`/registro?next=${encodeURIComponent(next)}`} className="lqs-cierre-btn">{OFERTA_REGISTRO.barraBoton}</EnlaceCarga>
    </div>
  );
}
