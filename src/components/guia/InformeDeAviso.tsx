"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El informe que salió de un aviso de la guía (30-sep-2026): dice de dónde sale, dice si la antigüedad
// fue supuesta, y ofrece «Quiero verlo» —Franco te hace llegar el aviso—. Solo al dueño del informe.
// El toque registra el interés y, si el aviso sigue publicado, le manda el aviso a su correo al
// instante (POST /api/lo-que-sigue/quiero-verlo, 01-oct-2026); el bloque confirma en el mismo lugar.
// Si se despublicó, lo dice en vez de confirmar.
// EN BANNER (17-oct-2026, decisión de Fabrizio: es lo que la persona pagó y pasaba desapercibido): el material del banner
// del informe, texto blanco, un botón. Al tocar, el botón gira con «Mandando el aviso…»; después el bloque dice «Listo: te
// lo mandamos a [correo]» con el visto; si falla, «No pudimos mandarlo.» y «Reintentar». Sin recargar la página. Los
// estados, en quiero-verlo-estado.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { capturarLqs, EVENTOS_LQS } from "@/lib/lo-que-sigue/eventos";
import { INFORME_DE_AVISO } from "@/lib/guia/copy";
import { dicesQueConviene, estadoTrasRespuesta, sePuedeTocar, type EstadoQuieroVerlo } from "@/lib/guia/quiero-verlo-estado";
import "./guia.css";

/** `demo`: en /dev/lo-que-sigue el toque confirma sin registrar ni mandar el correo. */
/** `modalidad` (15-oct-2026): también en el informe de renta corta hecho desde un aviso del semanal; mismo botón, misma
 *  ruta y mismo correo. */
export function InformeDeAviso({ analysisId, veredicto, antiguedad, esDueno, demo = false, modalidad = "ltr" }: { analysisId: string; veredicto: string; antiguedad: "ficha" | "supuesta" | "nuevo"; esDueno: boolean; demo?: boolean; modalidad?: "ltr" | "str" }) {
  const posthog = usePostHog();
  const [estado, setEstado] = useState<EstadoQuieroVerlo>({ tipo: "quieto" });

  async function quieroVerlo() {
    if (!sePuedeTocar(estado)) return;
    if (demo) { setEstado({ tipo: "listo", correo: null }); return; }
    capturarLqs(posthog, EVENTOS_LQS.quieroVerloClick, { analysisId, veredicto, modalidad }, { reintento: estado.tipo === "error" });
    setEstado({ tipo: "enviando" });
    try {
      const r = await fetch("/api/lo-que-sigue/quiero-verlo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysisId }) });
      setEstado(estadoTrasRespuesta({ status: r.status, cuerpo: await r.json().catch(() => null) }));
    } catch {
      setEstado(estadoTrasRespuesta(null));
    }
  }

  return (
    <div className="qv" data-informe-de-aviso>
      <p className="qv-origen">{INFORME_DE_AVISO.origen}</p>
      {antiguedad === "supuesta" && <p className="qv-nota">{INFORME_DE_AVISO.antiguedadSupuesta}</p>}
      {esDueno && (
        <div className="qv-banda" data-qv={estado.tipo} aria-live="polite">
          {estado.tipo === "listo" ? (
            <p className="qv-listo" role="status"><span className="qv-ok" aria-hidden="true">✓</span>{INFORME_DE_AVISO.listo(estado.correo)}</p>
          ) : estado.tipo === "despublicado" ? (
            <p className="qv-t" role="status">{INFORME_DE_AVISO.despublicado}</p>
          ) : (
            <>
              <div className="qv-texto">
                {estado.tipo === "error" ? (
                  <p className="qv-t" role="alert">{INFORME_DE_AVISO.error}</p>
                ) : (
                  <>
                    {dicesQueConviene(veredicto) && <p className="qv-t">{INFORME_DE_AVISO.conviene}</p>}
                    <p className={dicesQueConviene(veredicto) ? "qv-s" : "qv-t"}>{INFORME_DE_AVISO.bajada}</p>
                  </>
                )}
              </div>
              <button type="button" className="qv-btn" onClick={() => void quieroVerlo()} disabled={estado.tipo === "enviando"} aria-busy={estado.tipo === "enviando"}>
                {estado.tipo === "enviando" ? (
                  <><span className="qv-gira" aria-hidden="true" />{INFORME_DE_AVISO.enviando}</>
                ) : estado.tipo === "error" ? INFORME_DE_AVISO.reintentar : INFORME_DE_AVISO.boton}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
