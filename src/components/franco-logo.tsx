import Link from "next/link";

interface FrancoLogoProps {
  size?: "sm" | "header" | "md" | "lg" | "xl";
  /** Sin efecto desde hace tiempo (14 llamadas lo pasan). Se conserva para no
   *  tocarlas; el wordmark ya toma el tema de los tokens `--franco-wm-*`. */
  inverted?: boolean;
  /** Sobre fondo de marca (la textura roja del cierre de la landing): todo en
   *  papel. El `.ai` en Signal Red sobre rojo da 1,0:1 — invisible —, y el "re"
   *  fantasma sube a .75 porque al .28 no llega a 3:1 (medido en FASE 0 del goal
   *  landing v14). Único caso en que el `.ai` no va en rojo. */
  onBrand?: boolean;
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
  onBrand = false,
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
          style={{ color: onBrand ? 'rgba(250,250,248,0.75)' : 'var(--franco-wm-re)', marginRight: '-0.08em' }}
        >
          re
        </span>
        <span
          className="font-heading font-bold transition-colors duration-300"
          style={{ color: onBrand ? '#FAFAF8' : 'var(--franco-wm-franco)' }}
        >
          franco
        </span>
        <span
          className={`font-body font-semibold ${s.dot} tracking-wide`}
          style={{ fontSize: '0.35em', letterSpacing: '0.1em', color: onBrand ? '#FAFAF8' : '#C8323C' }}
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
