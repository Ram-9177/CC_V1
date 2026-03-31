/**
 * CampusScanner — universal QR + Manual-fallback scanner.
 *
 * Usage:
 *   <CampusScanner
 *     title="Sports Check-In"
 *     actionLabel="Check In"
 *     onQRToken={async (token) => { const r = await api.post(...); return { success: true, message: r.data.detail } }}
 *     onSearch={async (q) => { const r = await api.get('/sports/bookings/student-search/', { params: { q } }); return r.data }}
 *     onManualAction={async (item) => { const r = await api.post(..., { student_id: item.id, scan_method: 'manual' }); return { success: true, message: r.data.detail } }}
 *     onClose={() => setOpen(false)}
 *   />
 */
import { useEffect, useRef, useState } from 'react';
import type { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Camera,
  Search,
  User,
  QrCode,
  PenLine,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StudentItem {
  /** student PK — passed to onManualAction */
  id: number;
  name: string;
  /** e.g. registration number or hall ticket */
  sub?: string;
  /** context detail e.g. "Football · Court A · 09:00 AM" */
  detail?: string;
  /** arbitrary extra data (opaque, passed straight back to onManualAction) */
  meta?: Record<string, unknown>;
}

export interface ScanResult {
  success: boolean;
  message: string;
}

interface CampusScannerProps {
  title?: string;
  /** Label for the action button in manual mode, e.g. "Check In", "Allow Exit" */
  actionLabel?: string;
  /** Called when a QR code has been decoded. The raw decoded text is passed. */
  onQRToken: (decodedText: string) => Promise<ScanResult>;
  /** Debounced student search — return array of StudentItem */
  onSearch: (query: string) => Promise<StudentItem[]>;
  /** Called when staff confirms manual action on a student */
  onManualAction: (item: StudentItem) => Promise<ScanResult>;
  /** Placeholder for the manual search field */
  searchPlaceholder?: string;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CampusScanner({
  title = 'Campus Scanner',
  actionLabel = 'Confirm',
  onQRToken,
  onSearch,
  onManualAction,
  searchPlaceholder = 'Search by name, ID, roll no…',
  onClose,
}: CampusScannerProps) {
  const [mode, setMode] = useState<'qr' | 'manual'>('qr');

  return (
    <div className="flex flex-col gap-0">
      {/* Mode toggle */}
      <div className="flex border-b border-gray-100">
        <ModeTab active={mode === 'qr'} onClick={() => setMode('qr')} icon={<QrCode className="h-3.5 w-3.5" />} label="QR Scan" />
        <ModeTab active={mode === 'manual'} onClick={() => setMode('manual')} icon={<PenLine className="h-3.5 w-3.5" />} label="Manual Entry" />
      </div>

      {mode === 'qr' ? (
        <QRPane title={title} onQRToken={onQRToken} onClose={onClose} />
      ) : (
        <ManualPane
          actionLabel={actionLabel}
          onSearch={onSearch}
          onManualAction={onManualAction}
          searchPlaceholder={searchPlaceholder}
          onClose={onClose}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest transition-all ${
        active
          ? 'text-primary border-b-2 border-primary -mb-px bg-primary/5'
          : 'text-muted-foreground hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── QR pane (camera scanner) ──────────────────────────────────────────────────

function QRPane({
  title,
  onQRToken,
  onClose,
}: {
  title: string;
  onQRToken: (text: string) => Promise<ScanResult>;
  onClose: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [studentInfo, setStudentInfo] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const verifyingRef = useRef(false);

  useEffect(() => {
    const readerId = `campus-qr-reader-${sessionKey}`;
    let isMounted = true;

    async function initScanner() {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode');
        if (!isMounted) return;

        scannerRef.current = new Html5QrcodeScanner(
          readerId,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false,
        );

        const onSuccess = async (decodedText: string) => {
          if (verifyingRef.current) return;
          verifyingRef.current = true;
          setVerifying(true);

          if (scannerRef.current) {
            try { await scannerRef.current.clear(); } catch { /* ignore */ }
            scannerRef.current = null;
          }

          try {
            const res = await onQRToken(decodedText);
            if (!isMounted) return;
            setResult(res);
            try {
              const parsed = JSON.parse(decodedText);
              if (parsed.name) setStudentInfo(parsed.name);
            } catch { /* raw token */ }
          } catch {
            if (isMounted) setResult({ success: false, message: 'Verification failed.' });
          } finally {
            if (isMounted) {
              verifyingRef.current = false;
              setVerifying(false);
            }
          }
        };

        scannerRef.current.render(onSuccess, () => {});
      } catch (err) {
        console.error('Failed to load scanner:', err);
      }
    }

    initScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [onQRToken, sessionKey]);

  const reset = () => {
    setResult(null);
    setStudentInfo(null);
    verifyingRef.current = false;
    setSessionKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="w-full max-w-[400px] overflow-hidden rounded bg-black relative min-h-[200px]">
        {!result && !verifying && <div id={`campus-qr-reader-${sessionKey}`} className="w-full" />}

        {verifying && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-4 z-50">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="font-black uppercase tracking-widest text-sm">Verifying…</p>
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
                {result.success ? 'Verified ✓' : 'Failed'}
              </h3>
              <p className="font-medium text-gray-600 text-sm">{result.message}</p>
              {studentInfo && <p className="text-xs font-bold text-gray-500">{studentInfo}</p>}
            </div>
            <Button onClick={reset} className="mt-2 w-full rounded-sm font-bold bg-gray-900 text-white">
              Scan Next
            </Button>
          </div>
        )}
      </div>

      {!result && !verifying && (
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-sm text-primary font-black text-[10px] uppercase tracking-widest">
            <Camera className="h-3 w-3" />
            Live Camera — {title}
          </div>
          <p className="text-xs font-medium text-muted-foreground">Align the QR code within the frame</p>
        </div>
      )}

      <Button variant="ghost" onClick={onClose} className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">
        Close
      </Button>
    </div>
  );
}

// ── Manual entry pane ─────────────────────────────────────────────────────────

function ManualPane({
  actionLabel,
  onSearch,
  onManualAction,
  searchPlaceholder,
  onClose,
}: {
  actionLabel: string;
  onSearch: (q: string) => Promise<StudentItem[]>;
  onManualAction: (item: StudentItem) => Promise<ScanResult>;
  searchPlaceholder: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentItem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<ScanResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQuery = (val: string) => {
    setQuery(val);
    setSelected(null);
    setOutcome(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await onSearch(val.trim());
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const handleConfirm = async (item: StudentItem) => {
    setConfirming(true);
    try {
      const res = await onManualAction(item);
      setOutcome(res);
      setSelected(null);
      setResults([]);
      setQuery('');
    } finally {
      setConfirming(false);
    }
  };

  const reset = () => {
    setOutcome(null);
    setQuery('');
    setResults([]);
    setSelected(null);
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      {outcome ? (
        <div className={`flex flex-col items-center gap-4 p-8 rounded ${outcome.success ? 'bg-emerald-50' : 'bg-rose-50'}`}>
          {outcome.success ? (
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
          ) : (
            <XCircle className="h-16 w-16 text-rose-500" />
          )}
          <div className="text-center space-y-1">
            <h3 className={`text-2xl font-black ${outcome.success ? 'text-emerald-900' : 'text-rose-900'}`}>
              {outcome.success ? 'Done ✓' : 'Failed'}
            </h3>
            <p className="text-sm font-medium text-gray-600">{outcome.message}</p>
          </div>
          <Button onClick={reset} className="w-full rounded-sm font-bold bg-gray-900 text-white mt-2">
            Search Another
          </Button>
        </div>
      ) : (
        <>
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-11 h-12 rounded-sm border-0 bg-gray-50 font-medium"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => handleQuery(e.target.value)}
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Confirm dialog for selected student */}
          {selected && (
            <div className="border border-primary/20 bg-primary/5 rounded-sm p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-sm bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-black text-gray-900">{selected.name}</p>
                  {selected.sub && <p className="text-xs font-medium text-muted-foreground">{selected.sub}</p>}
                  {selected.detail && <p className="text-xs font-bold text-primary/80">{selected.detail}</p>}
                </div>
              </div>
              <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] font-black uppercase">
                Manual Entry
              </Badge>
              <div className="flex gap-3">
                <Button
                  className="flex-1 rounded-sm font-black"
                  onClick={() => handleConfirm(selected)}
                  disabled={confirming}
                >
                  {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : actionLabel}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 rounded-sm font-bold text-gray-500"
                  onClick={() => setSelected(null)}
                  disabled={confirming}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Results list */}
          {!selected && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {results.length} result{results.length > 1 ? 's' : ''} found
              </p>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {results.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className="w-full text-left flex items-center gap-3 p-4 rounded-sm bg-white border border-gray-100 shadow-sm hover:border-primary/30 hover:shadow-md transition-all"
                  >
                    <div className="h-9 w-9 rounded-sm bg-gray-100 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-gray-900 text-sm truncate">{item.name}</p>
                      {item.sub && <p className="text-[10px] font-medium text-muted-foreground truncate">{item.sub}</p>}
                      {item.detail && <p className="text-[10px] font-bold text-primary/80 truncate">{item.detail}</p>}
                    </div>
                    <div className="ml-auto shrink-0 text-[10px] font-black text-primary">Select →</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!selected && query.length >= 2 && !searching && results.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground font-medium">
              No results found for "{query}"
            </div>
          )}
        </>
      )}

      <Button variant="ghost" onClick={onClose} className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">
        Close
      </Button>
    </div>
  );
}
