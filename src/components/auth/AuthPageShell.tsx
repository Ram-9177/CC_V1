import type { ReactNode } from 'react'

/** Shared full-screen wrapper + atmosphere for login → register → password flows (theme tokens only). */
export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-6 dark:bg-background"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -left-1/4 top-[-15%] h-[min(480px,70vw)] w-[min(480px,70vw)] animate-illus-drift rounded-full bg-primary/15 blur-3xl dark:bg-primary/10" />
        <div className="absolute -right-1/4 bottom-[-20%] h-[min(440px,65vw)] w-[min(440px,65vw)] animate-illus-drift-slow rounded-full bg-[hsl(var(--pastel-lilac)_/_0.55)] blur-3xl dark:opacity-50" />
        <div className="absolute left-1/2 top-1/2 h-[min(360px,50vw)] w-[min(360px,50vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--pastel-mint)_/_0.35)] blur-3xl dark:opacity-40" />
      </div>
      {children}
    </main>
  )
}

/** Primary auth card surface — matches login; use on all pre-auth screens. */
export const AUTH_CARD_CLASS =
  'relative z-0 w-full max-w-md rounded-2xl border border-primary/10 bg-card/95 shadow-xl shadow-primary/12 backdrop-blur-sm dark:border-border/70 dark:shadow-lg'

/** Wider registration layout */
export const AUTH_CARD_CLASS_WIDE =
  'relative z-0 w-full max-w-lg rounded-2xl border border-primary/10 bg-card/95 shadow-xl shadow-primary/12 backdrop-blur-sm dark:border-border/70 dark:shadow-lg'
