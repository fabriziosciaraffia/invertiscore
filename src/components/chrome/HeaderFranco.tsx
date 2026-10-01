"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL HEADER ÚNICO DE FRANCO (27-sep-2026) — estilo E, aprobado por Fabrizio.
// Mockup: docs/wireframes/rediseno-informe/header-unico-aprobado.html. CSS: header-franco.css.
//
// Un solo componente en todas las páginas: landing, wizard, informe, dashboard, comunas, precios,
// metodología, login, admin. Reemplaza a los cinco de antes (UnifiedNav con sus cuatro variantes,
// PublicShareHeader, la cabecera del demo, la de /admin y la del hero de la entrada).
//
// La banda es el material del hero de la landing, derivado de los tokens de la tríada. El wordmark
// va invertido y fiel a la marca (FrancoLogo). El botón principal va en tinta. Sin mono.
//
// LAS SIETE DECISIONES APROBADAS:
//   1 · Los enlaces largos van al pie (AppFooter). Con sesión quedan «Mis análisis» y «Planes»,
//       solo desde 768.
//   2 · Un solo botón principal por pantalla. En el wizard el header no lleva botón: el principal
//       de la pantalla es avanzar.
//   3 · Con sesión, el tema va al menú de cuenta. Sin sesión queda como ícono (a 390, en el informe
//       compartido, no cabe y sale).
//   4 · A 390 los rótulos se acortan («Analizar»).
//   5 · Eliminar no va en el header del informe (va al pie del informe y a la fila del dashboard).
//   6 · El demo se ve como sin sesión: es un ejemplo, no algo que te mandaron.
//   7 · Sin eslogan.
//
// AL BAJAR, EN EL INFORME: cuando la portada sale de la vista, el header lleva la identidad del
// análisis —la dirección, el chip de veredicto (ChipVeredicto, variante sobre fondo) y el puntaje—.
// La lee de la portada misma (`section.doc-portada`, atributos data-*): así el header no puede
// contradecir lo que la portada dice. Con un pop-up abierto, el header no cambia.
// ─────────────────────────────────────────────────────────────────────────────

import { EnlaceCarga } from "./EnlaceCarga";
import { BarraCarga } from "./BarraCarga";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { posthogCliente as posthog } from "@/lib/posthog-cliente";
import { Moon, Sun } from "lucide-react";
import FrancoLogo from "@/components/franco-logo";
import { CtaAnalizar } from "@/components/CtaAnalizar";
import { ChipVeredicto, ChipVeredictoTokens } from "@/components/analysis/shared/ChipVeredicto";
import { createClient } from "@/lib/supabase/client";
import { purgarBorradoresYPestana } from "@/lib/draft-keys";
import { currentTheme, setTheme, type Theme } from "@/lib/theme";
import { hrefEntrar } from "@/lib/entrar/entrada";
import { usePathname } from "next/navigation";
import type { Veredicto } from "@/lib/types";
import "./header-franco.css";

export type ContextoHeader = "sitio" | "wizard" | "auth";
/** propio = con sesión (dueño o invitado con cuenta) · compartido = invitado con el enlace ·
 *  anonimo = el dueño sin cuenta · ejemplo = el demo (se ve como el sitio, según la sesión). */
export type ModoInforme = "propio" | "compartido" | "anonimo" | "ejemplo";
export interface SesionHeader {
  email: string;
}

export interface HeaderFrancoProps {
  contexto?: ContextoHeader;
  /** Qué enlace del header corresponde a la página (subrayado). */
  activo?: "mis" | "planes";
  /** Sobre el hero (la portada del wizard): sin banda propia, el material ya está debajo. */
  sobreMaterial?: boolean;
  /** La sesión, si la página ya la conoce en el server. `undefined` = el header la busca. */
  sesion?: SesionHeader | null;
  informe?: {
    modo: ModoInforme;
    /** compartido: la fecha del análisis, junto a «Compartido contigo». */
    fecha?: string;
    /** anonimo: adónde vuelve después de crear la cuenta (lo usa el banner del registro, no el header). */
    registroNext?: string;
    /** propio: el botón de compartir (ShareButton, variante banda). */
    compartir?: ReactNode;
  };
}

interface Identidad {
  direccion: string;
  veredicto: Veredicto;
  score: string;
}

const VEREDICTOS: readonly Veredicto[] = ["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"];

/** La identidad que la portada publica en sus atributos; null si no hay portada o le falta algo. */
function leerIdentidad(portada: Element): Identidad | null {
  const v = portada.getAttribute("data-verdict") as Veredicto | null;
  const direccion = portada.getAttribute("data-direccion") ?? "";
  if (!v || !VEREDICTOS.includes(v) || !direccion) return null;
  return { direccion, veredicto: v, score: portada.getAttribute("data-score") ?? "" };
}

function useSesion(inicial: SesionHeader | null | undefined): SesionHeader | null | undefined {
  const [sesion, setSesion] = useState<SesionHeader | null | undefined>(inicial);
  useEffect(() => {
    if (inicial !== undefined) return;
    let activo = true;
    let soltar: (() => void) | undefined;
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (activo) setSesion(data.user ? { email: data.user.email ?? "" } : null);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
        if (activo) setSesion(s?.user ? { email: s.user.email ?? "" } : null);
      });
      soltar = () => sub.subscription.unsubscribe();
    } catch {
      // Sin configuración de Supabase (build, preview sin env): sin sesión.
      if (activo) setSesion(null);
    }
    return () => {
      activo = false;
      soltar?.();
    };
  }, [inicial]);
  return inicial !== undefined ? inicial : sesion;
}

/** La ruta actual para el `next` de «Entrar»: el path (también en el server) y, ya montado, su query. */
function useRutaActual(): string {
  const pathname = usePathname();
  const [ruta, setRuta] = useState<string | null>(null);
  useEffect(() => {
    setRuta(window.location.pathname + window.location.search);
  }, [pathname]);
  return ruta ?? pathname ?? "/";
}

function BotonTema({ className = "" }: { className?: string }) {
  const [claro, setClaro] = useState(true);
  useEffect(() => setClaro(currentTheme() === "light"), []);
  return (
    <button
      type="button"
      className={`hf-ico ${className}`}
      onClick={() => {
        const t: Theme = claro ? "dark" : "light";
        setClaro(t === "light");
        setTheme(t);
      }}
      aria-label={claro ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
    >
      {claro ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}

function MenuCuenta({ email }: { email: string }) {
  const [abierto, setAbierto] = useState(false);
  const [tema, setTemaActual] = useState<Theme>("light");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setTemaActual(currentTheme()), []);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);
  const iniciales = email ? email.replace(/@.*/, "").slice(0, 2).toUpperCase() : "·";
  const salir = async () => {
    setAbierto(false);
    // ANTES del signOut: el borrador se purga aunque Supabase falle (logout-button.tsx).
    purgarBorradoresYPestana();
    try { await createClient().auth.signOut(); } catch { /* sin sesión: igual a login */ }
    try { posthog.reset(); } catch { /* PostHog sin inicializar */ }
    window.location.assign("/entrar");
  };
  const elegirTema = (t: Theme) => { setTemaActual(t); setTheme(t); };
  return (
    <div className="hf-cuenta" ref={ref}>
      <button type="button" className="hf-av" aria-label="Menú de cuenta" aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        {iniciales}
      </button>
      {abierto && (
        <div className="hf-menu" role="menu">
          <div className="hf-menu-mail">{email}</div>
          <EnlaceCarga href="/dashboard" role="menuitem" onClick={() => setAbierto(false)}>Mis análisis</EnlaceCarga>
          <EnlaceCarga href="/pricing" role="menuitem" onClick={() => setAbierto(false)}>Planes</EnlaceCarga>
          <EnlaceCarga href="/cuenta" role="menuitem" onClick={() => setAbierto(false)}>Mi cuenta</EnlaceCarga>
          <EnlaceCarga href="/perfil" role="menuitem" onClick={() => setAbierto(false)}>Perfil</EnlaceCarga>
          <div className="hf-tema">
            <span>Tema</span>
            <span className="hf-seg" role="group" aria-label="Tema">
              <button type="button" aria-pressed={tema === "light"} onClick={() => elegirTema("light")}>Claro</button>
              <button type="button" aria-pressed={tema === "dark"} onClick={() => elegirTema("dark")}>Oscuro</button>
            </span>
          </div>
          <button type="button" className="hf-salir" role="menuitem" onClick={salir}>Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}

export function HeaderFranco({ contexto = "sitio", activo, sobreMaterial = false, sesion: sesionServer, informe }: HeaderFrancoProps) {
  const sesion = useSesion(sesionServer);
  const resuelta = sesion !== undefined;
  const logueado = !!sesion;
  const modo = informe?.modo;
  const hayInforme = !!informe;

  // Al bajar en el informe: la identidad aparece cuando la portada sale de la vista.
  const [identidad, setIdentidad] = useState<Identidad | null>(null);
  const [fijo, setFijo] = useState(false);
  useEffect(() => {
    if (!hayInforme) return;
    const portada = document.querySelector("section.doc-portada");
    if (!portada) return;
    setIdentidad(leerIdentidad(portada));
    const obs = new IntersectionObserver(([e]) => {
      setIdentidad(leerIdentidad(portada));
      setFijo(!e.isIntersecting && e.boundingClientRect.top < 0);
    }, { threshold: 0, rootMargin: "-64px 0px 0px 0px" }); // pasa BAJO el header, no bajo el borde
    obs.observe(portada);
    return () => obs.disconnect();
  }, [hayInforme]);
  const conIdentidad = fijo && !!identidad;

  const wordmark = <FrancoLogo size="banda" href={logueado ? "/dashboard" : "/"} className="hf-wm" />;
  // UNA SOLA ENTRADA (01-oct-2026): «Entrar» lleva a la entrada por código con la ruta actual como
  // `next`, en todos los estados del header. Desde el informe anónimo, con el copy del informe.
  const rutaActual = useRutaActual();
  const hrefEntrada = hrefEntrar(rutaActual, modo === "anonimo" ? "informe" : "generico");
  const entrar = <EnlaceCarga href={hrefEntrada} className="hf-txt hf-oculta-fija">Entrar</EnlaceCarga>;

  let contextoInforme: ReactNode = null;
  if (modo === "compartido") contextoInforme = <span className="hf-ctx hf-solo-ancho"><b>Compartido contigo</b>{informe?.fecha}</span>;
  if (modo === "anonimo") contextoInforme = <span className="hf-ctx hf-solo-ancho"><b>Tu análisis, sin guardar</b>Crea una cuenta para no perderlo</span>;

  let derecha: ReactNode = null;
  if (contexto === "auth") {
    derecha = null;
  } else if (contexto === "wizard") {
    // El wizard no lleva botón principal: el principal de la pantalla es avanzar. «Entrar» va como
    // píldora con contorno en papel (QA 28-sep-2026): visible sobre el material, sin competir con
    // el campo. Con sesión (01-oct-2026), el avatar con su menú, como en el resto del sitio: Mis
    // análisis, Planes, Mi cuenta, Perfil, tema y Cerrar sesión (el tema va al menú, no a la barra).
    derecha = !resuelta ? null : logueado ? (
      <MenuCuenta email={sesion?.email ?? ""} />
    ) : (
      <>
        <BotonTema />
        <EnlaceCarga href={hrefEntrada} className="hf-txt hf-pild">Entrar</EnlaceCarga>
      </>
    );
  } else if (modo === "compartido") {
    derecha = (
      <>
        <BotonTema className="hf-solo-ancho" />
        {entrar}
        <CtaAnalizar origen="resultado_hook" className="hf-btn">Analizar el mío</CtaAnalizar>
      </>
    );
  } else if (modo === "anonimo") {
    // «Lo que sigue» (28-sep-2026): el registro del primer informe anónimo vive en el banner después
    // de la card y en su barra fija, no acá. El header queda con «Entrar».
    derecha = <>{entrar}</>;
  } else if (!resuelta) {
    derecha = null;
  } else if (!logueado) {
    derecha = (
      <>
        <BotonTema className="hf-oculta-fija" />
        {entrar}
        <CtaAnalizar origen="nav" className="hf-btn">
          <span className="hf-largo">Analizar departamento</span>
          <span className="hf-corto">Analizar</span>
        </CtaAnalizar>
      </>
    );
  } else {
    derecha = (
      <>
        <EnlaceCarga href="/dashboard" className={`hf-lnk hf-solo-ancho${activo === "mis" ? " on" : ""}`}>Mis análisis</EnlaceCarga>
        <EnlaceCarga href="/pricing" className={`hf-lnk hf-solo-ancho${activo === "planes" ? " on" : ""}`}>Planes</EnlaceCarga>
        {modo === "propio" && informe?.compartir ? <span className="hf-oculta-fija" style={{ display: "contents" }}>{informe.compartir}</span> : null}
        <CtaAnalizar origen="nav" className="hf-btn hf-oculta-fija">Nuevo análisis</CtaAnalizar>
        <MenuCuenta email={sesion?.email ?? ""} />
      </>
    );
  }

  const clase = `hf${sobreMaterial ? " hf--material" : ""}${conIdentidad ? " hf--fijo" : ""}`;
  return (
    <header className={clase}>
      {/* El CSS del chip, por si la página no lo montó (DocTokens lo trae en el informe). */}
      {conIdentidad && <ChipVeredictoTokens />}
      <div className="hf-col">
        <div className="hf-izq">
          {wordmark}
          {conIdentidad && identidad ? (
            <div className="hf-id">
              <ChipVeredicto v={identidad.veredicto} variante="sobre-fondo" />
              <span className="hf-pts">{identidad.score || "—"}<span className="hf-solo-ancho"> de 100</span></span>
              <span className="hf-dir">{identidad.direccion}</span>
            </div>
          ) : (
            contextoInforme
          )}
        </div>
        {derecha && <div className="hf-der">{derecha}</div>}
      </div>
      <Suspense fallback={null}>
        <BarraCarga />
      </Suspense>
    </header>
  );
}
