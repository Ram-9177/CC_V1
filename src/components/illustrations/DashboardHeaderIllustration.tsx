import { cn } from "@/lib/utils"
import { IllustrationShell, type IllustrationShellProps } from "./IllustrationShell"

const stroke = "hsl(var(--border))"
const muted = "hsl(var(--muted))"
const card = "hsl(var(--card))"
const primary = "hsl(var(--primary))"

type Props = Pick<IllustrationShellProps, "className" | "decorative" | "aria-label">

export function DashboardHeaderIllustration({
  className,
  decorative = true,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <IllustrationShell
      decorative={decorative}
      aria-label={ariaLabel}
      className={cn("max-w-[220px] sm:max-w-[260px]", className)}
    >
      <svg
        viewBox="0 0 320 112"
        className="w-full h-auto block max-h-[100px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        focusable={false}
      >
        {/* Card 1 — KPI style */}
        <rect
          x="12"
          y="24"
          width="92"
          height="72"
          rx="10"
          fill={card}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <rect x="24" y="38" width="36" height="8" rx="3" fill={muted} />
        <rect x="24" y="54" width="52" height="10" rx="3" fill={muted} opacity={0.7} />
        <rect x="24" y="74" width="24" height="6" rx="2" fill={primary} opacity={0.35} />
        {/* Card 2 — bars */}
        <rect
          x="114"
          y="30"
          width="100"
          height="66"
          rx="10"
          fill={muted}
          stroke={stroke}
          strokeWidth={1.5}
          opacity={0.9}
        />
        <rect x="128" y="72" width="10" height="16" rx="2" fill={muted} stroke={stroke} strokeWidth={1} />
        <rect x="146" y="62" width="10" height="26" rx="2" fill={primary} opacity={0.45} />
        <rect x="164" y="68" width="10" height="20" rx="2" fill={muted} stroke={stroke} strokeWidth={1} />
        <rect x="182" y="56" width="10" height="32" rx="2" fill={muted} stroke={stroke} strokeWidth={1} />
        <line
          x1="126"
          y1="52"
          x2="198"
          y2="52"
          stroke={stroke}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        {/* Card 3 — list */}
        <rect
          x="224"
          y="26"
          width="84"
          height="70"
          rx="10"
          fill={card}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <rect x="236" y="40" width="44" height="6" rx="2" fill={muted} />
        <line
          x1="236"
          y1="56"
          x2="292"
          y2="56"
          stroke={stroke}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <line
          x1="236"
          y1="68"
          x2="284"
          y2="68"
          stroke={stroke}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <line
          x1="236"
          y1="80"
          x2="276"
          y2="80"
          stroke={stroke}
          strokeWidth={1.2}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        {/* Single primary accent line */}
        <rect x="236" y="88" width="28" height="4" rx="2" fill={primary} opacity={0.55} />
      </svg>
    </IllustrationShell>
  )
}
