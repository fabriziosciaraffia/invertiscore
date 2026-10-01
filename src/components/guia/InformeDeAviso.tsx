"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El informe que salió de un aviso de la guía (30-sep-2026): dice de dónde sale, dice si la antigüedad
// fue supuesta, y ofrece «Quiero verlo» —Franco te hace llegar el aviso—. Solo al dueño del informe.
// El toque registra el interés y, si el aviso sigue publicado, le manda el aviso a su correo al
// instante (POST /api/lo-que-sigue/quiero-verlo, 01-oct-2026); el bloque confirma en el mismo lugar.
// Si se despublicó, lo dice en vez de confirmar.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { capturarLqs, EVENTOS_LQS } from "@/lib/lo-que-sigue/eventos";
import { INFORME_DE_AVISO } from "@/lib/guia/copy";
import "./guia.css";

/** `demo`: en /dev/lo-que-sigue el toque confirma sin registrar ni mandar el correo. */
export function InformeDeAviso({ analysisId, veredicto, antiguedad, esDueno, demo = false }: { analysisId: string; veredicto: string; antiguedad: "ficha" | "supuesta" | "nuevo"; esDueno: boolean; demo?: boolean }) {
  const posthog = usePostHog();
  const [estado, setEstado] = useState<"quieto" | "enviando" | "listo" | "despublicado" | "error">("quieto");

  async function quieroVerlo() {
    if (estado === "enviando" || estado === "listo" || estado === "despublicado") return;
    if (demo) { setEstado("listo"); return; }
    capturarLqs(posthog, EVENTOS_LQS.quieroVerloClick, { analysisId, veredicto, modalidad: "ltr" });
    setEstado("enviando");
    try {
      const r = await fetch("/api/lo-que-sigue/quiero-verlo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysisId }) });
      setEstado(r.ok ? "listo" : r.status === 410 ? "despublicado" : "error");
    } catch {
      setEstado("error");
    }
  }

  return (
    <div className="qv" data-informe-de-aviso>
      <p className="qv-origen">{INFORME_DE_AVISO.origen}</p>
      {antiguedad === "supuesta" && <p className="qv-nota">{INFORME_DE_AVISO.antiguedadSupuesta}</p>}
      {esDueno && (
        estado === "listo" ? (
          <div className="qv-caja" data-listo="1" role="status">
            <span className="qv-ok" aria-hidden="true">✓</span>
            <div>
              <div className="qv-t">{INFORME_DE_AVISO.listo}</div>
            </div>
          </div>
        ) : estado === "despublicado" ? (
          <div className="qv-caja" data-despublicado="1" role="status">
            <div className="qv-t">{INFORME_DE_AVISO.despublicado}</div>
          </div>
        ) : (
          <div className="qv-caja">
            <div>
              <div className="qv-t">{INFORME_DE_AVISO.bajada}</div>
              {estado === "error" && <p className="qv-error" role="alert">{INFORME_DE_AVISO.error}</p>}
            </div>
            <button type="button" className="qv-btn" onClick={quieroVerlo} disabled={estado === "enviando"}>
              {INFORME_DE_AVISO.boton}
            </button>
          </div>
        )
      )}
    </div>
  );
}
