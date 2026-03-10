"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Building2, ArrowLeft, Menu, X } from "lucide-react";
import { ShareButton } from "./share-button";
import { DeleteButton } from "./delete-button";

export function AnalysisNav({
  userId,
  analysisId,
  score,
  nombre,
}: {
  userId: string | null;
  analysisId: string;
  score: number;
  nombre: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <nav className="border-b border-border/50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href={userId ? "/dashboard" : "/"} className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">InvertiScore</span>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/pricing">
            <Button variant="ghost" size="sm">Planes</Button>
          </Link>
          <ShareButton id={analysisId} score={score} nombre={nombre} />
          <DeleteButton id={analysisId} />
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Button>
          </Link>
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
            <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl border border-border bg-white p-3 shadow-lg dark:bg-card">
              <div className="flex flex-col gap-1">
                <Link href="/pricing" onClick={() => setMenuOpen(false)}>
                  <Button variant="ghost" size="sm" className="w-full justify-start">Planes</Button>
                </Link>
                <div onClick={() => setMenuOpen(false)}>
                  <ShareButton id={analysisId} score={score} nombre={nombre} />
                </div>
                <div onClick={() => setMenuOpen(false)}>
                  <DeleteButton id={analysisId} />
                </div>
                <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                    <ArrowLeft className="h-4 w-4" /> Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
