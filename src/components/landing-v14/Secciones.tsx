// ─────────────────────────────────────────────────────────────────────────────
// Landing v14 — las cuatro pantallas y el footer (server components).
//
// El copy es el del contrato `landing-v14-final.html`, palabra por palabra. Lo
// que cambia respecto del mockup son los datos: contador, hora del último
// scrape, ejemplos y último análisis vienen de `leerDatosLanding`.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import FrancoLogo from "@/components/franco-logo";
import type { DatosLanding } from "@/lib/landing-vivo";
import { TZ_CHILE } from "@/lib/fecha-cl";
import { SINGLE_PRICE, fmtCLP } from "@/lib/pricing";
import { CampoDireccion } from "./CampoDireccion";
import { Respuesta } from "./Respuesta";
import { MapaSantiago } from "./MapaSantiago";
import { SeccionVista } from "./Telemetria";
import { LinkMedido } from "./LinkMedido";
import { EV } from "./eventos";

const TAGLINE = "Real estate en su estado más franco";

function Wordmark() {
  return (
    <div>
      <FrancoLogo size="header" href="/" className="lv-wm" />
      <div className="lv-tag">{TAGLINE}</div>
    </div>
  );
}

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
export function LaRespuesta({ datos }: { datos: DatosLanding }) {
  return (
    <SeccionVista n={2} id="respuesta" className="lv-s2">
      <div className="lv-col lv-s2-grid">
        <Respuesta ejemplos={datos.ejemplos} />
      </div>
    </SeccionVista>
  );
}

// ===== 3 · POR QUÉ CREERLE =====
/** "hoy 03:30" (hora de Chile) si el último scrape fue hoy; si no, "el 6 sep 03:30".
 *  Decisión del goal: sin "hace N min" — el scrape corre una vez al día. */
function actualizado(iso: string, ahora: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hora = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ_CHILE }).format(d);
  const dia = (x: Date) => new Intl.DateTimeFormat("es-CL", { timeZone: TZ_CHILE, year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
  if (dia(d) === dia(ahora)) return `hoy ${hora}`;
  const fecha = new Intl.DateTimeFormat("es-CL", { timeZone: TZ_CHILE, day: "numeric", month: "short" }).format(d).replace(".", "");
  return `el ${fecha} ${hora}`;
}

export function PorQueCreerle({ datos, ahora }: { datos: DatosLanding; ahora: Date }) {
  return (
    <SeccionVista n={3} className="lv-s3">
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

// ===== 4 · CIERRE + FOOTER =====
/** "15 h" / "4 min" / "2 días": sin "hace", para que la línea del footer quepa
 *  en una a 390 px (FASE 1.3). */
function haceCuanto(iso: string, ahora: Date): string {
  const ms = ahora.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const min = Math.round(ms / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "día" : "días"}`;
}

export function Cierre({ datos, ahora }: { datos: DatosLanding; ahora: Date }) {
  const u = datos.ultimoAnalisis;
  return (
    <>
      {/* Igual que el hero: título + precio + "Ver planes" arriba con su aire; el
          bloque [campo + sin dirección] baja como unidad sobre la banda roja. El
          footer va aparte, en papel. */}
      <SeccionVista n={4} className="lv-s4">
        {/* Banda inferior de la receta v2 (papel → rojo), anclada abajo y con máscara en
            el borde: el cierre queda en papel para que el CTA final caiga sobre claro
            (ritmo: hero oscuro · papel · tinta · papel). Mobile 50 vh de rojo; PC 22 + 40. */}
        <picture className="lv-fondo lv-fondo-cierre">
          <source media="(min-width: 768px)" srcSet="/landing/textura-cierre-d2x.webp" />
          {/* eslint-disable-next-line @next/next/no-img-element -- textura de marca ya en WebP */}
          <img src="/landing/textura-cierre-m2x.webp" alt="" loading="lazy" decoding="async" />
        </picture>
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
      {/* Footer sobre papel, bajo la textura: wordmark canónico (.ai rojo), links en
          tinta, último análisis en mono gris, atribución del mapa (ODbL). */}
      <footer className="lv-footer">
        <div className="lv-col">
          <div className="lv-footer-fila">
            <Wordmark />
            <nav aria-label="Franco">
              <Link href="/metodologia">Cómo calcula</Link>
              <Link href="/comunas">Comunas</Link>
              <Link href="/pricing">Planes</Link>
              <Link href="/login">Entrar</Link>
            </nav>
          </div>
          {u && (
            <div className="lv-ultimo">
              <i className="lv-dot" />Último análisis · <b>{u.etiqueta}</b> · <span className="lv-ultimo-comuna">{u.comuna} · </span>{haceCuanto(u.createdAt, ahora)}
            </div>
          )}
          <div className="lv-osm">
            Mapa © <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a>
          </div>
        </div>
      </footer>
    </>
  );
}
