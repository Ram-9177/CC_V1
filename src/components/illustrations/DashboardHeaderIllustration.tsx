import { cn } from "@/lib/utils"
import { IllustrationShell, type IllustrationShellProps } from "./IllustrationShell"

const outline = "hsl(var(--foreground) / 0.14)"
const ink = "hsl(var(--foreground) / 0.82)"
const card = "hsl(var(--card))"
const accentSurface = "hsl(var(--accent))"
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
        <rect x="12" y="22" width="92" height="68" rx="18" fill={card} stroke={outline} strokeWidth={1.4} />
        <rect x="26" y="40" width="30" height="7" rx="3.5" fill={accentSurface} />
        <line x1="26" y1="56" x2="74" y2="56" stroke={ink} strokeOpacity={0.22} strokeWidth={2} strokeLinecap="round" />
        <circle cx="74" cy="66" r="14" fill={primary} />
        <circle cx="69" cy="66" r="2.4" fill="hsl(var(--primary-foreground))" />
        <circle cx="74" cy="66" r="2.4" fill="hsl(var(--primary-foreground))" />
        <circle cx="79" cy="66" r="2.4" fill="hsl(var(--primary-foreground))" />

        <rect x="114" y="16" width="94" height="74" rx="18" fill={card} stroke={outline} strokeWidth={1.4} />
        <path d="M136 34H166L180 48V74C180 80.627 174.627 86 168 86H136C129.373 86 124 80.627 124 74V46C124 39.373 129.373 34 136 34Z" fill={card} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
        <path d="M166 34V44C166 49.523 170.477 54 176 54H180" stroke={ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <line x1="140" y1="58" x2="165" y2="58" stroke={ink} strokeOpacity={0.44} strokeWidth={2} strokeLinecap="round" />
        <line x1="140" y1="68" x2="160" y2="68" stroke={ink} strokeOpacity={0.28} strokeWidth={2} strokeLinecap="round" />
        <circle cx="182" cy="64" r="14" fill={primary} />
        <path d="M175 64L180 69L190 58" stroke="hsl(var(--primary-foreground))" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />

        <rect x="220" y="24" width="88" height="64" rx="18" fill={card} stroke={outline} strokeWidth={1.4} />
        <rect x="234" y="38" width="40" height="7" rx="3.5" fill={accentSurface} />
        <line x1="234" y1="54" x2="286" y2="54" stroke={ink} strokeOpacity={0.22} strokeWidth={2} strokeLinecap="round" />
        <line x1="234" y1="66" x2="276" y2="66" stroke={ink} strokeOpacity={0.14} strokeWidth={2} strokeLinecap="round" />
        <rect x="270" y="60" width="18" height="14" rx="7" fill={primary} />
      </svg>
    </IllustrationShell>
  )
}
