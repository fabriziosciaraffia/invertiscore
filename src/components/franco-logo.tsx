import Link from "next/link";

interface FrancoLogoProps {
  size?: "sm" | "header" | "md" | "lg" | "xl";
  inverted?: boolean;
  showTagline?: boolean;
  className?: string;
  href?: string;
}

const sizeConfig = {
  sm: { text: "text-[14px]", dot: "text-[11px]", taglineMt: 2, taglineFontSize: '0.18em', taglineLetterSpacing: '0.12em' },
  header: { text: "text-[26px]", dot: "text-[18px]", taglineMt: 4, taglineFontSize: '0.19em', taglineLetterSpacing: '0.18em' },
  md: { text: "text-[28px]", dot: "text-[17px]", taglineMt: 4, taglineFontSize: '10px', taglineLetterSpacing: '0.08em' },
  lg: { text: "text-[36px]", dot: "text-[27px]", taglineMt: 5, taglineFontSize: '0.19em', taglineLetterSpacing: '0.20em' },
  xl: { text: "text-[56px]", dot: "text-[36px]", taglineMt: 6, taglineFontSize: '0.19em', taglineLetterSpacing: '0.22em' },
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
            fontSize: s.taglineFontSize,
            marginTop: `${s.taglineMt}px`,
            letterSpacing: s.taglineLetterSpacing,
            color: inverted ? 'rgba(250,250,248,0.22)' : 'rgba(15,15,15,0.22)',
            textAlign: 'center',
            lineHeight: '1',
            width: '100%',
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
