import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        onScan(decodedText);
        // Clear scanner after successful scan to allow re-scans if needed by parent
        scannerRef.current?.clear();
      },
      (errorMessage) => {
        if (onError) onError(errorMessage);
      }
    );

    return () => {
      scannerRef.current?.clear().catch(err => console.error("Failed to clear scanner", err));
    };
  }, [onScan, onError]);

  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden rounded-lg border-2 border-primary/20 bg-black/5 p-4">
      <div id="qr-reader" className="w-full" />
      <p className="text-[10px] font-black text-center text-muted-foreground uppercase tracking-widest mt-4">
        Center QR code within frame
      </p>
    </div>
  );
}
