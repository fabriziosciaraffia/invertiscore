"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";

interface FrancoLogoProps {
  size?: "sm" | "header" | "md" | "lg" | "xl";
  inverted?: boolean;
  showTagline?: boolean;
  className?: string;
  href?: string;
}

const sizeConfig = {
  sm: { text: "text-[14px]", dot: "text-[11px]", taglinePx: 7, taglineMt: 2 },
  header: { text: "text-[26px]", dot: "text-[18px]", taglinePx: 8, taglineMt: 4 },
  md: { text: "text-[28px]", dot: "text-[17px]", taglinePx: 10, taglineMt: 4 },
  lg: { text: "text-[36px]", dot: "text-[27px]", taglinePx: 11, taglineMt: 5 },
  xl: { text: "text-[56px]", dot: "text-[36px]", taglinePx: 13, taglineMt: 8 },
};

export default function FrancoLogo({
  size = "md",
  inverted = false,
  showTagline = false,
  className = "",
  href,
}: FrancoLogoProps) {
  const s = sizeConfig[size];
  const wordmarkRef = useRef<HTMLSpanElement>(null);
  const taglineRef = useRef<HTMLSpanElement>(null);
  const [scaleX, setScaleX] = useState(1);

  useEffect(() => {
    if (!showTagline || !wordmarkRef.current || !taglineRef.current) return;
    const wmW = wordmarkRef.current.offsetWidth;
    const tlW = taglineRef.current.scrollWidth;
    if (wmW > 0 && tlW > 0) {
      setScaleX(Math.min(1, wmW / tlW));
    }
  }, [showTagline, size]);

  const logo = (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }} className={className}>
      <span
        ref={wordmarkRef}
        className={`${s.text} leading-tight`}
        style={{ display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap' }}
      >
        <span
          className="font-heading italic font-normal transition-colors duration-300"
          style={{ color: inverted ? 'rgba(255,255,255,0.32)' : 'rgba(15,15,15,0.28)', marginRight: '-0.08em' }}
        >
          re
        </span>
        <span
          className="font-heading font-bold transition-colors duration-300"
          style={{ color: inverted ? '#FFFFFF' : '#0F0F0F' }}
        >
          franco
        </span>
        <span
          className={`font-body font-semibold text-[#C8323C] ${s.dot} tracking-wide`}
          style={{ fontSize: '0.35em', letterSpacing: '0.1em' }}
        >
          .ai
        </span>
      </span>
      {showTagline && (
        <span
          style={{
            marginTop: `${s.taglineMt}px`,
            overflow: 'hidden',
            width: '100%',
            textAlign: 'center',
            lineHeight: 1,
          }}
        >
          <span
            ref={taglineRef}
            className="font-mono uppercase"
            style={{
              display: 'inline-block',
              whiteSpace: 'nowrap',
              fontSize: `${s.taglinePx}px`,
              letterSpacing: '0.25em',
              color: inverted ? 'rgba(250,250,248,0.22)' : 'rgba(15,15,15,0.22)',
              transform: `scaleX(${scaleX})`,
              transformOrigin: 'center',
            }}
          >
            Real estate en su estado más franco
          </span>
        </span>
      )}
    </span>
  );

  if (href) {
    return <Link href={href}>{logo}</Link>;
  }

  return logo;
}
