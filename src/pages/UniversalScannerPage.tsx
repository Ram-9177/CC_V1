import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  ShieldCheck,
  ClipboardCheck,
  Utensils,
  Trophy,
  History
} from 'lucide-react';
import { api } from '@/lib/api';
import { CampusScanner, ScanResult, StudentItem } from '@/components/common/CampusScanner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';

/**
 * UniversalScannerPage — The single "One Scanner for All" entry point.
 * Depending on the logged-in user's role (Actor-Aware), it provides
 * contextual actions for scanned students.
 */
export default function UniversalScannerPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Helper: Get user-friendly role name
  const getRoleLabel = () => {
    switch (user?.role) {
      case 'warden': return 'Warden Mode';
      case 'chef': return 'Mess/Canteen Mode';
      case 'gate_security':
      case 'security_head': return 'Gate Security Mode';
      case 'admin': return 'Admin Super-Scanner';
      default: return 'Campus Scanner';
    }
  };

  // ─── Phase 1: Resolver Logic ───────────────────────────────────────────────

  const handleScan = async (token: string): Promise<ScanResult> => {
    try {
      const resolveRes = await api.post('/scan/', { token });
      const data = resolveRes.data;

      if (data.action_allowed) {
        const actionRes = await api.post('/scan/action/', { 
          token, 
          action: data.action_allowed 
        });
        
        // Contextual Success Message for Mobile
        const context = data.meal_type ? ` [${data.meal_type}]` : 
                        data.event_title ? ` [${data.event_title}]` : '';

        return { 
          success: true, 
          message: `${actionRes.data.message}${context}` || `Success: ${data.action_allowed}` 
        };
      }

      return { 
        success: false, 
        message: data.message || 'ID resolved, but no action available for your role.' 
      };
    } catch (err) {
      return { 
        success: false, 
        message: getApiErrorMessage(err, 'Scanner Error') 
      };
    }
  };

  // ─── Phase 2: Manual Search Logic ──────────────────────────────────────────

  const handleSearch = async (query: string): Promise<StudentItem[]> => {
    try {
      const res = await api.get('/users/students/', { params: { q: query } });
      return (res.data || []).map((student: any) => ({
        id: student.id,
        name: student.name,
        sub: student.username,
        detail: [student.hostel_name, student.room_number].filter(Boolean).join(' · ') || undefined,
        meta: { uuid: student.id },
      }));
    } catch (err) {
      console.error('Manual search failed', err);
      return [];
    }
  };

  const handleManualAction = async (item: StudentItem): Promise<ScanResult> => {
    // For manual actions, we synthesize a token for the Unified Action Endpoint
    // This maintains the "One Series" logic across QR and Manual
    const syntheticToken = `dcqr:manual:${item.meta?.uuid}`;
    return handleScan(syntheticToken);
  };

  return (
    <div className="min-h-screen bg-white md:bg-slate-50 pb-24 md:pb-20">
      {/* Header - Mobile Optimized with No Border on Phones */}
      <div className="bg-white md:border-b border-slate-200 px-4 py-3 md:py-4 sticky top-0 z-30">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center flex-1">
            <h1 className="font-black text-sm md:text-lg tracking-tight uppercase leading-none">Smart Scanner</h1>
            <Badge variant="outline" className="text-[9px] md:text-[10px] font-black uppercase bg-slate-50 border-0 mt-1">
              {getRoleLabel()}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate('/audit-logs')} className="rounded-full">
            <History className="h-5 w-5 text-slate-400" />
          </Button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 md:p-4 space-y-4 pt-2">
        {/* Main Scanner Card - Borderless on Mobile for Edge-to-Edge Feel */}
        <Card className="overflow-hidden border-0 md:border-2 border-slate-200 shadow-none md:shadow-xl rounded-[28px] md:rounded-[32px] bg-slate-50 md:bg-white">
          <CampusScanner
            title={getRoleLabel()}
            actionLabel="Confirm Scan"
            onQRToken={handleScan}
            onSearch={handleSearch}
            onManualAction={handleManualAction}
            onClose={() => navigate(-1)}
          />
        </Card>

        {/* Informational Toast Overlay style for Mobile */}
        <div className="bg-slate-900 rounded-[28px] p-5 shadow-lg mx-2">
          <div className="flex gap-4 items-center">
            <div className="flex-shrink-0 p-3 bg-white/10 rounded-2xl">
              <ShieldCheck className="h-5 w-5 text-blue-400" />
            </div>
            <div className="space-y-0.5">
              <p className="font-black text-[10px] uppercase text-slate-400 tracking-wider">Operational Mode</p>
              <p className="text-[11px] text-white font-bold leading-snug">
                One-tap scanning for {getRoleLabel()}. Automatically verifies identity & context.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Swatch Mode Indicators for Mobile Access */}
        <div className="grid grid-cols-2 gap-3 px-2">
          <ModeCard
            icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}
            title="Gate"
            active={user?.role === 'gate_security' || user?.role === 'security_head'}
          />
          <ModeCard
            icon={<Utensils className="h-4 w-4 text-orange-500" />}
            title="Meals"
            active={user?.role === 'chef'}
          />
          <ModeCard
            icon={<ClipboardCheck className="h-4 w-4 text-blue-500" />}
            title="Records"
            active={['warden', 'hr', 'supervisor'].includes(user?.role || '')}
          />
          <ModeCard
            icon={<Trophy className="h-4 w-4 text-purple-500" />}
            title="Sports"
            active={false}
          />
        </div>
      </div>
    </div>
  );
}

function ModeCard({ icon, title, active }: { icon: React.ReactNode, title: string, active: boolean }) {
  return (
    <div className={`p-4 flex items-center gap-3 rounded-[20px] transition-all border ${active ? 'bg-primary/5 border-primary shadow-sm' : 'bg-white border-slate-100 opacity-60'}`}>
      <div className={`p-2 rounded-xl ${active ? 'bg-white shadow-xs' : 'bg-slate-50'}`}>
        {icon}
      </div>
      <p className="font-black text-[10px] uppercase tracking-wider">{title}</p>
    </div>
  );
}
