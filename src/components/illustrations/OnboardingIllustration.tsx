import { cn } from "@/lib/utils"
import { IllustrationShell, type IllustrationShellProps } from "./IllustrationShell"

const stroke = "hsl(var(--border))"
const muted = "hsl(var(--muted))"
const card = "hsl(var(--card))"
const primary = "hsl(var(--primary))"
const primaryFg = "hsl(var(--primary-foreground))"

type Props = Pick<IllustrationShellProps, "className" | "decorative" | "aria-label">

export function OnboardingIllustration({
  className,
  decorative = true,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <IllustrationShell
      decorative={decorative}
      aria-label={ariaLabel}
      className={cn("max-w-[300px] mx-auto", className)}
    >
      <svg
        viewBox="0 0 320 200"
        className="w-full h-auto block"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        focusable={false}
      >
        {/* Connector path */}
        <path
          d="M 52 118 C 100 118, 120 78, 160 78 C 200 78, 220 118, 268 118"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          fill="none"
        />
        {/* Step 1 */}
        <rect
          x="16"
          y="64"
          width="72"
          height="88"
          rx="12"
          fill={card}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <circle cx="40" cy="88" r="14" fill={primary} stroke={stroke} strokeWidth={1.5} />
        <text
          x="40"
          y="93"
          textAnchor="middle"
          fill={primaryFg}
          fontSize="14"
          fontWeight="600"
          fontFamily="system-ui, sans-serif"
        >
          1
        </text>
        <rect x="32" y="108" width="48" height="6" rx="2" fill={muted} />
        <line
          x1="28"
          y1="124"
          x2="72"
          y2="124"
          stroke={stroke}
          strokeWidth={1.2}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <line
          x1="28"
          y1="136"
          x2="64"
          y2="136"
          stroke={stroke}
          strokeWidth={1.2}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        {/* Step 2 */}
        <rect
          x="124"
          y="40"
          width="72"
          height="88"
          rx="12"
          fill={card}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <circle cx="148" cy="64" r="14" fill={primary} stroke={stroke} strokeWidth={1.5} />
        <text
          x="148"
          y="69"
          textAnchor="middle"
          fill={primaryFg}
          fontSize="14"
          fontWeight="600"
          fontFamily="system-ui, sans-serif"
        >
          2
        </text>
        <rect x="140" y="84" width="48" height="6" rx="2" fill={muted} />
        <line
          x1="136"
          y1="100"
          x2="180"
          y2="100"
          stroke={stroke}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <line
          x1="136"
          y1="112"
          x2="172"
          y2="112"
          stroke={stroke}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        {/* Step 3 */}
        <rect
          x="232"
          y="64"
          width="72"
          height="88"
          rx="12"
          fill={card}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <circle cx="256" cy="88" r="14" fill={primary} stroke={stroke} strokeWidth={1.5} />
        <text
          x="256"
          y="93"
          textAnchor="middle"
          fill={primaryFg}
          fontSize="14"
          fontWeight="600"
          fontFamily="system-ui, sans-serif"
        >
          3
        </text>
        <rect x="248" y="108" width="48" height="6" rx="2" fill={muted} />
        <line
          x1="244"
          y1="124"
          x2="288"
          y2="124"
          stroke={stroke}
          strokeWidth={1.2}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <line
          x1="244"
          y1="136"
          x2="280"
          y2="136"
          stroke={stroke}
          strokeWidth={1.2}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        {/* Small figure on path */}
        <circle cx="160" cy="118" r="10" fill={muted} stroke={stroke} strokeWidth={1.5} />
        <rect
          x="152"
          y="128"
          width="16"
          height="22"
          rx="5"
          fill={muted}
          stroke={stroke}
          strokeWidth={1.5}
        />
      </svg>
    </IllustrationShell>
  )
}
