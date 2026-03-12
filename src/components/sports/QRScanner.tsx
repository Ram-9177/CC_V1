import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Camera } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

interface QRScannerProps {
  onSuccess?: (data: { id: number; student_details?: { name: string; registration_number: string } }) => void;
  onClose: () => void;
}

export function QRScanner({ onSuccess, onClose }: QRScannerProps) {
  const [scanning, setScanning] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; data?: { id: number; student_details?: { name: string; registration_number: string } } } | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    async function onScanSuccess(decodedText: string) {
      if (verifying) return;
      
      setVerifying(true);
      setScanning(false);
      
      try {
        const qrData = JSON.parse(decodedText);
        const response = await api.post('/events/registrations/verify_booking/', {
          qr_ref: qrData.ref
        });
        
        setResult({
          success: true,
          message: 'Check-in Successful!',
          data: response.data
        });
        
        if (onSuccess) onSuccess(response.data);
        toast.success('Student verified successfully');
        
        if (scannerRef.current) {
          scannerRef.current.clear();
        }
      } catch (error) {
        setResult({
          success: false,
          message: getApiErrorMessage(error, 'Invalid QR Code or Verification failed')
        });
        toast.error('Verification failed');
      } finally {
        setVerifying(false);
      }
    }

    function onScanFailure() {
      // silencly handle scan failures (usually means no QR in frame)
    }

    scannerRef.current.render(onScanSuccess, onScanFailure);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, []);

  const resetScanner = () => {
    setResult(null);
    setScanning(true);
    window.location.reload(); // Simplest way to restart html5-qrcode once cleared
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="w-full max-w-[400px] overflow-hidden rounded-3xl bg-black relative">
        {scanning && (
          <div id="reader" className="w-full"></div>
        )}
        
        {verifying && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-4 z-50">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="font-black uppercase tracking-widest text-sm">Verifying...</p>
          </div>
        )}

        {result && (
          <div className={`p-8 flex flex-col items-center text-center gap-4 ${result.success ? 'bg-emerald-50' : 'bg-rose-50'}`}>
            {result.success ? (
              <CheckCircle2 className="h-20 w-20 text-emerald-500" />
            ) : (
              <XCircle className="h-20 w-20 text-rose-500" />
            )}
            <div className="space-y-1">
              <h3 className={`text-2xl font-black ${result.success ? 'text-emerald-900' : 'text-rose-900'}`}>
                {result.success ? 'Verified' : 'Failed'}
              </h3>
              <p className="font-medium text-gray-600">{result.message}</p>
            </div>
            
            {result.data && (
              <div className="mt-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm w-full text-left space-y-2">
                <p className="text-[10px] font-black uppercase text-gray-400">Student Details</p>
                <p className="font-bold text-gray-900">{result.data.student_details?.name}</p>
                <p className="text-xs font-medium text-gray-500">{result.data.student_details?.registration_number}</p>
              </div>
            )}

            <Button onClick={resetScanner} className="mt-4 w-full rounded-2xl font-bold bg-gray-900 text-white">
              Scan Next
            </Button>
          </div>
        )}
      </div>

      {!result && !verifying && (
        <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary font-black text-[10px] uppercase tracking-widest">
                <Camera className="h-3 w-3" />
                Live Camera Active
            </div>
            <p className="text-xs font-medium text-muted-foreground">Align the QR code within the frame</p>
        </div>
      )}

      <Button variant="ghost" onClick={onClose} className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">
        Close Scanner
      </Button>
    </div>
  );
}
