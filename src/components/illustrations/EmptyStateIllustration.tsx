import { cn } from "@/lib/utils"
import { IllustrationShell, type IllustrationShellProps } from "./IllustrationShell"

const outline = "hsl(var(--foreground) / 0.14)"
const ink = "hsl(var(--foreground) / 0.82)"
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


        <path
          d="M154 54H205L226 76V153C226 160.732 219.732 167 212 167H154C146.268 167 140 160.732 140 153V68C140 60.268 146.268 54 154 54Z"
          fill={card}
          stroke={ink}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <path
          d="M205 54V70C205 77.732 211.268 84 219 84H226"
          stroke={ink}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="158" y="92" width="38" height="9" rx="4.5" fill={primary} opacity={0.18} />
        <line x1="158" y1="112" x2="204" y2="112" stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
        <line x1="158" y1="126" x2="196" y2="126" stroke={ink} strokeOpacity={0.56} strokeWidth={2.2} strokeLinecap="round" />
        <line x1="158" y1="140" x2="188" y2="140" stroke={ink} strokeOpacity={0.36} strokeWidth={2.2} strokeLinecap="round" />

        <path
          d="M96 95C96 82.297 106.297 72 119 72H128C140.703 72 151 82.297 151 95C151 106.053 143.202 115.283 132.8 117.49L126 130L121.8 118H119C106.297 118 96 107.703 96 95Z"
          fill={primary}
        />
        <circle cx="114" cy="95" r="4" fill="hsl(var(--primary-foreground))" />
        <circle cx="124" cy="95" r="4" fill="hsl(var(--primary-foreground))" />
        <circle cx="134" cy="95" r="4" fill="hsl(var(--primary-foreground))" />

        <line x1="56" y1="168" x2="242" y2="168" stroke={ink} strokeOpacity={0.24} strokeWidth={2.2} strokeLinecap="round" />
        <circle cx="46" cy="114" r="3.5" fill={card} stroke={primary} strokeWidth={1.5} opacity={0.85} />
        <circle cx="246" cy="128" r="3" fill={card} stroke={primary} strokeWidth={1.5} opacity={0.85} />
        <path d="M90 148L86 154" stroke={primary} strokeWidth={1.8} strokeLinecap="round" />
        <path d="M250 104L254 98" stroke={primary} strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    </IllustrationShell>
  )
}
