/**
 * Sports QRScanner — wraps CampusScanner with sports check-in callbacks.
 * QR mode: scans Digital Card QR → POST /sports/bookings/check-in/
 * Manual mode: search students with bookings today → confirm → same endpoint
 */
import { CampusScanner, type StudentItem, type ScanResult } from '@/components/common/CampusScanner';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

interface QRScannerProps {
  onClose: () => void;
}

export function QRScanner({ onClose }: QRScannerProps) {
  /** QR mode: decode text from Digital Card payload */
  const handleQRToken = async (decodedText: string): Promise<ScanResult> => {
    try {
      const digitalQR = decodedText.trim();
      const res = await api.post('/sports/bookings/check-in/', { digital_qr: digitalQR, scan_method: 'qr' });
      toast.success('Sports check-in recorded');
      return {
        success: true,
        message: res.data.detail || 'Check-in Successful!',
      };
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Check-in failed');
      toast.error(msg);
      return { success: false, message: msg };
    }
  };

  interface SportsBookingItem {
    student_id: number;
    name: string;
    registration_number: string;
    sport: string;
    court: string;
    time: string;
    booking_id: number;
  }

  /** Manual mode: fetch students with confirmed bookings today */
  const handleSearch = async (query: string): Promise<StudentItem[]> => {
    const res = await api.get('/sports/bookings/student-search/', { params: { q: query } });
    return (res.data as SportsBookingItem[]).map((item) => ({
      id: item.student_id,
      name: item.name,
      sub: item.registration_number,
      detail: `${item.sport} · ${item.court} · ${item.time}`,
      meta: { booking_id: item.booking_id },
    }));
  };

  /** Manual mode: check in by student_id */
  const handleManualAction = async (item: StudentItem): Promise<ScanResult> => {
    try {
      const res = await api.post('/sports/bookings/check-in/', {
        student_id: item.id,
        scan_method: 'manual',
      });
      toast.success('Manual sports check-in recorded');
      return { success: true, message: res.data.detail || 'Check-in successful!' };
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Check-in failed');
      toast.error(msg);
      return { success: false, message: msg };
    }
  };

  return (
    <CampusScanner
      title="Sports Check-In"
      actionLabel="Check In"
      onQRToken={handleQRToken}
      onSearch={handleSearch}
      onManualAction={handleManualAction}
      searchPlaceholder="Search by name or registration number…"
      onClose={onClose}
    />
  );
}
