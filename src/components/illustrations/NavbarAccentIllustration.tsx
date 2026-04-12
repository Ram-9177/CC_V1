import { cn } from "@/lib/utils"
import { IllustrationShell, type IllustrationShellProps } from "./IllustrationShell"

const stroke = "hsl(var(--border))"
const muted = "hsl(var(--muted))"
const card = "hsl(var(--card))"
const primary = "hsl(var(--primary))"

type Props = Pick<IllustrationShellProps, "className" | "decorative" | "aria-label">

/** Shallow accent for the sticky app header (xl+); stays under ~36px tall. */
export function NavbarAccentIllustration({
  className,
  decorative = true,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <IllustrationShell
      decorative={decorative}
      aria-label={ariaLabel}
      className={cn("max-w-[160px]", className)}
    >
      <svg
        viewBox="0 0 200 36"
        className="w-full h-9 block"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        focusable={false}
      >
        <rect
          x="4"
          y="6"
          width="56"
          height="24"
          rx="6"
          fill={card}
          stroke={stroke}
          strokeWidth={1.2}
        />
        <rect x="12" y="12" width="22" height="4" rx="2" fill={muted} />
        <rect x="12" y="20" width="32" height="3" rx="1.5" fill={muted} opacity={0.75} />
        <rect
          x="68"
          y="5"
          width="62"
          height="26"
          rx="6"
          fill={muted}
          stroke={stroke}
          strokeWidth={1.2}
          opacity={0.92}
        />
        <line
          x1="76"
          y1="13"
          x2="120"
          y2="13"
          stroke={stroke}
          strokeWidth={1}
          strokeLinecap="round"
        />
        <rect x="78" y="22" width="6" height="8" rx="1.5" fill={muted} stroke={stroke} strokeWidth={0.9} />
        <rect x="88" y="18" width="6" height="12" rx="1.5" fill={primary} opacity={0.4} />
        <rect x="98" y="20" width="6" height="10" rx="1.5" fill={muted} stroke={stroke} strokeWidth={0.9} />
        <rect
          x="138"
          y="7"
          width="58"
          height="22"
          rx="6"
          fill={card}
          stroke={stroke}
          strokeWidth={1.2}
        />
        <line
          x1="146"
          y1="14"
          x2="186"
          y2="14"
          stroke={stroke}
          strokeWidth={1}
          strokeLinecap="round"
        />
        <line
          x1="146"
          y1="20"
          x2="174"
          y2="20"
          stroke={stroke}
          strokeWidth={1}
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
        <rect x="146" y="24" width="20" height="3" rx="1.5" fill={primary} opacity={0.45} />
      </svg>
    </IllustrationShell>
  )
}
