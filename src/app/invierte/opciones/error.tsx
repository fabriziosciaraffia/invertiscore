"use client";

// Si falla el cálculo de las opciones (etapa 2): un mensaje claro e «Intentar de nuevo». Lo que contestó no se pierde: el
// perfil se guardó antes de llegar acá.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RESULTADO_COPY } from "@/lib/invierte-v2/opciones";
import "@/components/invierte/invierte.css";
import "@/components/invierte-v2/invierte-v2.css";

export default function ErrorOpciones({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { console.error("[inv2] opciones:", error?.digest ?? error?.message); }, [error]);
  const E = RESULTADO_COPY.espera;
  return (
    <main className="iv2-pagina" data-inv2="opciones-error">
      <div className="iv2-marco"><div className="inv-cuerpo iv2-cuerpo">
        <h1 className="inv-titulo">{E.error}</h1>
        <div className="iv2-acciones">
          <button type="button" className="inv-principal" onClick={() => { router.refresh(); reset(); }} data-inv2="reintentar">{E.reintentar}</button>
        </div>
      </div></div>
    </main>
  );
}
