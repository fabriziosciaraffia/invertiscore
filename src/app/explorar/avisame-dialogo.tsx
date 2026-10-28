"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «AVÍSAME DE NUEVOS» (28-oct-2026, estado D): guarda los filtros activos como el perfil de búsqueda, con una confirmación
// que muestra cuál reemplaza. Desde ahí el semanal y la selección diaria buscan con esa búsqueda (POST /api/explorar/avisame,
// que escribe `perfil_busqueda` igual que «Tu perfil» del dashboard). El perfil pide entre 1 y 8 comunas: con todas, la
// confirmación lo dice y ofrece elegirlas.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { botonOcupado } from "@/lib/carga-global";
import { lineaBusqueda, perfilDeFiltros, PORTAL_COPY, type FiltrosPortal } from "@/lib/explorar/portal";

const A = PORTAL_COPY.aviso;

export function AvisameDialogo({ filtros, busquedaActual, alElegirComunas, alCerrar }: {
  filtros: FiltrosPortal;
  /** La búsqueda guardada de ahora, en una línea (la que se reemplaza); null si no tiene. */
  busquedaActual: string | null;
  alElegirComunas: () => void;
  alCerrar: () => void;
}) {
  const router = useRouter();
  const p = perfilDeFiltros(filtros);
  const [estado, setEstado] = useState<"ver" | "guardando" | "listo" | "error">("ver");
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && estado !== "guardando") alCerrar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [alCerrar, estado]);

  async function guardar() {
    setEstado("guardando");
    const ok = await fetch("/api/explorar/avisame", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filtros }) }).then((r) => r.ok).catch(() => false);
    setEstado(ok ? "listo" : "error");
    // «Mi búsqueda» y la línea de lo guardado pasan a ser esta búsqueda.
    if (ok) router.refresh();
  }

  return (
    <div className="ex-modal-velo" data-explorar="avisame-dialogo" onClick={(e) => { if (e.target === e.currentTarget && estado !== "guardando") alCerrar(); }}>
      <div className="ex-modal" role="dialog" aria-modal="true" aria-labelledby="ex-avisame-t">
        <h2 id="ex-avisame-t" className="ex-modal-t">{A.titulo}</h2>
        {!p.ok ? (
          <>
            <p className="ex-modal-p" data-explorar="avisame-comunas">{A.faltanComunas}</p>
            <div className="ex-modal-pie">
              <button type="button" className="ex-enlace" onClick={alCerrar}>{A.cancelar}</button>
              <button type="button" className="ex-cta" onClick={alElegirComunas}>{A.elegir}</button>
            </div>
          </>
        ) : estado === "listo" ? (
          <>
            <p className="ex-modal-p" role="status" data-explorar="avisame-listo">{A.listo}</p>
            <div className="ex-modal-pie"><button type="button" className="ex-cta" onClick={alCerrar}>{PORTAL_COPY.cerrar}</button></div>
          </>
        ) : (
          <>
            <p className="ex-modal-p">{A.cuerpo}</p>
            <p className="ex-modal-busqueda" data-explorar="avisame-nueva">{lineaBusqueda(p.cambios)}</p>
            <p className="ex-modal-p ex-modal-s">{busquedaActual ? A.reemplaza : A.sinAntes}</p>
            {busquedaActual && <p className="ex-modal-busqueda ex-modal-antes" data-explorar="avisame-antes">{busquedaActual}</p>}
            {estado === "error" && <p className="ex-error" role="alert">{A.error}</p>}
            <div className="ex-modal-pie">
              <button type="button" className="ex-enlace" onClick={alCerrar} disabled={estado === "guardando"}>{A.cancelar}</button>
              <button type="button" className="ex-cta" onClick={() => void guardar()} disabled={estado === "guardando"} {...botonOcupado(estado === "guardando")} data-explorar="avisame-guardar">{A.guardar}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
