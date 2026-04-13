import { cn } from "@/lib/utils"
import { IllustrationShell, type IllustrationShellProps } from "./IllustrationShell"

const outline = "hsl(var(--foreground) / 0.14)"
const ink = "hsl(var(--foreground) / 0.82)"
const card = "hsl(var(--card))"
const accentSurface = "hsl(var(--accent))"
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
        <rect x="4" y="6" width="56" height="24" rx="8" fill={card} stroke={outline} strokeWidth={1.2} />
        <rect x="12" y="12" width="22" height="4" rx="2" fill={accentSurface} />
        <line x1="12" y1="22" x2="40" y2="22" stroke={ink} strokeOpacity={0.18} strokeWidth={1.8} strokeLinecap="round" />

        <rect x="68" y="5" width="62" height="26" rx="8" fill={card} stroke={outline} strokeWidth={1.2} />
        <circle cx="84" cy="18" r="7" fill={primary} />
        <circle cx="81.5" cy="18" r="1.6" fill="hsl(var(--primary-foreground))" />
        <circle cx="84" cy="18" r="1.6" fill="hsl(var(--primary-foreground))" />
        <circle cx="86.5" cy="18" r="1.6" fill="hsl(var(--primary-foreground))" />
        <line x1="96" y1="14" x2="120" y2="14" stroke={ink} strokeOpacity={0.18} strokeWidth={1.8} strokeLinecap="round" />
        <line x1="96" y1="22" x2="114" y2="22" stroke={ink} strokeOpacity={0.12} strokeWidth={1.8} strokeLinecap="round" />

        <rect x="138" y="7" width="58" height="22" rx="8" fill={card} stroke={outline} strokeWidth={1.2} />
        <circle cx="178" cy="18" r="7" fill={primary} />
        <path d="M174 18L177 21L183 15" stroke="hsl(var(--primary-foreground))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <line x1="146" y1="14" x2="166" y2="14" stroke={ink} strokeOpacity={0.18} strokeWidth={1.8} strokeLinecap="round" />
        <line x1="146" y1="22" x2="160" y2="22" stroke={ink} strokeOpacity={0.12} strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    </IllustrationShell>
  )
}
