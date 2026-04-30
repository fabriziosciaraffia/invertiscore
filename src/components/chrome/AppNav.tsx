"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import FrancoLogo from "@/components/franco-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileBottomSheet, type BottomSheetItem } from "./MobileBottomSheet";

export type MobileMenuItem = BottomSheetItem;

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

  // Mobile bottom sheet — solo si hay items para mostrar.
  const [sheetOpen, setSheetOpen] = useState(false);
  const showMobileMenu = !isLanding && mobileMenuItems && mobileMenuItems.length > 0;

  return (
    <>
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

          {/* Mobile: CTA inline + ThemeToggle + hamburger (si hay items) */}
          <div className="flex md:hidden items-center gap-2">
            {ctaSlot}
            {showThemeToggle && <ThemeToggle />}
            {showMobileMenu && (
              <button
                type="button"
                onClick={() => setSheetOpen((o) => !o)}
                aria-label={sheetOpen ? "Cerrar menú" : "Abrir menú"}
                className="p-2 text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"
              >
                {sheetOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
      </nav>

      {showMobileMenu && (
        <MobileBottomSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          items={mobileMenuItems}
        />
      )}
    </>
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
