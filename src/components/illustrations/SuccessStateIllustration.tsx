import { cn } from "@/lib/utils"
import { IllustrationShell, type IllustrationShellProps } from "./IllustrationShell"

const outline = "hsl(var(--foreground) / 0.14)"
const ink = "hsl(var(--foreground) / 0.82)"
const card = "hsl(var(--card))"
const accentSurface = "hsl(var(--accent))"
const primary = "hsl(var(--primary))"
const primaryFg = "hsl(var(--primary-foreground))"

type Props = Pick<IllustrationShellProps, "className" | "decorative" | "aria-label">

export function SuccessStateIllustration({
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
          x="52"
          y="76"
          width="86"
          height="62"
          rx="14"
          fill={accentSurface}
          opacity={0.92}
        />
        <line x1="64" y1="94" x2="120" y2="94" stroke={ink} strokeOpacity={0.16} strokeWidth={2} strokeLinecap="round" />
        <line x1="64" y1="108" x2="110" y2="108" stroke={ink} strokeOpacity={0.14} strokeWidth={2} strokeLinecap="round" />
        <line x1="64" y1="122" x2="96" y2="122" stroke={ink} strokeOpacity={0.12} strokeWidth={2} strokeLinecap="round" />

        <path
          d="M86 112H124L138 126H214C221.18 126 227 131.82 227 139V152C227 160.284 220.284 167 212 167H88C79.716 167 73 160.284 73 152V125C73 117.82 78.82 112 86 112Z"
          fill={card}
          stroke={ink}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <path
          d="M73 128L150 128"
          stroke={ink}
          strokeWidth={2.2}
          strokeLinecap="round"
        />

        <circle cx="183" cy="106" r="31" fill={primary} />
        <circle cx="183" cy="106" r="24" fill={card} opacity={0.18} />
        <path
          d="M168 106L178 116L199 94"
          stroke={primaryFg}
          strokeWidth={3.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M148 60H203L224 80V156C224 162.075 219.075 167 213 167H148"
          fill="none"
          stroke={ink}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.22}
        />
        <line x1="158" y1="88" x2="196" y2="88" stroke={ink} strokeOpacity={0.18} strokeWidth={2.2} strokeLinecap="round" />

        <line x1="56" y1="168" x2="242" y2="168" stroke={ink} strokeOpacity={0.24} strokeWidth={2.2} strokeLinecap="round" />
        <circle cx="46" cy="132" r="3.5" fill={card} stroke={primary} strokeWidth={1.5} opacity={0.85} />
        <circle cx="246" cy="124" r="3" fill={card} stroke={primary} strokeWidth={1.5} opacity={0.85} />
        <path d="M100 148L96 154" stroke={primary} strokeWidth={1.8} strokeLinecap="round" />
        <path d="M238 96L244 92" stroke={primary} strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    </IllustrationShell>
  )
}
