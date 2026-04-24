"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import FrancoLogo from "@/components/franco-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ResumenConfirmacion,
  REVISAR_SS_KEY,
  type RevisarPayload,
  type TierInfo,
} from "@/components/formulario/ResumenConfirmacion";

export default function RevisarAnalisisPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<RevisarPayload | null>(null);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    // 1. Read sessionStorage — redirect to form if empty
    let stored: RevisarPayload | null = null;
    try {
      const raw = sessionStorage.getItem(REVISAR_SS_KEY);
      if (raw) stored = JSON.parse(raw) as RevisarPayload;
    } catch {
      stored = null;
    }

    if (!stored || !stored.apiPayload) {
      router.replace("/analisis/nuevo");
      return;
    }

    if (mounted) setPayload(stored);

    // 2. Fetch tier info
    fetch("/api/me/tier")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TierInfo | null) => {
        if (!mounted) return;
        setTierInfo(
          data ?? { tier: "guest", isAdmin: false, credits: 0, email: null },
        );
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setTierInfo({ tier: "guest", isAdmin: false, credits: 0, email: null });
        setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      {/* Nav (same shell pattern as /analisis/nuevo) */}
      <nav className="sticky top-0 z-50 border-b border-[var(--franco-border)] bg-[var(--franco-bg)]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <FrancoLogo />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {!ready || !payload || !tierInfo ? (
        <div className="flex items-center justify-center py-32 text-[var(--franco-text-secondary)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="font-body text-sm">Cargando resumen…</span>
        </div>
      ) : (
        <ResumenConfirmacion payload={payload} tierInfo={tierInfo} />
      )}
    </div>
  );
}
