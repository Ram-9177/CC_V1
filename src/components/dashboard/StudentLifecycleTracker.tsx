import { useActivePass } from '@/hooks/features/useGatePasses';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useWebSocketEvent } from '@/hooks/useWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import { HostellerOnly } from '@/hooks/useStudentType';
import { memo } from 'react';

const LIFECYCLE_STEPS = [
  { id: 'REQUESTED', label: 'REQUESTED' },
  { id: 'APPROVED', label: 'APPROVED' },
  { id: 'OUT_SCAN', label: 'OUT SCAN' },
  { id: 'RETURN_SCAN', label: 'RETURN SCAN' },
  { id: 'CLOSED', label: 'CLOSED' },
];

export const StudentLifecycleTracker = memo(function StudentLifecycleTracker() {
  const { data: pass } = useActivePass();
  const queryClient = useQueryClient();

  useWebSocketEvent('gatepass_updated', () => {
    queryClient.invalidateQueries({ queryKey: ['gate-passes', 'active'] });
  });

  const isRejected = pass?.status === 'rejected';
  let currentStepIndex = 0;
  if (pass) {
    switch (pass.status) {
      case 'approved': currentStepIndex = 1; break;
      case 'out': currentStepIndex = 2; break;
      case 'in': currentStepIndex = 3; break;
      case 'completed': currentStepIndex = 4; break;
      case 'pending':
      default: currentStepIndex = 0; break;
    }
  }

  return (
    <HostellerOnly>
      <Card className="bg-white border border-border rounded-sm md:rounded mb-4 shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-y-3 pb-2">
            {LIFECYCLE_STEPS.map((step, index) => {
              const isCompleted = currentStepIndex >= index;
              const isCurrent = currentStepIndex === index;
              const isLast = index === LIFECYCLE_STEPS.length - 1;

              let stepClasses = "border-slate-200 text-slate-500 bg-white";
              if (isRejected && isCurrent) {
                stepClasses = "border-destructive text-destructive bg-destructive/10";
              } else if (isCurrent) {
                stepClasses = "border-primary text-primary bg-primary/10 shadow-sm";
              } else if (isCompleted) {
                stepClasses = "border-primary/40 text-primary bg-primary/5";
              }

              return (
                <div key={step.id} className="flex items-center">
                  {/* Step Box */}
                  <div className={cn(
                    "px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold tracking-wider border rounded-sm transition-all duration-300 uppercase whitespace-nowrap",
                    stepClasses
                  )}>
                    {step.label}
                  </div>

                  {/* Line Connector */}
                  {!isLast && (
                    <div className={cn(
                      "w-3 sm:w-10 h-[2px] mx-1 sm:mx-2 transition-all duration-500 rounded-full",
                      currentStepIndex > index ? "bg-primary/40" : "bg-slate-200"
                    )} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-sm font-semibold text-slate-600">
            {!pass ? (
              "No pass created yet. Create the first pass to start complete lifecycle tracking."
            ) : isRejected ? (
              <span className="text-destructive font-bold">Pass was rejected. Please review and recreate.</span>
            ) : currentStepIndex === 0 ? (
              <span className="text-amber-600 font-bold">Pass is under review by Warden/Management.</span>
            ) : currentStepIndex === 1 ? (
              <span className="text-green-600 font-bold">Pass approved. Please show ID at the gate for Out Scan.</span>
            ) : currentStepIndex === 2 ? (
              <span className="text-blue-600 font-bold">You are checked out. Remember to scan back in upon return.</span>
            ) : currentStepIndex === 3 ? (
              <span className="text-primary font-bold">You have returned. Pass will be closed shortly.</span>
            ) : currentStepIndex === 4 ? (
              <span className="text-slate-600 font-bold">Lifecycle closed. You can create a new pass whenever needed.</span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </HostellerOnly>
  );
});
