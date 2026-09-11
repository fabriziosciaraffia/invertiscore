// ─────────────────────────────────────────────────────────────────────────────
// Landing v14 — las cinco pantallas y el footer (server components).
//
// El copy es el del contrato `landing-v14-final.html`, palabra por palabra. Lo
// que cambia respecto del mockup son los datos: contador, hora del último
// scrape, ejemplos y último análisis vienen de `leerDatosLanding`.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import type { DatosLanding } from "@/lib/landing-vivo";
import { SINGLE_PRICE, fmtCLP } from "@/lib/pricing";
import { CampoDireccion } from "./CampoDireccion";
import { Respuesta } from "./Respuesta";
import { LoQueHariaFranco } from "./Recomendacion";
import { MapaSantiago } from "./MapaSantiago";
import { SeccionVista } from "./Telemetria";
import { LinkMedido } from "./LinkMedido";
import { EV } from "./eventos";
// Wordmark, footer y glifo viven en `Marca.tsx`: los comparte /metodologia.
import { actualizado, PieLanding, Wordmark } from "./Marca";

// ===== 1 · HERO =====
export function Hero() {
  return (
    <SeccionVista n={1} className="lv-hero">
      {/* Fondo completo (receta v3, FASE 1.7): escala A1 azul tinta → ciruela → rojo en
          diagonal, generada a la resolución final de cada variante; el grano lo pone el
          CSS (grano-256.png). Es el LCP: fetchpriority alto. */}
      <picture className="lv-fondo lv-fondo-hero">
        <source media="(min-width: 768px)" srcSet="/landing/hero-d1x.webp 1x, /landing/hero-d2x.webp 2x" />
        <source srcSet="/landing/hero-m1x.webp 1x, /landing/hero-m2x.webp 2x, /landing/hero-m3x.webp 3x" />
        {/* eslint-disable-next-line @next/next/no-img-element -- textura de marca ya en WebP; es el LCP y va con fetchpriority */}
        <img src="/landing/hero-m2x.webp" alt="" fetchPriority="high" decoding="async" />
      </picture>
      <header className="lv-col lv-top">
        <Wordmark />
        <Link href="/login" className="lv-entrar">Entrar</Link>
      </header>
      <div className="lv-col lv-mid">
        <div className="lv-mid-izq">
          <h1 className="lv-h1">¿Ese depto es<br /><mark>buena inversión</mark>?</h1>
          <CampoDireccion ubicacion="hero" />
        </div>
      </div>
      <div className="lv-col lv-foot">
        <LinkMedido href="#respuesta" evento={EV.ejemplo} props={{ origen: "hero" }}>
          Ver un análisis real<span>→</span>
        </LinkMedido>
      </div>
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
export function PorQueCreerle({ datos, ahora }: { datos: DatosLanding; ahora: Date }) {
  return (
    <SeccionVista n={4} className="lv-s3">
      {/* resplandor muy tenue del azul del token en la esquina superior derecha, en
          vez de tinta plana (FASE 1.8; se compara con y sin en el reporte) */}
      <div className="lv-s3-glow" data-verdict="COMPRAR" aria-hidden="true" />
      <div className="lv-col">
        {/* Orden FASE 1.3 (mobile y desktop): etiqueta → cifra en una línea → base
            de datos → "Franco evalúa…" → MAPA → proceso → sin sesgo → link. En
            desktop el mapa ocupa la columna derecha a lo largo de los dos bloques. */}
        <div className="lv-s3-grid">
          <div className="lv-s3-arriba">
            <div className="lv-idx">Por qué creerle</div>
            <div className="lv-big">{datos.avisosActivos.toLocaleString("es-CL")} deptos</div>
            <div className="lv-base"><i />Base de datos · actualizado {actualizado(datos.ultimoScrape, ahora)}</div>
            <p className="lv-sabe">Franco evalúa tu depto<br />contra toda la oferta en <mark>Santiago</mark>.</p>
          </div>
          <div className="lv-s3-mapa">
            <MapaSantiago />
          </div>
          <div className="lv-s3-abajo">
            {/* los tres numerales recorren la tríada (azul → ciruela → rojo) leyendo el
                token por data-verdict: la misma escala del hero y del mapa */}
            <ol className="lv-proc">
              <li><span className="lv-n" data-verdict="COMPRAR">01</span><p>Un modelo financiero <b>proyecta qué pasa con tu inversión</b> en el tiempo.</p></li>
              <li><span className="lv-n" data-verdict="AJUSTA SUPUESTOS">02</span><p>Franco interpreta con IA y <b>te lo explica en fácil,</b> con un veredicto y una posición.</p></li>
              <li><span className="lv-n" data-verdict="BUSCAR OTRA">03</span><p>Y te dice qué hacer: <b>a qué precio conviene, hasta dónde negociar</b> y cuándo buscar otro.</p></li>
            </ol>
            <p className="lv-sesgo"><span>Sin sesgo:</span> Nadie le paga por decir que sí. <mark>Por eso puede decir que no.</mark></p>
            <Link className="lv-como" href="/metodologia">Ver cómo calcula <span>→</span></Link>
          </div>
        </div>
      </div>
    </SeccionVista>
  );
}

// ===== 5 · CIERRE + FOOTER =====
export function Cierre({ datos, ahora }: { datos: DatosLanding; ahora: Date }) {
  return (
    <div className="lv-cierre-wrap">
      {/* Banda inferior de la receta v2 (papel → rojo), anclada al FINAL de la página
          y con máscara en el borde: el cierre arranca en papel para que el título caiga
          sobre claro, y el rojo sigue hasta el footer sin franja de papel al final
          (ritmo: hero oscuro · papel · tinta · papel → rojo). */}
      <picture className="lv-fondo lv-fondo-cierre">
        <source media="(min-width: 768px)" srcSet="/landing/textura-cierre-d2x.webp" />
        {/* eslint-disable-next-line @next/next/no-img-element -- textura de marca ya en WebP */}
        <img src="/landing/textura-cierre-m2x.webp" alt="" loading="lazy" decoding="async" />
      </picture>
      {/* Igual que el hero: título + precio + "Ver planes" arriba con su aire; el
          bloque [campo + sin dirección] baja como unidad sobre la banda roja. */}
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
            <CampoDireccion ubicacion="cierre" />
          </div>
        </div>
      </SeccionVista>
      {/* Footer con las tonalidades del hero: la misma receta v3 invertida y vertical
          (--peso=0.15,0.85 --rango=0,0.95), arranca en el rojo pleno donde termina la
          banda del cierre y baja hasta el azul oscuro con que abrió la página. Vive en
          Marca.tsx porque /metodologia usa el mismo. */}
      <PieLanding ultimo={datos.ultimoAnalisis} ahora={ahora} />
    </div>
  );
}
