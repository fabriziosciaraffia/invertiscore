"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check } from "lucide-react";

export function ShareButton({ id, score, nombre }: { id: string; score: number; nombre: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/analisis/${id}`;
    const text = `${nombre} obtuvo un InvertiScore de ${score}/100`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "InvertiScore", text, url });
        return;
      } catch {
        // fallback to clipboard
      }
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={handleShare}>
      {copied ? (
        <>
          <Check className="h-4 w-4" /> Copiado
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" /> Compartir
        </>
      )}
    </Button>
  );
}
