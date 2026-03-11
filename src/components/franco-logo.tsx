import Link from "next/link";

interface FrancoLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  inverted?: boolean;
  showTagline?: boolean;
  className?: string;
  href?: string;
}

const sizeConfig = {
  sm: { text: "text-[14px]", dot: "text-[11px]", tagline: "text-[7px]" },
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
  const baseColor = inverted ? "text-white" : "text-franco-ink";
  const reOpacity = inverted ? "opacity-25" : "opacity-[0.28]";

  const logo = (
    <span className={`inline-flex flex-col ${className}`}>
      <span className={`${s.text} leading-tight`}>
        <span className={`font-heading font-normal transition-colors duration-300 ${baseColor} ${reOpacity}`}>
          re
        </span>
        <span className={`font-heading font-bold transition-colors duration-300 ${baseColor}`}>franco</span>
        <span
          className={`font-body font-semibold text-franco-red ${s.dot} tracking-wide`}
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
