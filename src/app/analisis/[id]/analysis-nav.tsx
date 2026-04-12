"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Menu, X, Share2 } from "lucide-react";
import FrancoLogo from "@/components/franco-logo";
import { ShareButton } from "./share-button";
import { DeleteButton } from "./delete-button";
import { ThemeToggle } from "@/components/theme-toggle";

export function AnalysisNav({
  userId,
  analysisId,
  score,
  nombre,
  comuna,
  isSharedView = false,
}: {
  userId?: string | null;
  analysisId: string;
  score: number;
  nombre: string;
  comuna?: string;
  isSharedView?: boolean;
}) {
  const isGuest = !userId;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0F0F0F]">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <FrancoLogo size="header" href="/" inverted />

        {/* Desktop */}
        <div className="hidden items-center gap-2 md:flex">
          {isGuest ? (
            <>
              <Link href="/register" title="Regístrate para compartir este análisis">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                  <Share2 className="h-4 w-4" /> Compartir
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="gap-2 bg-[#C8323C] text-white hover:bg-[#C8323C]/90">
                  Registrarme gratis
                </Button>
              </Link>
            </>
          ) : (
            <>
              <ShareButton id={analysisId} score={score} nombre={nombre} comuna={comuna} />
              {!isSharedView && <DeleteButton id={analysisId} />}
              <Link href={isSharedView ? "/analisis/nuevo" : "/dashboard"}>
                <Button variant="ghost" size="sm" className="gap-2 text-white/50 hover:text-[#FAFAF8] hover:bg-[#1A1A1A]">
                  <ArrowLeft className="h-4 w-4" /> {isSharedView ? "Analizar mi depto" : "Dashboard"}
                </Button>
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>

        {/* Mobile hamburger */}
        <div className="relative md:hidden" ref={menuRef}>
          <button
            className="p-2 text-muted-foreground"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menú"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl border border-white/[0.08] bg-[#1A1A1A] p-3 shadow-lg">
              <div className="flex flex-col gap-1">
                {isGuest ? (
                  <>
                    <Link href="/register" onClick={() => setMenuOpen(false)}>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
                        <Share2 className="h-4 w-4" /> Compartir
                      </Button>
                    </Link>
                    <Link href="/register" onClick={() => setMenuOpen(false)}>
                      <Button size="sm" className="w-full gap-2 bg-[#0F0F0F] text-[#FAFAF8] hover:opacity-90">
                        Registrarme gratis
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <div onClick={() => setMenuOpen(false)}>
                      <ShareButton id={analysisId} score={score} nombre={nombre} comuna={comuna} />
                    </div>
                    {!isSharedView && (
                      <div onClick={() => setMenuOpen(false)}>
                        <DeleteButton id={analysisId} />
                      </div>
                    )}
                    <Link href={isSharedView ? "/analisis/nuevo" : "/dashboard"} onClick={() => setMenuOpen(false)}>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                        <ArrowLeft className="h-4 w-4" /> {isSharedView ? "Analizar mi depto" : "Dashboard"}
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
