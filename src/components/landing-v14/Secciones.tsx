// ─────────────────────────────────────────────────────────────────────────────
// Landing v14 — las cinco pantallas y el footer (server components).
//
// El copy es el del contrato `landing-v14-final.html`, con los cambios del QA del
// 27-sep-2026 (sin IA, «Te dice que no cuando es no»). Los datos: los ejemplos y el último
// análisis vienen de `leerDatosLanding`; la cifra de comparables, de la fuente única del sitio
// (src/lib/stats.ts), sin contador en vivo: sube con el mapa y termina en «+40.000».
//
// El hero y el campo del cierre son los de la entrada (`HeroEntrada` / `CampoEntrada`):
// ver `Entrada.tsx`. La cabecera es el header único, que monta la página.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import type { ReactNode } from "react";
import type { DatosLanding } from "@/lib/landing-vivo";
import { SINGLE_PRICE, fmtCLP } from "@/lib/pricing";
import { COMPARABLES_CIFRA, COMPARABLES_PISO } from "@/lib/stats";
import { CampoLanding, HeroLanding } from "./Entrada";
import { Respuesta } from "./Respuesta";
import { LoQueHariaFranco } from "./Recomendacion";
import { MapaSantiago } from "./MapaSantiago";
import { SeccionVista } from "./Telemetria";
import { LinkMedido } from "./LinkMedido";
import { EV } from "./eventos";
import { ContadorComparables, PoblamientoMapa } from "./Poblamiento";
// Footer y glifo viven en `Marca.tsx`: los comparte /metodologia.
import { FondoMaterial, PieLanding } from "./Marca";

// ===== 1 · HERO =====
// El de la entrada, con la composición de la landing. La cabecera (el header único) la pasa
// la página: así la página monta `HeaderFranco` y el hero no dibuja una propia.
export function Hero({ cabecera }: { cabecera: ReactNode }) {
  return (
    <SeccionVista n={1} className="lv-hero">
      <HeroLanding cabecera={cabecera} />
    </SeccionVista>
  );
}

// ===== 2 · LA RESPUESTA =====
// Los ejemplos llegan por el contexto `RotacionEjemplos` (page.tsx), que envuelve
// esta sección y la siguiente: un solo estado mueve las dos.
export function LaRespuesta() {
  return (
    <SeccionVista n={2} id="respuesta" className="lv-s2">
      <div className="lv-col lv-s2-grid">
        <Respuesta />
      </div>
    </SeccionVista>
  );
}

// ===== 3 · LO QUE HARÍA FRANCO =====
// La card §5 del informe para el mismo ejemplo que la sección 2 (FASE 1.9, plan B:
// sección propia, 100 svh, papel). Ritmo: hero oscuro · respuesta papel ·
// recomendación papel · por qué creerle tinta · cierre papel.
export function LoQueHaria() {
  return (
    <SeccionVista n={3} id="recomendacion" className="lv-sreco">
      <div className="lv-col lv-sreco-grid">
        <LoQueHariaFranco />
      </div>
    </SeccionVista>
  );
}

// ===== 4 · POR QUÉ CREERLE =====
export function PorQueCreerle() {
  return (
    <SeccionVista n={4} className="lv-s3">
      {/* resplandor muy tenue del azul del token en la esquina superior derecha, en
          vez de tinta plana (FASE 1.8; se compara con y sin en el reporte) */}
      <div className="lv-s3-glow" data-verdict="COMPRAR" aria-hidden="true" />
      <div className="lv-col">
        {/* Orden FASE 1.3 (mobile y desktop): etiqueta → cifra en una línea → base
            de datos → "Franco evalúa…" → MAPA → proceso → sin sesgo → link. En
            desktop el mapa ocupa la columna derecha a lo largo de los dos bloques. */}
        {/* el mapa se puebla y la cifra sube con él (Poblamiento.tsx) */}
        <PoblamientoMapa>
        <div className="lv-s3-grid">
          <div className="lv-s3-arriba">
            <div className="lv-idx">Por qué creerle</div>
            <div className="lv-big">
              <ContadorComparables final={COMPARABLES_CIFRA} piso={COMPARABLES_PISO} />
            </div>
            <div className="lv-base">Deptos comparables</div>
            <p className="lv-sabe">Franco evalúa tu depto<br />contra toda la oferta en <mark>Santiago</mark>.</p>
          </div>
          <div className="lv-s3-mapa">
            <MapaSantiago />
          </div>
          <div className="lv-s3-abajo">
            {/* los numerales en papel: recorrían la tríada, y el 03 quedaba destacado en rojo
                sólido (27-sep-2026: el rojo queda para avanzar y para la plata que sale) */}
            <ol className="lv-proc">
              <li><span className="lv-n">01</span><p>Un modelo financiero <b>proyecta qué pasa con tu inversión</b> en el tiempo.</p></li>
              <li><span className="lv-n">02</span><p>Franco <b>lo traduce a fácil:</b> un veredicto, una posición y las cifras que tienes que ver.</p></li>
              <li><span className="lv-n">03</span><p>Y te dice qué hacer: <b>a qué precio conviene, hasta dónde negociar</b> y cuándo buscar otro.</p></li>
            </ol>
            <p className="lv-sesgo"><span>Sin sesgo:</span> <mark>Te dice que no cuando es no.</mark></p>
            <Link className="lv-como" href="/metodologia">Ver cómo calcula <span>→</span></Link>
          </div>
        </div>
        </PoblamientoMapa>
      </div>
    </SeccionVista>
  );
}

// ===== 5 · CIERRE + FOOTER =====
export function Cierre({ datos, ahora }: { datos: DatosLanding; ahora: Date }) {
  return (
    <div className="lv-cierre-wrap">
      {/* DESTACADO SÍ, ROJO NO (27-sep-2026, decisión de Fabrizio): la banda roja del cierre
          pasa al MATERIAL DEL HERO —el degradado de la tríada con grano, texto en papel, como el
          header—, y cubre el cierre y el pie de una vez. El rojo queda para el botón de avanzar y
          para la plata que sale. Ritmo: hero material · papel · papel · tinta · material. */}
      <FondoMaterial />
      {/* Igual que el hero: título + precio + "Ver planes" arriba con su aire; el
          bloque [campo + sin dirección] baja como unidad. */}
      <SeccionVista n={5} className="lv-s4">
        <div className="lv-col lv-s4-col">
          <div className="lv-cierre-izq">
            <h2 className="lv-h2">Antes de comprar,<br /><mark>evalúa con Franco.</mark></h2>
            <p className="lv-precio">
              El primer análisis es gratis.
              <span>Los siguientes, <b>{fmtCLP(SINGLE_PRICE)}</b> cada uno.</span>
            </p>
            <LinkMedido href="/pricing" className="lv-planes" evento={EV.planes}>
              Ver planes <span>→</span>
            </LinkMedido>
          </div>
          <div className="lv-cierre-izq lv-cierre-campo">
            <CampoLanding ubicacion="cierre" />
          </div>
        </div>
      </SeccionVista>
      {/* Footer con las tonalidades del hero: la misma receta v3 invertida y vertical
          (--peso=0.15,0.85 --rango=0,0.95), arranca en el rojo pleno donde termina la
          banda del cierre y baja hasta el azul oscuro con que abrió la página. Vive en
          Marca.tsx porque /metodologia usa el mismo. */}
      <PieLanding ultimo={datos.ultimoAnalisis} ahora={ahora} conFondo={false} />
    </div>
  );
}
