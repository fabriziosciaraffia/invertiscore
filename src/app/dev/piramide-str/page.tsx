"use client";

// Página DEV — pixel de la pirámide STR (E.1b) con matriz N=10 (nivel3 4+3). Fixture real
// de 10 hallazgos (GE-2 recomputado, trim tir/patrimonio) snapshoteado en fixture.json. NO
// consume DB en runtime. Ruta temporal de dev para el pixel de ⛔#3.

import { useState } from "react";
import type { Hallazgo } from "@/lib/types";
import { PiramideHallazgosSTR } from "@/components/analysis/str/PiramideHallazgosSTR";
import fixture from "./fixture.json";

export default function DevPiramideStrPage() {
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  const hallazgos = fixture.hallazgos as unknown as Hallazgo[];
  return (
    <div style={{ background: "var(--franco-bg, #FAFAF8)", minHeight: "100vh", padding: "32px 24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--franco-text-tertiary)" }}>
            DEV · pixel pirámide STR
          </span>
          <span className="font-serif font-bold" style={{ fontSize: 18 }}>
            {fixture.comuna} · {fixture.veredicto} · score {fixture.score} · N={hallazgos.length}
          </span>
          <button
            onClick={() => setCurrency((c) => (c === "CLP" ? "UF" : "CLP"))}
            className="font-mono ml-auto"
            style={{ fontSize: 11, border: "1px solid var(--franco-border, #E6E6E2)", padding: "4px 10px", borderRadius: 6 }}
          >
            {currency}
          </button>
        </div>
        <PiramideHallazgosSTR hallazgos={hallazgos} currency={currency} valorUF={fixture.uf} />
      </div>
    </div>
  );
}
