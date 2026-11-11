"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El informe que salió de un aviso de la guía (30-sep-2026): dice de dónde sale, dice si la antigüedad
// fue supuesta, y ofrece «Quiero verlo» —Franco te hace llegar el aviso—. Solo al dueño del informe.
// El toque registra el interés y, si el aviso sigue publicado, le manda el aviso a su correo al
// instante (POST /api/lo-que-sigue/quiero-verlo, 01-oct-2026); el bloque confirma en el mismo lugar.
// Si se despublicó, lo dice en vez de confirmar.
// LA ANTIGÜEDAD SUPUESTA (03-nov-2026): la nota dice por qué —la publicación no dice el año, o no pudimos leerla— (`supuesta`,
// guia/edad-edificio.ts › supuestaDelInforme). Con el año conocido no hay nota: lo dice la ficha de la portada.
// EN BANNER (17-oct-2026, decisión de Fabrizio: es lo que la persona pagó y pasaba desapercibido): el material del banner
// del informe, texto blanco, un botón. Al tocar, el botón gira con «Mandando el aviso…»; después el bloque dice «Listo: te
// lo mandamos a [correo]» con el visto; si falla, «No pudimos mandarlo.» y «Reintentar». Sin recargar la página. Los
// estados, en quiero-verlo-estado.ts. Si el aviso ya había salido (otro día, tras recargar), «Ya te lo mandamos el [día]
// a [correo], con el asunto «…».» (19-oct-2026): ese toque no manda nada y no puede decir «Listo».
// «MANDÁRMELO POR CORREO» (27-oct-2026, decisión de Fabrizio): el enlace a la publicación ya está en la portada, junto a
// «Ficha del depto» (publicacion-portada.ts); el botón de acá deja de ser «Quiero verlo» y es para tenerlo en el correo.
// «PRONTO: INVIERTE CON FRANCO» (11-nov-2026, goal de Fabrizio): si el aviso es usado y da Comprar o Ajustar negociable
// (`invierte`, invierte-servidor.ts › invierteDelInforme), la franja «Mandármelo por correo» se reemplaza por FranjaInvierte,
// que lleva debajo de su botón el enlace a la publicación (la portada ya no lo repite). En los demás, la franja de siempre.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { capturarLqs, EVENTOS_LQS } from "@/lib/lo-que-sigue/eventos";
import { INFORME_DE_AVISO } from "@/lib/guia/copy";
import { cuandoSeEnvio, dicesQueConviene, estadoTrasRespuesta, sePuedeTocar, type EstadoQuieroVerlo } from "@/lib/guia/quiero-verlo-estado";
import { botonOcupado } from "@/lib/carga-global";
import { ConfirmacionEnviado } from "./ConfirmacionEnviado";
import type { SupuestaPor } from "@/lib/guia/edad-edificio";
import type { PublicacionPortada } from "@/lib/guia/publicacion-portada";
import type { InvierteInforme } from "@/lib/invierte/invierte-servidor";
import { FranjaInvierte } from "@/components/invierte/FranjaInvierte";
import "./guia.css";

/** `demo`: en /dev/lo-que-sigue el toque confirma sin registrar ni mandar el correo. */
/** `modalidad` (15-oct-2026): también en el informe de renta corta hecho desde un aviso del semanal; mismo botón, misma
 *  ruta y mismo correo. */
export function InformeDeAviso({ analysisId, veredicto, supuesta, esDueno, demo = false, modalidad = "ltr", invierte = null, publicacion = null }: { analysisId: string; veredicto: string; supuesta: SupuestaPor | null; esDueno: boolean; demo?: boolean; modalidad?: "ltr" | "str"; invierte?: InvierteInforme | null; publicacion?: PublicacionPortada }) {
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
      {supuesta && <p className="qv-nota" data-antiguedad-supuesta={supuesta}>{INFORME_DE_AVISO.antiguedadSupuesta[supuesta]}</p>}
      {esDueno && invierte && (
        <FranjaInvierte depto={invierte.depto} inscrito={invierte.inscrito} publicacion={publicacion ? { url: publicacion.url, despublicado: publicacion.despublicado } : null} demo={demo} />
      )}
      {esDueno && !invierte && (
        <div className="qv-banda" data-qv={estado.tipo} aria-live="polite">
          {estado.tipo === "listo" ? (
            <ConfirmacionEnviado tipo="listo" correo={estado.correo} />
          ) : estado.tipo === "ya" ? (
            <ConfirmacionEnviado tipo="ya" correo={estado.correo} cuando={cuandoSeEnvio(estado.enviadoAt)} asunto={estado.asunto} />
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
              <button type="button" className="qv-btn" onClick={() => void quieroVerlo()} disabled={estado.tipo === "enviando"} {...botonOcupado(estado.tipo === "enviando")}>
                {estado.tipo === "enviando" ? INFORME_DE_AVISO.enviando : estado.tipo === "error" ? INFORME_DE_AVISO.reintentar : INFORME_DE_AVISO.boton}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
