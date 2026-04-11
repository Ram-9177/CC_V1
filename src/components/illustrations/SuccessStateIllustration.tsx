import { cn } from "@/lib/utils"
import { IllustrationShell, type IllustrationShellProps } from "./IllustrationShell"

const stroke = "hsl(var(--border))"
const muted = "hsl(var(--muted))"
const card = "hsl(var(--card))"
const success = "hsl(var(--success))"
const successFg = "hsl(var(--success-foreground))"
const primary = "hsl(var(--primary))"

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
        {/* Document stack */}
        <rect
          x="152"
          y="48"
          width="108"
          height="124"
          rx="10"
          fill={muted}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <rect
          x="132"
          y="64"
          width="108"
          height="124"
          rx="10"
          fill={card}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <line
          x1="148"
          y1="88"
          x2="216"
          y2="88"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line
          x1="148"
          y1="104"
          x2="200"
          y2="104"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line
          x1="148"
          y1="120"
          x2="208"
          y2="120"
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
        {/* Subtle primary rule */}
        <rect x="148" y="136" width="40" height="6" rx="3" fill={primary} opacity={0.4} />
        {/* Success badge */}
        <circle cx="214" cy="118" r="30" fill={success} stroke={stroke} strokeWidth={1.5} />
        <path
          d="M 198 118 L 208 128 L 230 102"
          stroke={successFg}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Figure */}
        <circle cx="72" cy="100" r="16" fill={muted} stroke={stroke} strokeWidth={1.5} />
        <rect
          x="56"
          y="120"
          width="32"
          height="48"
          rx="9"
          fill={muted}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <path
          d="M 88 132 L 132 124"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d="M 56 172 L 50 200 M 88 172 L 94 200"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    </IllustrationShell>
  )
}
