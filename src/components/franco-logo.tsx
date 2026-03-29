import Link from "next/link";

interface FrancoLogoProps {
  size?: "sm" | "header" | "md" | "lg" | "xl";
  inverted?: boolean;
  showTagline?: boolean;
  className?: string;
  href?: string;
}

const sizeConfig = {
  sm: { text: "text-[14px]", dot: "text-[11px]", taglineEm: 0.45, taglineMt: 3 },
  header: { text: "text-[26px]", dot: "text-[18px]", taglineEm: 0.45, taglineMt: 4 },
  md: { text: "text-[22px]", dot: "text-[17px]", taglineEm: 0.45, taglineMt: 4 },
  lg: { text: "text-[36px]", dot: "text-[27px]", taglineEm: 0.45, taglineMt: 6 },
  xl: { text: "text-[48px]", dot: "text-[36px]", taglineEm: 0.45, taglineMt: 6 },
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
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch' }} className={className}>
      <span className={`${s.text} leading-tight`} style={{ display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap' }}>
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
          className="font-mono uppercase block"
          style={{
            fontSize: `${s.taglineEm}em`,
            marginTop: `${s.taglineMt}px`,
            letterSpacing: '0.05em',
            wordSpacing: '-0.05em',
            color: inverted ? 'rgba(250,250,248,0.22)' : 'rgba(15,15,15,0.22)',
            textAlign: 'justify',
            textAlignLast: 'justify',
            lineHeight: '1',
            width: '100%',
            overflow: 'hidden',
          }}
        >
          Real estate en su estado más franco
        </span>
      )}
    </span>
  );

  if (href) {
    return <Link href={href}>{logo}</Link>;
  }

  return logo;
}
