// ─────────────────────────────────────────────────────────────────────────────
// EL ESQUELETO DE EXPLORAR (28-oct-2026, medido en producción): lo que el servidor manda APENAS valida la sesión, mientras
// lee la cuenta (perfil, saldo, guardados, informes, el plan) y el número. Es la misma pantalla —la fila de arriba, el mapa
// quieto, la línea de los supuestos y la hoja cerrada— sin nada que tocar todavía. Sin él, el HTML del mapa quieto (el LCP del
// teléfono) esperaba esos datos: 1,3 s de «load delay» y una mediana de 2,53 s en Lighthouse (cinco corridas con sesión).
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from "react";
import { lineaSupuestos, PORTAL_COPY, portalDeUrl } from "@/lib/explorar/portal";
import "./explorar.css";

export function EsqueletoExplorar({ consulta, mapaQuieto }: { consulta: string; mapaQuieto: ReactNode }) {
  const vista = portalDeUrl(new URLSearchParams(consulta)).filtros;
  return (
    <div className="ex" data-explorar="esqueleto" aria-busy="true">
      <div className="ex-barra" aria-hidden="true">
        <span className="ex-boton"><span>☰</span> {PORTAL_COPY.filtros}</span>
        <span className="ex-boton ex-boton-suave">{PORTAL_COPY.ordenar} <span>▾</span></span>
        <span className="ex-boton ex-boton-suave">{PORTAL_COPY.miBusqueda}</span>
      </div>
      <div className="ex-cuerpo">
        <div className="ex-mapa-wrap" data-mapa="cargando">
          {mapaQuieto}
          <div className="ex-numero">
            <span className="ex-numero-n">{PORTAL_COPY.calculando}</span>
            <span className="ex-numero-s">{lineaSupuestos(vista)}</span>
          </div>
          <div className="ex-hoja" aria-hidden="true">
            <span className="ex-asa" />
            <span className="ex-hoja-fila"><span className="ex-hoja-t">{PORTAL_COPY.calculando}</span><span className="ex-hoja-ver">{PORTAL_COPY.verLista}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
