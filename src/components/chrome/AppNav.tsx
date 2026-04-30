"use client";

import Link from "next/link";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import FrancoLogo from "@/components/franco-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export interface MobileMenuItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface AppNavProps {
  variant: "landing" | "marketing" | "app";
  logoSize?: "sm" | "md";
  ctaSlot?: ReactNode;
  linksSlot?: ReactNode;
  showThemeToggle?: boolean;
  mobileMenuItems?: MobileMenuItem[];
}

export function AppNav({
  variant,
  logoSize = "md",
  ctaSlot,
  linksSlot,
  showThemeToggle = true,
  mobileMenuItems,
}: AppNavProps) {
  const isLanding = variant === "landing";
  const isMarketing = variant === "marketing";

  // landing: no sticky / sin backdrop. marketing: sticky + blur. app: sticky opaco.
  const wrapperClass = isLanding ? "" : "sticky top-0 z-50";
  const bgClass = isMarketing
    ? "bg-[color-mix(in_srgb,var(--franco-bg)_95%,transparent)] backdrop-blur-md"
    : "bg-[var(--franco-bg)]";

  // FrancoLogo "header" = 26px (md), "sm" = 14px.
  const francoSize = logoSize === "sm" ? "sm" : "header";

  // Mobile dropdown — Commit 5 lo reemplaza por bottom sheet.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  const showMobileMenu = !isLanding && (linksSlot || (mobileMenuItems && mobileMenuItems.length > 0));

  return (
    <nav
      className={`${wrapperClass} ${bgClass}`}
      style={{ borderBottom: "0.5px solid var(--franco-border)" }}
    >
      <div className="mx-auto max-w-[1100px] h-14 flex items-center justify-between px-4 sm:px-6">
        <FrancoLogo size={francoSize} href="/" inverted />

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-3">
          {linksSlot}
          {ctaSlot}
          {showThemeToggle && <ThemeToggle />}
        </div>

        {/* Mobile: CTA inline + ThemeToggle + hamburger (si hay links) */}
        <div className="flex md:hidden items-center gap-2">
          {ctaSlot}
          {showThemeToggle && <ThemeToggle />}
          {showMobileMenu && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
                className="p-2 text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl bg-[var(--franco-card)] p-3 shadow-lg"
                  style={{ border: "0.5px solid var(--franco-border)" }}
                >
                  <ul className="list-none p-0 m-0 flex flex-col gap-1">
                    {mobileMenuItems?.map((item, i) => (
                      <li key={i}>
                        {item.href ? (
                          <Link
                            href={item.href}
                            onClick={() => {
                              item.onClick?.();
                              setMenuOpen(false);
                            }}
                            className="block font-body text-[13px] font-medium text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] py-2 px-3 rounded-md"
                          >
                            {item.label}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              item.onClick?.();
                              setMenuOpen(false);
                            }}
                            className="w-full text-left font-body text-[13px] font-medium text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] py-2 px-3 rounded-md"
                          >
                            {item.label}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

interface NavPrimaryCTAProps {
  href: string;
  label?: string;
}

// CTA primario unificado para nav: Signal Red + mono uppercase tracking 0.06em
// (skill Patrón 5 form CTA, ajustado a 11px para escala nav).
export function NavPrimaryCTA({ href, label = "Analizar gratis →" }: NavPrimaryCTAProps) {
  return (
    <Link
      href={href}
      className="bg-signal-red text-white font-mono uppercase text-[11px] font-medium tracking-[0.06em] px-4 py-2 rounded-lg hover:bg-signal-red/90 transition-colors"
    >
      {label}
    </Link>
  );
}
