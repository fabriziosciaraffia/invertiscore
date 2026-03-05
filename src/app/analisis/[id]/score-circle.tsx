"use client";

import { useEffect, useState } from "react";

export function ScoreCircle({ score }: { score: number }) {
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

  const color =
    score >= 75
      ? "hsl(142, 71%, 45%)"
      : score >= 50
        ? "hsl(217, 91%, 60%)"
        : score >= 30
          ? "hsl(38, 92%, 50%)"
          : "hsl(0, 84%, 60%)";

  return (
    <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-100"
        />
      </svg>
      <div className="text-center">
        <div className="text-4xl font-bold" style={{ color }}>
          {displayed}
        </div>
        <div className="text-[10px] text-muted-foreground">InvertiScore</div>
      </div>
    </div>
  );
}
