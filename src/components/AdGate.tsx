import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Progress } from './ui/progress';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { t } from '../lib/i18n';

interface AdGateProps {
  open: boolean;
  onComplete: () => void;
  gatePassId: string;
}

export function AdGate({ open, onComplete, gatePassId }: AdGateProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'loading' | 'playing' | 'complete'>('loading');

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setStatus('loading');
      return;
    }

    setStatus('playing');
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setStatus('complete');
          setTimeout(() => onComplete(), 1000);
          return 100;
        }
        return prev + 5; // 20 seconds = 100% / 5% = 20 ticks at 1s each
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, onComplete]);

  const secondsRemaining = Math.ceil((100 - progress) / 5);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-2xl"
        onPointerDownOutside={() => {}}
        onEscapeKeyDown={() => {}}
      >
        <DialogHeader>
          <DialogTitle className="text-center">
            {status === 'complete' 
              ? `QR ${t('approved')}` 
              : 'Ad Loading - Required for QR Unlock'
            }
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {status === 'complete' ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <p className="text-center text-muted-foreground">
                Your QR code is ready!
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-4">
                <div className="w-full rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center min-h-[220px] md:min-h-[320px]">
                  <div className="text-center p-6">
                    <AlertCircle className="h-16 w-16 mx-auto mb-4 text-purple-600" />
                    <p className="font-medium text-lg">Sponsored Ad</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Please wait {secondsRemaining} seconds
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-900">
                  <AlertCircle className="inline h-3 w-3 mr-1" />
                  This ad is mandatory and cannot be skipped. Your QR code will unlock automatically.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
