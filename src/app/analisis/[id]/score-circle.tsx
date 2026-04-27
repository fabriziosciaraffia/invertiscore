"use client";

import { useEffect, useState } from "react";

function getScoreColor(score: number): string {
  if (score >= 75) return "var(--ink-400)";    // verdict COMPRAR
  if (score >= 40) return "var(--signal-red)"; // verdict AJUSTAR EL PRECIO
  return "var(--signal-red)";                  // verdict BUSCAR OTRA
}

function getScoreLabel(score: number): string {
  if (score >= 75) return "Los números respaldan esta inversión";
  if (score >= 40) return "Los números sugieren ajustar el precio";
  return "Busca otra";
}

export function ScoreCircle({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const [displayed, setDisplayed] = useState(0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayed / 100) * circumference;

  useEffect(() => {
    let frame: number;
    const duration = 1200;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * score));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const containerSize = size === "lg" ? "h-36 w-36" : "h-24 w-24";
  const textSize = size === "lg" ? "text-5xl" : "text-2xl";

  return (
    <div className={`relative flex ${containerSize} shrink-0 items-center justify-center`}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--ink-200)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-100"
        />
      </svg>
      <div className="text-center">
        <div className="font-body text-[8px] uppercase tracking-widest text-franco-muted">Franco Score</div>
        {/* TODO(franco-design): Capa 3 Patrón 1 manda "Score: número Mono Bold 30px"; hoy está en Source Serif Bold. Revisar en migración Capa 3. */}
        <div className={`${textSize} font-heading font-bold text-franco-ink`}>{displayed}</div>
        {size === "lg" && (
          <div className="text-[10px] font-medium" style={{ color }}>{label}</div>
        )}
      </div>
    </div>
  );
}
