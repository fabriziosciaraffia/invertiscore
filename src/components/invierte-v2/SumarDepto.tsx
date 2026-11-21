"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SUMAR UN DEPTO (entrega 2, 19-nov-2026): «Seguir con este» en la base y «Sumar a mis opciones» en la pantalla que abre el mapa
// (lámina 3.3-sumar-otro-depto). Un toque suma (POST /api/invierte-v2/sumar) y lleva a la base; sus detalles se preparan en
// segundo plano, sin créditos. Con seis activos, antes de sumar pregunta cuál deja (una ventana con la lista; nada se suelta
// sin elegirlo). Mientras envía, el botón queda ocupado y no se puede apretar dos veces.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_ACTIVOS } from "@/lib/invierte-v2/opciones";
import { BASE_COPY, SUMAR_COPY, lineaDepto, type LineaDepto } from "@/lib/invierte-v2/base";
import { URL_BASE } from "@/lib/invierte-v2/destino";
import { prepararEnSegundoPlano } from "@/lib/invierte-v2/detalles-cliente";
import { olvidarMenu } from "@/lib/invierte-v2/menu-cliente";
import { VentanaDocumento } from "./VentanaDocumento";

export const URL_SUMAR_API = "/api/invierte-v2/sumar";

export function SumarDepto({ avisoId, etiqueta, origen, activos, variante }: {
  avisoId: string;
  etiqueta: string;
  origen: "base" | "mapa";
  /** Los que ya sigue (para elegir cuál deja si ya tiene seis). */
  activos: { avisoId: string; datos: LineaDepto }[];
  /** «secundario» (A3, lámina 3.x-sumar-sobre-el-rango): el «Sumar» de un parecido, como botón gris chico. */
  variante: "principal" | "enlace" | "secundario";
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const [deja, setDeja] = useState<string | null>(null);

  async function sumar(dejaId: string | null) {
    if (enviando) return;
    setEnviando(true);
    setError(false);
    try {
      const res = await fetch(URL_SUMAR_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avisoId, deja: dejaId, origen }) });
      if (res.ok) { prepararEnSegundoPlano([avisoId]); olvidarMenu(); router.push(URL_BASE); router.refresh(); return; }
      const d = (await res.json().catch(() => null)) as { error?: string } | null;
      if (d?.error === "maximo") { setEligiendo(true); setEnviando(false); return; }
      setError(true);
    } catch {
      setError(true);
    }
    setEnviando(false);
  }

  const lleno = activos.length >= MAX_ACTIVOS;
  return (
    <>
      <button type="button" className={variante === "principal" ? "inv-principal iv2-principal" : variante === "secundario" ? "iv2-secundario iv2-sumar-chico" : "iv2-enlace-azul iv2-seguir"} disabled={enviando}
        aria-busy={enviando || undefined} onClick={() => (lleno ? setEligiendo(true) : void sumar(null))} data-inv2={origen === "mapa" ? "boton-sumar" : "seguir-con-este"}>
        {etiqueta}
      </button>
      {error && <p className="inv-error" role="alert" data-inv2="sumar-error">{BASE_COPY.error}</p>}
      {eligiendo && (
        <VentanaDocumento nombre="dejar-uno" titulo={SUMAR_COPY.dejarUno} variante="lista" alCerrar={() => { setEligiendo(false); setDeja(null); }}
          meta={<span>{BASE_COPY.maximo}</span>}
          pie={<>
            {error && <p className="inv-error" role="alert">{BASE_COPY.error}</p>}
            <button type="button" className="inv-principal iv2-principal" disabled={!deja || enviando} aria-busy={enviando || undefined} onClick={() => void sumar(deja)} data-inv2="dejar-y-sumar">
              {etiqueta}
            </button>
          </>}>
          <fieldset className="iv2-dejar" data-inv2="dejar-uno">
            <legend className="iv2-sr">{SUMAR_COPY.dejarUno}</legend>
            {activos.map((a) => (
              <label key={a.avisoId} className="iv2-casilla iv2-dejar-op">
                <input type="radio" name="deja" value={a.avisoId} checked={deja === a.avisoId} onChange={() => setDeja(a.avisoId)} />
                <span>{lineaDepto(a.datos)}</span>
              </label>
            ))}
          </fieldset>
        </VentanaDocumento>
      )}
    </>
  );
}
