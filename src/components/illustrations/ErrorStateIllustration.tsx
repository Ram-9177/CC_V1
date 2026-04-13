import { cn } from "@/lib/utils"
import { IllustrationShell, type IllustrationShellProps } from "./IllustrationShell"

const outline = "hsl(var(--foreground) / 0.14)"
const ink = "hsl(var(--foreground) / 0.82)"
const card = "hsl(var(--card))"
const accentSurface = "hsl(var(--accent))"
const primary = "hsl(var(--primary))"
const primaryFg = "hsl(var(--primary-foreground))"

type Props = Pick<IllustrationShellProps, "className" | "decorative" | "aria-label">

export function ErrorStateIllustration({
  className,
  decorative = true,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <IllustrationShell
      decorative={decorative}
      aria-label={ariaLabel}
      className={cn("max-w-[280px] mx-auto", className)}
    >
      <svg
        viewBox="0 0 300 220"
        className="w-full h-auto block"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        focusable={false}
      >
        <rect
          x="32"
          y="20"
          width="236"
          height="180"
          rx="28"
          fill={card}
          stroke={outline}
          strokeWidth={1.6}
        />
        <rect
          x="50"
          y="70"
          width="92"
          height="72"
          rx="14"
          fill={accentSurface}
          opacity={0.92}
        />
        <rect x="62" y="84" width="44" height="9" rx="4.5" fill={ink} opacity={0.1} />
        <line x1="62" y1="104" x2="126" y2="104" stroke={ink} strokeOpacity={0.18} strokeWidth={2} strokeLinecap="round" />
        <line x1="62" y1="118" x2="112" y2="118" stroke={ink} strokeOpacity={0.14} strokeWidth={2} strokeLinecap="round" />

        <path
          d="M155 54H208L228 74V150C228 159.389 220.389 167 211 167H154C144.611 167 137 159.389 137 150V71C137 61.611 144.611 54 154 54Z"
          fill={card}
          stroke={ink}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <path
          d="M208 54V69C208 77.284 214.716 84 223 84H228"
          stroke={ink}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M182 82L169 101L182 111L168 132L186 146"
          stroke={ink}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="157" y1="92" x2="202" y2="92" stroke={ink} strokeOpacity={0.26} strokeWidth={2.2} strokeLinecap="round" />
        <line x1="192" y1="118" x2="210" y2="118" stroke={ink} strokeOpacity={0.46} strokeWidth={2.2} strokeLinecap="round" />
        <line x1="192" y1="132" x2="205" y2="132" stroke={ink} strokeOpacity={0.3} strokeWidth={2.2} strokeLinecap="round" />

        <circle cx="112" cy="94" r="24" fill={primary} />
        <line x1="112" y1="84" x2="112" y2="101" stroke={primaryFg} strokeWidth={3.2} strokeLinecap="round" />
        <circle cx="112" cy="112" r="2.8" fill={primaryFg} />

        <line x1="56" y1="168" x2="242" y2="168" stroke={ink} strokeOpacity={0.24} strokeWidth={2.2} strokeLinecap="round" />
        <circle cx="46" cy="126" r="3.5" fill={card} stroke={primary} strokeWidth={1.5} opacity={0.85} />
        <circle cx="248" cy="116" r="3" fill={card} stroke={primary} strokeWidth={1.5} opacity={0.85} />
        <path d="M90 148L86 154" stroke={primary} strokeWidth={1.8} strokeLinecap="round" />
        <path d="M244 98L248 92" stroke={primary} strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    </IllustrationShell>
  )
}
