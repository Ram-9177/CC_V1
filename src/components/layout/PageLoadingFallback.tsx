/**
 * PageLoadingFallback - Ultra-lightweight loading state
 * Shows minimal skeleton while page loads
 * Avoids heavy re-renders
 */

export function PageLoadingFallback() {
  return (
    <div className="animate-in fade-in duration-200 w-full">
      <style>{`
        @keyframes pulse-light {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.6; }
        }
        
        .pulse-light {
          animation: pulse-light 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          will-change: opacity;
        }
      `}</style>
      
      {/* Minimal skeleton - just a few lines */}
      <div className="space-y-4">
        <div className="h-8 bg-muted rounded pulse-light w-32" />
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded pulse-light" />
          <div className="h-4 bg-muted rounded pulse-light w-5/6" />
        </div>
      </div>
    </div>
  );
}
