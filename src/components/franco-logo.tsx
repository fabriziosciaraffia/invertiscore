import Link from "next/link";

interface FrancoLogoProps {
  size?: "sm" | "header" | "md" | "lg" | "xl";
  inverted?: boolean;
  showTagline?: boolean;
  className?: string;
  href?: string;
}

const sizeConfig = {
  sm: { text: "text-[14px]", dot: "text-[11px]", taglinePx: 8, taglineMt: 4 },
  header: { text: "text-[26px]", dot: "text-[18px]", taglinePx: 9, taglineMt: 6 },
  md: { text: "text-[28px]", dot: "text-[17px]", taglinePx: 8, taglineMt: 4 },
  lg: { text: "text-[36px]", dot: "text-[27px]", taglinePx: 10, taglineMt: 6 },
  xl: { text: "text-[56px]", dot: "text-[36px]", taglinePx: 11, taglineMt: 8 },
};

export default function FrancoLogo({
  size = "md",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  inverted = false,
  showTagline = false,
  className = "",
  href,
}: FrancoLogoProps) {
  const s = sizeConfig[size];

  const logo = (
    <span className={`inline-flex flex-col items-center ${className}`}>
      <span className={`${s.text} leading-tight flex items-baseline`}>
        <span
          className="font-heading italic font-normal transition-colors duration-300"
          style={{ color: 'var(--franco-wordmark-re)', marginRight: '-0.08em' }}
        >
          re
        </span>
        <span
          className="font-heading font-bold transition-colors duration-300"
          style={{ color: 'var(--franco-wordmark-franco)' }}
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
          className="font-mono uppercase"
          style={{
            fontSize: `${s.taglinePx}px`,
            letterSpacing: '0.2em',
            color: 'var(--franco-text-muted)',
            marginTop: `${s.taglineMt}px`,
            textAlign: 'center',
            lineHeight: 1,
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
