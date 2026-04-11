import { cn } from "@/lib/utils"
import { IllustrationShell, type IllustrationShellProps } from "./IllustrationShell"

const stroke = "hsl(var(--border))"
const muted = "hsl(var(--muted))"
const card = "hsl(var(--card))"
const destructive = "hsl(var(--destructive))"
const destructiveFg = "hsl(var(--destructive-foreground))"

type Props = Pick<IllustrationShellProps, "className" | "decorative" | "aria-label">

export function ErrorStateIllustration({
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
        {/* Tilted / disconnected document */}
        <g transform="translate(148 52) rotate(-8)">
          <rect
            x="0"
            y="0"
            width="120"
            height="130"
            rx="11"
            fill={card}
            stroke={stroke}
            strokeWidth={1.5}
          />
          <line
            x1="18"
            y1="28"
            x2="92"
            y2="28"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <line
            x1="18"
            y1="46"
            x2="100"
            y2="46"
            stroke={stroke}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
          <line
            x1="18"
            y1="64"
            x2="78"
            y2="64"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </g>
        {/* Gap / disconnect */}
        <path
          d="M 200 150 L 228 178"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="5 6"
        />
        <path
          d="M 228 150 L 200 178"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="5 6"
        />
        {/* Alert — destructive accent only here */}
        <path
          d="M 218 24 L 258 96 L 178 96 Z"
          fill={destructive}
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <line
          x1="218"
          y1="48"
          x2="218"
          y2="72"
          stroke={destructiveFg}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx="218" cy="84" r="2.5" fill={destructiveFg} />
        {/* Neutral panel */}
        <rect
          x="32"
          y="72"
          width="88"
          height="100"
          rx="11"
          fill={muted}
          stroke={stroke}
          strokeWidth={1.5}
          opacity={0.85}
        />
        <line
          x1="46"
          y1="94"
          x2="102"
          y2="94"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line
          x1="46"
          y1="112"
          x2="94"
          y2="112"
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
      </svg>
    </IllustrationShell>
  )
}
