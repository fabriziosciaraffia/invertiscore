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

function Wordmark({ onBrand = false }: { onBrand?: boolean }) {
  return (
    <div>
      <FrancoLogo size="header" href="/" onBrand={onBrand} className="lv-wm" />
      <div className="lv-tag">{TAGLINE}</div>
    </div>
  );
}

// ===== 1 · HERO =====
export function Hero() {
  return (
    <SeccionVista n={1} className="lv-hero">
      <picture className="lv-fondo">
        <source media="(min-width: 900px)" srcSet="/landing/textura-hero-desktop.webp" />
        {/* eslint-disable-next-line @next/next/no-img-element -- textura de marca ya en WebP; es el LCP y va con fetchpriority */}
        <img src="/landing/textura-hero-mobile.webp" alt="" fetchPriority="high" decoding="async" />
      </picture>
      <div className="lv-col lv-top"><Wordmark /></div>
      <div className="lv-col lv-mid">
        <h1 className="lv-h1">¿Ese depto es<br /><mark>buena inversión</mark>?</h1>
        <CampoDireccion ubicacion="hero" />
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
      <div className="lv-col">
        <div className="lv-idx">La respuesta, en fácil</div>
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
      <div className="lv-col">
        <div className="lv-grid">
          <div>
            <div className="lv-idx">Por qué creerle</div>
            <div className="lv-big">
              {datos.avisosActivos.toLocaleString("es-CL")}
              <small>
                deptos publicados hoy · actualizado <em><i />{actualizado(datos.ultimoScrape, ahora)}</em>
              </small>
            </div>
            <p className="lv-sabe">Franco evalúa tu depto<br />contra toda la oferta en <mark>Santiago</mark>.</p>
            <ol className="lv-proc">
              <li><span className="lv-n">01</span><p>Un modelo financiero <b>proyecta qué pasa con tu inversión</b> en el tiempo.</p></li>
              <li><span className="lv-n">02</span><p>Franco interpreta con IA y <b>te lo explica en fácil,</b> con un veredicto y una posición.</p></li>
              <li><span className="lv-n">03</span><p>Y te dice qué hacer: <b>a qué precio conviene, hasta dónde negociar</b> y cuándo buscar otro.</p></li>
            </ol>
            <p className="lv-sesgo"><span>Sin sesgo:</span> Nadie le paga por decir que sí. <mark>Por eso puede decir que no.</mark></p>
            <Link className="lv-como" href="/metodologia">Ver cómo calcula <span>→</span></Link>
          </div>
          <div>
            <MapaSantiago />
            <div className="lv-nota">
              Calles © <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a>
            </div>
          </div>
        </div>
      </div>
    </SeccionVista>
  );
}

// ===== 4 · CIERRE + FOOTER =====
function haceCuanto(iso: string, ahora: Date): string {
  const ms = ahora.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const min = Math.round(ms / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

export function Cierre({ datos, ahora }: { datos: DatosLanding; ahora: Date }) {
  const u = datos.ultimoAnalisis;
  return (
    <SeccionVista n={4} className="lv-s4">
      <picture className="lv-fondo">
        <source media="(min-width: 900px)" srcSet="/landing/textura-cierre-desktop.webp" />
        {/* eslint-disable-next-line @next/next/no-img-element -- textura de marca ya en WebP */}
        <img src="/landing/textura-cierre-mobile.webp" alt="" loading="lazy" decoding="async" />
      </picture>
      <div className="lv-col">
        <h2 className="lv-h2">Antes de comprar,<br /><mark>evalúa con Franco.</mark></h2>
        <p className="lv-precio">
          El primer análisis es gratis.
          <span>Los siguientes, <b>{fmtCLP(SINGLE_PRICE)}</b> cada uno.</span>
        </p>
        <LinkMedido href="/pricing" className="lv-planes" evento={EV.planes}>
          Ver planes <span>→</span>
        </LinkMedido>
        <CampoDireccion ubicacion="cierre" />
        <footer className="lv-footer">
          <Wordmark onBrand />
          <nav aria-label="Franco">
            <Link href="/metodologia">Cómo calcula</Link>
            <Link href="/comunas">Comunas</Link>
            <Link href="/pricing">Planes</Link>
            <Link href="/login">Entrar</Link>
          </nav>
          {u && (
            <div className="lv-ultimo">
              <i className="lv-dot" />Último análisis · <b>{u.etiqueta}</b> · {u.comuna} · {haceCuanto(u.createdAt, ahora)}
            </div>
          )}
        </footer>
      </div>
    </SeccionVista>
  );
}
