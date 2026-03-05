"use client";

import { useEffect, useState } from "react";

function getScoreColor(score: number): string {
  if (score >= 80) return "hsl(142, 71%, 45%)"; // green
  if (score >= 65) return "hsl(217, 91%, 60%)"; // blue
  if (score >= 50) return "hsl(48, 96%, 53%)";  // yellow
  if (score >= 30) return "hsl(25, 95%, 53%)";  // orange
  return "hsl(0, 84%, 60%)";                     // red
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
  const containerSize = size === "lg" ? "h-36 w-36" : "h-24 w-24";
  const textSize = size === "lg" ? "text-4xl" : "text-2xl";

  return (
    <div className={`relative flex ${containerSize} shrink-0 items-center justify-center`}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-100"
        />
      </svg>
      <div className="text-center">
        <div className={`${textSize} font-bold`} style={{ color }}>{displayed}</div>
        <div className="text-[10px] text-muted-foreground">InvertiScore</div>
      </div>
    </div>
  );
}
