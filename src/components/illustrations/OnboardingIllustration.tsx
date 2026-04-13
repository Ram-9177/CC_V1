import { cn } from "@/lib/utils"
import { IllustrationShell, type IllustrationShellProps } from "./IllustrationShell"

const outline = "hsl(var(--foreground) / 0.14)"
const ink = "hsl(var(--foreground) / 0.82)"
const card = "hsl(var(--card))"
const accentSurface = "hsl(var(--accent))"
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
        <path
          d="M52 126C88 126 98 84 136 84H184C222 84 232 126 268 126"
          stroke={ink}
          strokeOpacity={0.18}
          strokeWidth={2}
          strokeDasharray="5 6"
          strokeLinecap="round"
          fill="none"
        />

        <rect x="16" y="68" width="76" height="86" rx="18" fill={card} stroke={outline} strokeWidth={1.4} />
        <circle cx="42" cy="92" r="15" fill={primary} />
        <text
          x="42"
          y="97"
          textAnchor="middle"
          fill={primaryFg}
          fontSize="13"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          1
        </text>
        <rect x="58" y="84" width="20" height="16" rx="5" fill={accentSurface} />
        <line x1="30" y1="118" x2="74" y2="118" stroke={ink} strokeOpacity={0.2} strokeWidth={2} strokeLinecap="round" />
        <line x1="30" y1="132" x2="66" y2="132" stroke={ink} strokeOpacity={0.14} strokeWidth={2} strokeLinecap="round" />

        <rect x="122" y="40" width="76" height="96" rx="18" fill={card} stroke={outline} strokeWidth={1.4} />
        <circle cx="148" cy="66" r="15" fill={primary} />
        <text
          x="148"
          y="71"
          textAnchor="middle"
          fill={primaryFg}
          fontSize="13"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          2
        </text>
        <path d="M142 84H169L180 95V112C180 118.627 174.627 124 168 124H142C135.373 124 130 118.627 130 112V96C130 89.373 135.373 84 142 84Z" fill={card} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
        <path d="M169 84V92C169 96.418 172.582 100 177 100H180" stroke={ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        <rect x="228" y="68" width="76" height="86" rx="18" fill={card} stroke={outline} strokeWidth={1.4} />
        <circle cx="254" cy="92" r="15" fill={primary} />
        <text
          x="254"
          y="97"
          textAnchor="middle"
          fill={primaryFg}
          fontSize="13"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          3
        </text>
        <circle cx="266" cy="118" r="16" fill={primary} />
        <path d="M258 118L264 124L274 112" stroke={primaryFg} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
        <line x1="242" y1="142" x2="286" y2="142" stroke={ink} strokeOpacity={0.16} strokeWidth={2} strokeLinecap="round" />
      </svg>
    </IllustrationShell>
  )
}
