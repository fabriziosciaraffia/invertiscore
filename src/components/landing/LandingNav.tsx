"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import FrancoLogo from "@/components/franco-logo";

type Tone = "light" | "dark";

/**
 * Detecta la luminosidad del background bajo el nav y conmuta
 * el wash entre crema (sobre claro) y carbón (sobre dark).
 */
function useBackgroundTone(triggerY = 50): { scrolled: boolean; tone: Tone } {
  const [scrolled, setScrolled] = useState(false);
  const [tone, setTone] = useState<Tone>("light");
  const lastToneRef = useRef<Tone>("light");

  useEffect(() => {
    const compute = () => {
      const y = window.scrollY;
      setScrolled(y > triggerY);

      const sample = document.elementFromPoint(window.innerWidth / 2, 90);
      if (!sample) return;
      const section = sample.closest("section, footer, header") as HTMLElement | null;
      const target = section ?? sample;
      const bg = window.getComputedStyle(target as HTMLElement).backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      if (!m) return;
      const [r, g, b] = m[1].split(",").map((v) => parseFloat(v.trim()));
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const next: Tone = lum < 0.5 ? "dark" : "light";
      if (next !== lastToneRef.current) {
        lastToneRef.current = next;
        setTone(next);
      }
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [triggerY]);

  return { scrolled, tone };
}

export default function LandingNav() {
  const { scrolled, tone } = useBackgroundTone();
  const isDark = tone === "dark";

  const bg = scrolled
    ? isDark
      ? "rgba(15,15,15,0.78)"
      : "rgba(232,230,225,0.78)"
    : "transparent";
  const borderColor = scrolled
    ? isDark
      ? "rgba(250,250,248,0.08)"
      : "rgba(15,15,15,0.08)"
    : "transparent";
  const linkColor = isDark ? "text-[#FAFAF8]/65 hover:text-[#FAFAF8]" : "text-[#0F0F0F]/65 hover:text-[#0F0F0F]";

  const wmOverride = isDark
    ? ({
        "--franco-wm-re": "rgba(250,250,248,0.32)",
        "--franco-wm-franco": "#FAFAF8",
      } as React.CSSProperties)
    : undefined;

  return (
    <header
      className="sticky top-0 z-50 w-full backdrop-blur-md transition-[background,border-color,color] duration-300"
      style={{ background: bg, borderBottom: `1px solid ${borderColor}`, ...wmOverride }}
    >
      <div className="mx-auto flex h-[64px] max-w-[1280px] items-center justify-between px-6">
        <Link href="/" className="inline-flex items-center" aria-label="refranco.ai · inicio">
          <FrancoLogo size="header" />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          <a
            href="#que-hace-franco"
            className={`font-mono text-[11px] font-medium uppercase tracking-[0.08em] transition-colors ${linkColor}`}
          >
            Cómo funciona
          </a>
          <a
            href="#pricing"
            className={`font-mono text-[11px] font-medium uppercase tracking-[0.08em] transition-colors ${linkColor}`}
          >
            Precios
          </a>
          <Link
            href="/login"
            className={`font-mono text-[11px] font-medium uppercase tracking-[0.08em] transition-colors ${linkColor}`}
          >
            Ingresar
          </Link>
        </nav>

        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-95"
        >
          Analizar mi depto
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </header>
  );
}
