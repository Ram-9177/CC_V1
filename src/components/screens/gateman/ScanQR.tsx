import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { HallticketChip } from '../../HallticketChip';
import { Camera, CheckCircle2, XCircle, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

export function ScanQR() {
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<any>(null);

  const handleStartScan = () => {
    setScanning(true);
    
    // Simulate QR scan after 2 seconds
    setTimeout(() => {
      const mockScanResult = {
        hallticket: 'HT001',
        name: 'Ravi Kumar',
        gatePassId: 'GP12345',
        action: 'EXIT',
        destination: 'Hyderabad',
        validUntil: '2025-10-31T20:00:00Z',
        isValid: true,
      };
      
      setLastScanned(mockScanResult);
      setScanning(false);
      toast.success('QR Code scanned successfully');
    }, 2000);
  };

  const handleVerify = () => {
    toast.success('Student verified and recorded');
    setLastScanned(null);
  };

  const handleReject = () => {
    toast.error('Entry/Exit denied');
    setLastScanned(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Scan QR Code</h1>
        <p className="text-muted-foreground">Verify student gate passes</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>QR Scanner</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center mb-4 relative overflow-hidden">
              {scanning ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/50">
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-green-500 animate-pulse" />
                  </div>
                  <ScanLine className="h-16 w-16 text-green-400 animate-pulse" />
                </div>
              ) : (
                <div className="text-center">
                  <Camera className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Ready to scan</p>
                </div>
              )}
            </div>

            <Button
              onClick={handleStartScan}
              disabled={scanning}
              className="w-full"
              size="lg"
            >
              {scanning ? (
                <>
                  <ScanLine className="h-5 w-5 animate-pulse" />
                  Scanning...
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5" />
                  Start Scanning
                </>
              )}
            </Button>

            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm">
                <strong>Instructions:</strong>
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Ask student to show their QR code</li>
                <li>• Position QR code within the scanner frame</li>
                <li>• Wait for automatic verification</li>
                <li>• Confirm or reject the entry/exit</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scan Result</CardTitle>
          </CardHeader>
          <CardContent>
            {!lastScanned ? (
              <div className="text-center py-12 text-muted-foreground">
                <ScanLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No QR code scanned yet</p>
                <p className="text-sm mt-2">Scan a student's QR code to verify</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border-2 ${lastScanned.isValid ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {lastScanned.isValid ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <span className="font-medium text-green-700 dark:text-green-300">Valid QR Code</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        <span className="font-medium text-red-700 dark:text-red-300">Invalid QR Code</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Student</p>
                    <HallticketChip 
                      hallticket={lastScanned.hallticket}
                      name={lastScanned.name}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Action</p>
                      <Badge variant={lastScanned.action === 'EXIT' ? 'destructive' : 'default'}>
                        {lastScanned.action}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pass ID</p>
                      <p className="font-medium">{lastScanned.gatePassId}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Destination</p>
                    <p className="font-medium">{lastScanned.destination}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Valid Until</p>
                    <p className="font-medium">
                      {new Date(lastScanned.validUntil).toLocaleString()}
                    </p>
                  </div>
                </div>

                {lastScanned.isValid && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleVerify}
                      className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Verify & Record
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Scans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { hallticket: 'HT045', name: 'Anita Sharma', action: 'ENTRY', time: '10:25 AM' },
              { hallticket: 'HT023', name: 'Suresh Reddy', action: 'EXIT', time: '10:15 AM' },
              { hallticket: 'HT078', name: 'Priya Singh', action: 'ENTRY', time: '10:10 AM' },
            ].map((scan, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="font-medium">{scan.hallticket}</div>
                  <span className="text-muted-foreground">•</span>
                  <span>{scan.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={scan.action === 'EXIT' ? 'destructive' : 'default'}>
                    {scan.action}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{scan.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
