"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA FRANJA DE LA PORTADA DEL INFORME (11-nov-2026, mockup InformePortadaPronto.dc.html, textos tal cual). Reemplaza a «Este depto
// conviene con tus números · Mandármelo por correo» cuando el informe salió de un aviso (usado o nuevo de inmobiliaria) que da ✓ Comprar o − Ajustar
// negociable (invierte-servidor.ts › invierteDelInforme): PRONTO, «¿Quieres invertir? Pronto Franco te acompaña.», el texto, el
// botón «Invierte con Franco» y, debajo, «Ver la publicación ↗», que sale de la tarjeta oscura de la portada. Sin la comisión.
// Inscrito, la misma franja confirma con los textos de la confirmación.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { INVIERTE_COPY, EVENTOS_INVIERTE, type DeptoInvierte } from "@/lib/invierte/invierte";
import { PUBLICACION_PORTADA } from "@/lib/guia/copy";
import { HojaInvierte } from "./HojaInvierte";
import "./invierte.css";

const F = INVIERTE_COPY.franja;

export function FranjaInvierte({ depto, inscrito: inscritoInicial, publicacion, demo = false }: {
  depto: DeptoInvierte;
  inscrito: boolean;
  /** El enlace a la publicación (sale de la portada y va acá, debajo del botón). */
  publicacion: { url: string; despublicado: boolean } | null;
  demo?: boolean;
}) {
  const posthog = usePostHog();
  const [hoja, setHoja] = useState(false);
  const [inscrito, setInscrito] = useState(inscritoInicial);
  useEffect(() => {
    if (!inscritoInicial) posthog?.capture(EVENTOS_INVIERTE.ver, { aviso_id: depto.avisoId, origen: "informe", veredicto: depto.veredicto, sin_cuenta: false });
  }, [depto.avisoId, depto.veredicto, inscritoInicial, posthog]);
  return (
    <div className="inv-franja" data-invierte="franja" data-inscrito={inscrito ? "1" : undefined}>
      <div className="inv-franja-texto">
        <span className="inv-pronto inv-pronto-claro">{INVIERTE_COPY.pronto}</span>
        {inscrito ? (
          <>
            <p className="inv-franja-t">{INVIERTE_COPY.listo.titulo}</p>
            <p className="inv-franja-s">{INVIERTE_COPY.listo.texto} {INVIERTE_COPY.listo.sub}</p>
          </>
        ) : (
          <>
            <p className="inv-franja-t">{F.titulo}</p>
            <p className="inv-franja-s">{F.texto}</p>
          </>
        )}
      </div>
      <div className="inv-franja-acciones">
        {inscrito ? (
          <span className="inv-etiqueta inv-etiqueta-clara" data-invierte="inscrito">{INVIERTE_COPY.inscrito}</span>
        ) : (
          <button
            type="button"
            className="inv-franja-btn"
            data-invierte="boton"
            onClick={() => {
              posthog?.capture(EVENTOS_INVIERTE.abrir, { aviso_id: depto.avisoId, origen: "informe", veredicto: depto.veredicto, sin_cuenta: false });
              setHoja(true);
            }}
          >
            {INVIERTE_COPY.boton}
          </button>
        )}
        {publicacion && (publicacion.despublicado ? (
          <span className="inv-franja-enlace" data-publicacion="baja">{PUBLICACION_PORTADA.baja}</span>
        ) : (
          <a href={publicacion.url} target="_blank" rel="noopener noreferrer" className="inv-franja-enlace" data-publicacion="enlace">{PUBLICACION_PORTADA.enlace} ↗</a>
        ))}
      </div>
      {hoja && !demo && (
        <HojaInvierte depto={depto} origen="informe" alInscrito={() => setInscrito(true)} alCerrar={() => setHoja(false)} />
      )}
    </div>
  );
}
