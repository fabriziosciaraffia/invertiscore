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
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";
import { INVIERTE_COPY, EVENTOS_INVIERTE, type DeptoInvierte } from "@/lib/invierte/invierte";
import { PUBLICACION_PORTADA } from "@/lib/guia/copy";
import { HojaInvierte } from "./HojaInvierte";
import { HojaContacto } from "@/components/invierte-v2/HojaContacto";
import "./invierte.css";

const F = INVIERTE_COPY.franja;

export function FranjaInvierte({ depto, inscrito: inscritoInicial, publicacion, demo = false, flujoV2 = null }: {
  depto: DeptoInvierte;
  inscrito: boolean;
  /** El enlace a la publicación (sale de la portada y va acá, debajo del botón). */
  publicacion: { url: string; despublicado: boolean } | null;
  demo?: boolean;
  /** Invierte con Franco, comprador (18-nov-2026): con acceso y un usado, el botón lleva al flujo nuevo, sin PRONTO ni la
   *  etiqueta de inscrito. Sin él, la franja de Pronto de siempre. */
  flujoV2?: string | null;
}) {
  const posthog = usePostHog();
  const [hoja, setHoja] = useState(false);
  const [contactoV2, setContactoV2] = useState(false);
  const [inscritoPronto, setInscrito] = useState(inscritoInicial);
  const inscrito = !flujoV2 && inscritoPronto;
  useEffect(() => {
    if (!inscritoInicial) posthog?.capture(EVENTOS_INVIERTE.ver, { aviso_id: depto.avisoId, origen: "informe", veredicto: depto.veredicto, sin_cuenta: false });
  }, [depto.avisoId, depto.veredicto, inscritoInicial, posthog]);
  return (
    <div className="inv-franja" data-invierte="franja" data-inscrito={inscrito ? "1" : undefined}>
      <div className="inv-franja-texto">
        {!flujoV2 && <span className="inv-pronto inv-pronto-claro">{INVIERTE_COPY.pronto}</span>}
        {flujoV2 ? (
          <>
            <p className="inv-franja-t">{FLUJO_COPY.contacto.titulo}</p>
            <p className="inv-franja-s">{FLUJO_COPY.contacto.parrafo}</p>
          </>
        ) : inscrito ? (
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
              if (flujoV2 && !demo) { setContactoV2(true); return; }
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
      {contactoV2 && flujoV2 && !demo && (
        <HojaContacto depto={depto} origen="informe" analysisId={depto.analysisId ?? null} alCerrar={() => setContactoV2(false)} />
      )}
      {hoja && !demo && (
        <HojaInvierte depto={depto} origen="informe" alInscrito={() => setInscrito(true)} alCerrar={() => setHoja(false)} />
      )}
    </div>
  );
}
