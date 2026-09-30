"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Después de pagar el pack (30-sep-2026): en vez de un saldo de créditos, «Tienes 3 análisis. El
// próximo toma un minuto: tus números ya están cargados.», la frase por el veredicto del informe que
// originó la compra, y un botón que abre el wizard con lo de la persona ya respondido (pie, tasa,
// plazo, modalidad, comuna y tipología de ese informe: `?precarga=`). Sin sesión —el ticket paga sin
// ella— el botón pasa antes por el código, con el mismo destino.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { DESPUES_DE_PAGAR, RETORNO_SIN_SESION, type VeredictoLqs } from "@/lib/lo-que-sigue/copy";
import { capturarLqs, EVENTOS_LQS } from "@/lib/lo-que-sigue/eventos";
import { rutaPrecarga } from "@/lib/lo-que-sigue/oferta-pack";
import { hayGuia } from "@/lib/guia/activa";
import "./lo-que-sigue.css";

export function DespuesDePagar({ analysisId, veredicto, modalidad, conSesion }: { analysisId: string; veredicto: VeredictoLqs; modalidad: "ltr" | "str"; conSesion: boolean }) {
  const posthog = usePostHog();
  const destino = rutaPrecarga(analysisId);
  const href = conSesion ? destino : `/registro?next=${encodeURIComponent(destino)}`;

  useEffect(() => {
    capturarLqs(posthog, EVENTOS_LQS.postPagoVisto, { analysisId, veredicto, modalidad }, { con_sesion: conSesion });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  return (
    <div className="lqs-mat lqs-postpago" data-lqs="despues-de-pagar">
      <div className="lqs-fondo" aria-hidden="true" />
      <div className="lqs-col">
        <h1 className="lqs-h3">{DESPUES_DE_PAGAR.titular}</h1>
        <p className="lqs-cuerpo">{DESPUES_DE_PAGAR.cuerpo}</p>
        <p className="lqs-lead">{veredicto === "BUSCAR OTRA" && !hayGuia(modalidad) ? DESPUES_DE_PAGAR.buscarSinGuia : DESPUES_DE_PAGAR.fraseVeredicto[veredicto]}</p>
        <EnlaceCarga href={href} className="lqs-btn" data-lqs="precarga">
          {DESPUES_DE_PAGAR.boton}
        </EnlaceCarga>
        {!conSesion && <p className="lqs-legal">{RETORNO_SIN_SESION.cuerpo}</p>}
      </div>
    </div>
  );
}
