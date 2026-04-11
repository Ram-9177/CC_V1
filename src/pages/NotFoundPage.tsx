import { Link } from "react-router-dom"
import { useAuthStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { ErrorStateIllustration } from "@/components/illustrations"

export default function NotFoundPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card/90 dark:bg-card/80 px-6 pt-8 pb-8 shadow-sm text-center">
        <ErrorStateIllustration
          className="mb-5 mx-auto"
          decorative={false}
          aria-label="Connection or page error"
        />
        <h1 className="text-xl font-semibold text-foreground tracking-tight sm:text-2xl">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground mt-2 mb-8 leading-relaxed">
          The link may be broken or the page was removed. Check the URL or return to your workspace.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button asChild className="rounded-xl">
            <Link to={isAuthenticated ? "/dashboard" : "/login"}>
              {isAuthenticated ? "Go to dashboard" : "Sign in"}
            </Link>
          </Button>
          <Button variant="outline" asChild className="rounded-xl border-border/80">
            <Link to="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
