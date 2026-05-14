"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLandingTheme } from "./LandingTheme";

export default function LandingNav() {
  const { theme, toggle } = useLandingTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navBg = scrolled ? "var(--landing-nav-bg)" : "transparent";
  const navBorder = scrolled ? "var(--landing-nav-border)" : "transparent";

  return (
    <header
      className="sticky top-0 z-50 w-full backdrop-blur-md transition-[background,border-color] duration-250"
      style={{ background: navBg, borderBottom: `1px solid ${navBorder}` }}
    >
      <div className="mx-auto flex h-[64px] max-w-[1280px] items-center justify-between px-6">
        {/* Wordmark + tagline (desktop) */}
        <Link href="/" className="inline-flex flex-col" aria-label="refranco.ai · inicio">
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
          <span
            className="mt-1 hidden font-mono uppercase md:inline"
            style={{
              fontSize: 9,
              letterSpacing: "0.18em",
              color: "var(--landing-text-secondary)",
            }}
          >
            Real estate en su estado más franco
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden items-center gap-7 md:flex">
          <a
            href="#que-hace-franco"
            className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] transition-opacity hover:opacity-100"
            style={{ color: "var(--landing-text)", opacity: 0.65 }}
          >
            Cómo funciona
          </a>
          <a
            href="#pricing"
            className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] transition-opacity hover:opacity-100"
            style={{ color: "var(--landing-text)", opacity: 0.65 }}
          >
            Precios
          </a>
          <Link
            href="/login"
            className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] transition-opacity hover:opacity-100"
            style={{ color: "var(--landing-text)", opacity: 0.65 }}
          >
            Ingresar
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {/* Toggle tema */}
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-[background,opacity] duration-200 hover:bg-[rgba(127,127,127,0.12)]"
            style={{ color: "var(--landing-text)" }}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>

          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-95"
          >
            Analizar mi depto
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
