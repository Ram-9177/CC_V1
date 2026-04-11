import { cn } from "@/lib/utils"
import { IllustrationShell, type IllustrationShellProps } from "./IllustrationShell"

const stroke = "hsl(var(--border))"
const muted = "hsl(var(--muted))"
const card = "hsl(var(--card))"
const primary = "hsl(var(--primary))"

type Props = Pick<IllustrationShellProps, "className" | "decorative" | "aria-label">

export function EmptyStateIllustration({
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
        {/* Dashboard cards — empty rows */}
        <rect
          x="118"
          y="42"
          width="168"
          height="132"
          rx="12"
          fill={card}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <rect
          x="134"
          y="58"
          width="56"
          height="10"
          rx="4"
          fill={muted}
        />
        <line
          x1="134"
          y1="84"
          x2="254"
          y2="84"
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray="6 5"
          strokeLinecap="round"
        />
        <line
          x1="134"
          y1="102"
          x2="220"
          y2="102"
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray="6 5"
          strokeLinecap="round"
        />
        <line
          x1="134"
          y1="120"
          x2="248"
          y2="120"
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray="6 5"
          strokeLinecap="round"
        />
        {/* Primary accent — mini bar chart */}
        <rect x="138" y="138" width="10" height="22" rx="3" fill={primary} />
        <rect x="154" y="130" width="10" height="30" rx="3" fill={primary} opacity={0.55} />
        <rect x="170" y="144" width="10" height="16" rx="3" fill={primary} opacity={0.35} />
        {/* Second card peek */}
        <rect
          x="200"
          y="28"
          width="78"
          height="52"
          rx="10"
          fill={muted}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <line
          x1="212"
          y1="44"
          x2="266"
          y2="44"
          stroke={stroke}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <line
          x1="212"
          y1="56"
          x2="252"
          y2="56"
          stroke={stroke}
          strokeWidth={1.2}
          strokeDasharray="4 4"
          strokeLinecap="round"
        />
        {/* Abstract figure */}
        <circle cx="72" cy="96" r="16" fill={muted} stroke={stroke} strokeWidth={1.5} />
        <rect
          x="56"
          y="116"
          width="32"
          height="46"
          rx="9"
          fill={muted}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <path
          d="M 88 128 L 118 108"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d="M 56 168 L 48 198 M 88 168 L 96 198"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    </IllustrationShell>
  )
}
