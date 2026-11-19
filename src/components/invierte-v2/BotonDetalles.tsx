"use client";

// «Ver detalles» / «Abrir» de un depto del flujo (etapa 2): abre los detalles en modo Invierte (detalles-cliente.ts). Lo ya
// preparado vuelve al instante; lo que no, se prepara sin gastar un crédito (charge_mode 'invierte') y mientras tanto la capa
// dice que está cargando.
import { useEffect, useState } from "react";
import { CargandoDetalles } from "./CargandoDetalles";
import { abrirDetalles, prepararEnSegundoPlano, urlDetallesInvierte } from "@/lib/invierte-v2/detalles-cliente";

export function BotonDetalles({ avisoId, etiqueta, clase = "iv2-enlace-azul" }: { avisoId: string; etiqueta: string; clase?: string }) {
  const [estado, setEstado] = useState<"listo" | "abriendo" | "error">("listo");
  async function abrir() {
    if (estado === "abriendo") return;
    setEstado("abriendo");
    const id = await abrirDetalles(avisoId);
    // `?desde=invierte` (19-nov-2026): los detalles saben que se abrieron desde el flujo; qué es el depto lo decide el servidor.
    if (id) { window.location.assign(urlDetallesInvierte(id)); return; }
    setEstado("error");
  }
  return (
    <>
      <button type="button" className={clase} onClick={abrir} disabled={estado === "abriendo"} data-inv2="ver-detalles">
        {estado === "abriendo" ? "Abriendo…" : estado === "error" ? "No se pudo abrir: intenta de nuevo" : etiqueta}
      </button>
      {estado === "abriendo" && <CargandoDetalles />}
    </>
  );
}

/** En la base: prepara en segundo plano los deptos elegidos que todavía no tienen sus detalles. No dibuja nada. */
export function PrepararDetalles({ avisoIds }: { avisoIds: string[] }) {
  const clave = avisoIds.join(",");
  useEffect(() => {
    if (clave) prepararEnSegundoPlano(clave.split(","));
  }, [clave]);
  return null;
}
