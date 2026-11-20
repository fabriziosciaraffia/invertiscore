"use client";

// «Ver detalles» / «Abrir» de un depto del flujo (etapa 2): abre los detalles en modo Invierte (detalles-cliente.ts). Lo ya
// preparado vuelve al instante; lo que no, se prepara sin gastar un crédito (charge_mode 'invierte') y mientras tanto la capa
// dice que está cargando.
import { useEffect, useState, type ReactNode } from "react";
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

/** En la base, «Tus deptos» (20-nov-2026, decisión de Fabrizio): la tarjeta entera se toca y abre los detalles, con una flecha a
 *  la derecha en vez del enlace «Abrir». Por ahora lleva a los detalles; cuando exista el flujo de cada depto, a esa página. El
 *  contenido va en `span` (un botón solo admite texto en línea). */
export function TarjetaDetalles({ avisoId, etiqueta, children, sinFlecha = false }: { avisoId: string; etiqueta: string; children: ReactNode; /** La tarjeta de la etapa 3 lleva su flecha en la fila del estado. */ sinFlecha?: boolean }) {
  const [estado, setEstado] = useState<"listo" | "abriendo" | "error">("listo");
  async function abrir() {
    if (estado === "abriendo") return;
    setEstado("abriendo");
    const id = await abrirDetalles(avisoId);
    if (id) { window.location.assign(urlDetallesInvierte(id)); return; }
    setEstado("error");
  }
  return (
    <>
      <button type="button" className="iv2-depto iv2-depto-tocable" onClick={abrir} disabled={estado === "abriendo"} aria-label={etiqueta} data-inv2="ver-detalles">
        <span className="iv2-depto-cuerpo">{children}</span>
        {!sinFlecha && <span className="iv2-depto-flecha" aria-hidden="true">›</span>}
      </button>
      {estado === "error" && <span className="iv2-depto-error" role="alert">No se pudo abrir: intenta de nuevo</span>}
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
