"use client";

/**
 * UnifiedNav — header único del sitio (Phase 2.40).
 *
 * Reemplaza LandingNav + AppNav + AnalysisNav por un solo componente
 * auth-aware con menú mobile (bottom-sheet). Resuelve los 9 problemas del
 * audit de headers: tokens inconsistentes, alturas distintas, "Precios" como
 * anchor vs página, logout no disponible en todas las rutas, etc.
 *
 * ── Decisión de tokens ───────────────────────────────────────────────
 * El sitio usa el set **--franco-*** en TODAS las variantes (app, marketing,
 * minimal). La landing tiene su propio sistema de tema (--landing-*),
 * controlado por `LandingThemeProvider` vía el atributo `data-franco-theme`
 * sobre el wrapper `[data-franco-root]` — distinto del tema global de la app
 * (`data-theme` sobre <html>, que mueve los --franco-*).
 *
 * Por eso `variant="landing"`:
 *   - pinta su chrome con los tokens --landing-* (--landing-nav-bg,
 *     --landing-text, --landing-wm-*), que SÍ responden al toggle de la
 *     landing; usar --franco-* ahí dejaría el nav fuera de sync con el tema
 *     de la home.
 *   - usa el toggle de tema de la landing (`useLandingTheme`) en vez del
 *     ThemeToggle global, porque el global mueve --franco-* (data-theme) y no
 *     afectaría a las secciones de la home (que leen --landing-*).
 * El resto de las variantes usa --franco-* y el ThemeToggle global.
 *
 * ── Patrón SAFE ──────────────────────────────────────────────────────
 *   - Dropdown de usuario: always-mounted, se muestra con opacity +
 *     pointerEvents (no `{open && <...>}`). Sin AnimatePresence.
 *   - Mobile sheet: mount condicional permitido (click-triggered), con
 *     keyframes CSS (slideInUp/fadeIn), igual que LandingModal Phase 2.26.
 *   - Sin estado disparado por scroll/viewport.
 *   - Click-outside y ESC con listeners montados on-demand.
 *   - Body scroll lock mientras el sheet está abierto.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Menu, X, Sun, Moon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import FrancoLogo from "@/components/franco-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { useLandingTheme } from "@/components/landing/LandingTheme";

export type UnifiedNavVariant = "landing" | "marketing" | "app";

export interface UnifiedNavProps {
  /** Contexto de la página. Default "marketing". */
  variant?: UnifiedNavVariant;
  /**
   * Versión reducida para páginas de auth: solo Logo (→/) + ThemeToggle.
   * Sin links, sin CTA, sin avatar, sin hamburger.
   */
  minimal?: boolean;
  /**
   * Acciones contextuales extra (ej: Compartir / Eliminar en la página de
   * resultados). Se renderizan a la izquierda del CTA en el cluster derecho,
   * tanto en desktop como en mobile. Mantiene UnifiedNav como base única sin
   * perder features propias de ciertas rutas.
   */
  actionsSlot?: ReactNode;
}

interface NavLink {
  label: string;
  href: string;
}

// ── Wordmark ───────────────────────────────────────────────────────────
function Wordmark({ landing }: { landing: boolean }) {
  if (!landing) {
    return <FrancoLogo size="header" inverted />;
  }
  // Landing usa tokens --landing-wm-* (responden al toggle de la home).
  return (
    <span className="inline-flex items-baseline">
      <span
        className="font-heading text-[26px] italic font-light leading-none"
        style={{ color: "var(--landing-wm-re)", marginRight: "-0.08em" }}
      >
        re
      </span>
      <span
        className="font-heading text-[26px] font-bold leading-none"
        style={{ color: "var(--landing-wm-franco)" }}
      >
        franco
      </span>
      <span
        className="font-body font-semibold tracking-wide text-[#C8323C]"
        style={{ fontSize: "0.35em", letterSpacing: "0.1em", marginLeft: 1 }}
      >
        .ai
      </span>
    </span>
  );
}

// ── Theme toggle (landing usa su contexto propio) ──────────────────────
function NavThemeToggle({ landing }: { landing: boolean }) {
  // Siempre llamamos el hook (fallback no-op fuera del provider).
  const { theme, toggle } = useLandingTheme();
  if (!landing) return <ThemeToggle />;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[rgba(127,127,127,0.12)]"
      style={{ color: "var(--landing-text)" }}
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

export function UnifiedNav({
  variant = "marketing",
  minimal = false,
  actionsSlot,
}: UnifiedNavProps) {
  const router = useRouter();
  const isLanding = variant === "landing";

  // Cliente Supabase creado lazy en el efecto (client-only). NO se crea en
  // render: createClient() lanza si faltan las env NEXT_PUBLIC_* y rompería el
  // SSR de páginas estáticas (landing, marketing). La ref lo comparte con los
  // handlers (signOut).
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  // undefined = aún no resuelto (evita flash de CTA equivocado).
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // ── Auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    let unsub: (() => void) | undefined;
    try {
      const supabase = createClient();
      supabaseRef.current = supabase;
      supabase.auth.getUser().then(({ data }) => {
        if (active) setUser(data.user ?? null);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        if (active) setUser(session?.user ?? null);
      });
      unsub = () => sub.subscription.unsubscribe();
    } catch {
      // Sin config de Supabase (build/preview) → tratamos como no logueado.
      if (active) setUser(null);
    }
    return () => {
      active = false;
      unsub?.();
    };
  }, []);

  // ── Click-outside del dropdown (montado on-demand) ────────────────
  useEffect(() => {
    if (!dropOpen) return;
    const onClick = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [dropOpen]);

  const loggedIn = !!user;
  const authReady = user !== undefined;
  const email = user?.email ?? "";
  const initials = email
    ? email.replace(/@.*/, "").slice(0, 2).toUpperCase()
    : "·";

  const logoHref = loggedIn ? "/dashboard" : "/";
  // Resuelve una ancla de la landing según contexto: en la home es un hash
  // local (#id); fuera de la home apunta a la ruta raíz (/#id).
  const anchor = (id: string) => (isLanding ? `#${id}` : `/#${id}`);

  // ── Sets de links del centro según auth ───────────────────────────
  const publicLinks: NavLink[] = [
    { label: "Qué", href: anchor("que-es-franco") },
    { label: "Por qué", href: anchor("el-problema") },
    { label: "Cómo", href: anchor("que-hace-franco") },
    { label: "Precios", href: "/pricing" },
    { label: "Ingresar", href: "/login" },
  ];
  const loggedLinks: NavLink[] = [
    { label: "Mis análisis", href: "/dashboard" },
    { label: "Nuevo análisis", href: "/analisis/nuevo-v2" },
    { label: "Precios", href: "/pricing" },
  ];
  const centerLinks = loggedIn ? loggedLinks : publicLinks;

  const linkClass = isLanding
    ? "font-body text-sm font-medium text-[var(--landing-text-secondary)] hover:text-signal-red transition-colors"
    : "font-body text-sm font-medium text-[var(--franco-text-secondary)] hover:text-signal-red transition-colors";

  // ── Chrome del header ─────────────────────────────────────────────
  const navStyle: React.CSSProperties = isLanding
    ? {
        background: "var(--landing-nav-bg)",
        borderBottom: "0.5px solid var(--landing-nav-border)",
      }
    : variant === "app"
      ? {
          background: "var(--franco-nav-bg)",
          borderBottom: "0.5px solid var(--franco-border)",
        }
      : { borderBottom: "0.5px solid var(--franco-border)" };
  const bgClass = isLanding
    ? "backdrop-blur-md"
    : variant === "marketing"
      ? "bg-[color-mix(in_srgb,var(--franco-bg)_95%,transparent)] backdrop-blur-md"
      : "backdrop-blur-md";
  const containerMax = isLanding ? "max-w-[1280px]" : "max-w-[1100px]";

  const handleSignOut = async () => {
    setDropOpen(false);
    setMenuOpen(false);
    try {
      const supabase = supabaseRef.current ?? createClient();
      await supabase.auth.signOut();
    } catch {
      /* sin sesión / sin config — caemos a login igualmente */
    }
    router.push("/login");
    router.refresh();
  };

  // ── CTA primario (Signal Red) ─────────────────────────────────────
  const ctaPrimary = loggedIn
    ? { label: "Nuevo análisis", href: "/analisis/nuevo-v2" }
    : { label: "Analizar departamento", href: "/register" };

  // ───────────────────────── MINIMAL ───────────────────────────────
  if (minimal) {
    return (
      <header
        className={`sticky top-0 z-50 w-full ${bgClass}`}
        style={navStyle}
      >
        <div
          className={`mx-auto flex h-14 ${containerMax} items-center justify-between px-4 sm:px-6`}
        >
          <Link href="/" aria-label="Inicio" className="inline-flex items-center">
            <Wordmark landing={isLanding} />
          </Link>
          <NavThemeToggle landing={isLanding} />
        </div>
      </header>
    );
  }

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full ${bgClass}`}
        style={navStyle}
      >
        <div
          className={`mx-auto flex h-14 ${containerMax} items-center justify-between gap-4 px-4 sm:px-6`}
        >
          {/* IZQ — Logo */}
          <Link
            href={logoHref}
            aria-label={loggedIn ? "Dashboard" : "Inicio"}
            className="inline-flex items-center"
          >
            <Wordmark landing={isLanding} />
          </Link>

          {/* CENTRO — links (md+) */}
          <nav className="hidden items-center gap-7 md:flex">
            {authReady &&
              centerLinks.map((l) =>
                l.href.includes("#") ? (
                  <a key={l.label} href={l.href} className={linkClass}>
                    {l.label}
                  </a>
                ) : (
                  <Link key={l.label} href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                ),
              )}
          </nav>

          {/* DER — badge + theme + actions + CTA/avatar + hamburger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isLanding && (
              <span
                className="hidden items-center rounded-full border px-2.5 py-1 font-mono uppercase lg:inline-flex"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.12em",
                  color: "var(--landing-text-muted)",
                  borderColor: "var(--landing-card-border)",
                }}
              >
                Beta · disponible para Santiago
              </span>
            )}

            <NavThemeToggle landing={isLanding} />

            {/* Acciones contextuales (Compartir / Eliminar, etc.) */}
            {actionsSlot}

            {/* CTA + avatar (desktop) */}
            {authReady && (
              <div className="hidden items-center gap-3 md:flex">
                <Link href={ctaPrimary.href} className={ctaPrimaryClass}>
                  {ctaPrimary.label}
                </Link>

                {loggedIn && (
                  <div className="relative" ref={dropRef}>
                    <button
                      type="button"
                      onClick={() => setDropOpen((o) => !o)}
                      aria-haspopup="menu"
                      aria-expanded={dropOpen}
                      aria-label="Menú de cuenta"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-signal-red font-mono text-[11px] font-bold text-white transition-transform hover:scale-105"
                    >
                      {initials}
                    </button>

                    {/* Dropdown always-mounted (opacity + pointerEvents) */}
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-lg shadow-lg"
                      style={{
                        background: "var(--franco-card)",
                        border: "0.5px solid var(--franco-border)",
                        opacity: dropOpen ? 1 : 0,
                        pointerEvents: dropOpen ? "auto" : "none",
                        transform: dropOpen
                          ? "translateY(0)"
                          : "translateY(-4px)",
                        transition: "opacity 150ms ease, transform 150ms ease",
                      }}
                    >
                      <div
                        className="truncate px-4 py-2.5 font-mono text-[10px] uppercase"
                        style={{
                          letterSpacing: "0.06em",
                          color: "var(--franco-text-muted)",
                          borderBottom: "0.5px solid var(--franco-border)",
                        }}
                      >
                        {email}
                      </div>
                      <DropItem href="/cuenta" onNav={() => setDropOpen(false)}>
                        Mi cuenta
                      </DropItem>
                      <DropItem href="/perfil" onNav={() => setDropOpen(false)}>
                        Mi perfil
                      </DropItem>
                      <div
                        style={{ borderTop: "0.5px solid var(--franco-border)" }}
                      />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleSignOut}
                        className="block w-full px-4 py-2.5 text-left font-body text-sm text-[var(--franco-text-secondary)] transition-colors hover:bg-[var(--franco-elevated)] hover:text-[var(--franco-text)]"
                      >
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hamburger (mobile) */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
              className={`p-1.5 md:hidden ${
                isLanding
                  ? "text-[var(--landing-text)]"
                  : "text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"
              }`}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── MOBILE SHEET (mount condicional, click-triggered) ── */}
      {menuOpen && (
        <MobileSheet
          onClose={() => setMenuOpen(false)}
          landing={isLanding}
          loggedIn={loggedIn}
          email={email}
          initials={initials}
          centerLinks={centerLinks}
          ctaPrimary={ctaPrimary}
          onSignOut={handleSignOut}
        />
      )}
    </>
  );
}

// CTA primario: Signal Red, mono 12px bold, 10px 18px, radius 6.
const ctaPrimaryClass =
  "inline-flex items-center rounded-[6px] bg-signal-red px-[18px] py-2.5 font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-white transition-colors hover:bg-signal-red/90";

function DropItem({
  href,
  onNav,
  children,
}: {
  href: string;
  onNav: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNav}
      className="block px-4 py-2.5 font-body text-sm text-[var(--franco-text)] transition-colors hover:bg-[var(--franco-elevated)]"
    >
      {children}
    </Link>
  );
}

// ── Mobile bottom-sheet ─────────────────────────────────────────────────
function MobileSheet({
  onClose,
  landing,
  loggedIn,
  email,
  initials,
  centerLinks,
  ctaPrimary,
  onSignOut,
}: {
  onClose: () => void;
  landing: boolean;
  loggedIn: boolean;
  email: string;
  initials: string;
  centerLinks: NavLink[];
  ctaPrimary: { label: string; href: string };
  onSignOut: () => void;
}) {
  // ESC + scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const itemClass =
    "block w-full px-6 py-3.5 text-left font-body text-base font-medium text-[var(--franco-text)] hover:bg-[var(--franco-elevated)] transition-colors";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menú de navegación"
    >
      {/* Backdrop */}
      <div
        className="unav-fade absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="unav-slide absolute bottom-0 left-0 right-0 flex max-h-[85dvh] flex-col rounded-t-2xl"
        style={{
          background: "var(--franco-card)",
          borderTop: "0.5px solid var(--franco-border)",
        }}
      >
        {/* Header sticky con cierre */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "0.5px solid var(--franco-border)" }}
        >
          {loggedIn ? (
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal-red font-mono text-[12px] font-bold text-white">
                {initials}
              </span>
              <span className="truncate font-body text-sm text-[var(--franco-text-secondary)]">
                {email}
              </span>
            </div>
          ) : (
            <FrancoLogo size="header" inverted />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="-mr-1.5 p-1.5 text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body scroll natural */}
        <div className="flex-1 overflow-y-auto py-2">
          {centerLinks.map((l) =>
            l.href.includes("#") ? (
              <a
                key={l.label}
                href={l.href}
                onClick={onClose}
                className={itemClass}
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.label}
                href={l.href}
                onClick={onClose}
                className={itemClass}
              >
                {l.label}
              </Link>
            ),
          )}

          {loggedIn && (
            <>
              <div
                className="my-2"
                style={{ borderTop: "0.5px solid var(--franco-border)" }}
              />
              <Link href="/cuenta" onClick={onClose} className={itemClass}>
                Mi cuenta
              </Link>
              <Link href="/perfil" onClick={onClose} className={itemClass}>
                Mi perfil
              </Link>
            </>
          )}

          {/* Toggle de tema dentro del sheet */}
          <div
            className="my-2"
            style={{ borderTop: "0.5px solid var(--franco-border)" }}
          />
          <div className="flex items-center justify-between px-6 py-3">
            <span className="font-body text-base font-medium text-[var(--franco-text)]">
              Tema
            </span>
            <NavThemeToggle landing={landing} />
          </div>

          {!loggedIn && landing && (
            <div className="px-6 pb-1 pt-2">
              <span
                className="inline-flex items-center rounded-full border px-2.5 py-1 font-mono uppercase"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.12em",
                  color: "var(--franco-text-muted)",
                  borderColor: "var(--franco-border)",
                }}
              >
                Beta · disponible para Santiago
              </span>
            </div>
          )}

          {loggedIn && (
            <button
              type="button"
              onClick={onSignOut}
              className="block w-full px-6 py-3.5 text-left font-body text-base text-[var(--franco-text-muted)] hover:bg-[var(--franco-elevated)] transition-colors"
            >
              Cerrar sesión
            </button>
          )}
        </div>

        {/* CTA full-width al pie */}
        <div
          className="px-6 py-4"
          style={{ borderTop: "0.5px solid var(--franco-border)" }}
        >
          <Link
            href={ctaPrimary.href}
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-[6px] bg-signal-red px-4 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-white transition-colors hover:bg-signal-red/90"
          >
            {ctaPrimary.label}
          </Link>
        </div>
      </div>

      <style jsx>{`
        .unav-fade {
          animation: unavFade 200ms ease-out;
        }
        .unav-slide {
          animation: unavSlide 240ms cubic-bezier(0.32, 0.72, 0, 1);
        }
        @keyframes unavFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes unavSlide {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}

export default UnifiedNav;
