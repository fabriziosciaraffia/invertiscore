import Link from "next/link";

interface FrancoLogoProps {
  size?: "sm" | "header" | "md" | "lg" | "xl";
  inverted?: boolean;
  showTagline?: boolean;
  className?: string;
  href?: string;
}

const sizeConfig = {
  sm: { text: "text-[14px]", dot: "text-[11px]", tagline: "text-[7px]" },
  header: { text: "text-[26px]", dot: "text-[18px]", tagline: "text-[8px]" },
  md: { text: "text-[22px]", dot: "text-[17px]", tagline: "text-[9px]" },
  lg: { text: "text-[36px]", dot: "text-[27px]", tagline: "text-[12px]" },
  xl: { text: "text-[48px]", dot: "text-[36px]", tagline: "text-[14px]" },
};

export default function FrancoLogo({
  size = "md",
  inverted = false,
  showTagline = false,
  className = "",
  href,
}: FrancoLogoProps) {
  const s = sizeConfig[size];

  const logo = (
    <span className={`inline-flex flex-col ${className}`}>
      <span className={`${s.text} leading-tight`}>
        <span
          className="font-heading italic font-normal transition-colors duration-300"
          style={{ color: inverted ? 'rgba(255,255,255,0.32)' : 'rgba(15,15,15,0.28)' }}
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
          className={`font-mono uppercase tracking-widest text-franco-muted ${s.tagline} mt-1`}
        >
          RE FRANCO CON TU INVERSIÓN
        </span>
      )}
    </span>
  );

  if (href) {
    return <Link href={href}>{logo}</Link>;
  }

  return logo;
}
