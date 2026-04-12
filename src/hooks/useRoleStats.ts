import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRealtimeQuery } from './useWebSocket';

export interface RoleStats {
  pending_gate_passes?: number;
  pending_complaints?: number;
  pending_leaves?: number;
  pending_meal_requests?: number;
  unread_messages?: number;
}

export function useRoleStats() {
  const user = useAuthStore((state) => state.user);
  
  // Real-time invalidation for dashboard/sidebar stats
  useRealtimeQuery(
    [
      'gatepass_updated',
      'gate_pass_updated',
      'complaint_created',
      'complaint_updated',
      'meal_updated',
      'notification_unread_increment',
    ],
    ['role-sidebar-stats']
  );

  return useQuery<RoleStats>({
    queryKey: ['role-sidebar-stats', user?.id, user?.role],
    queryFn: async () => {
      const response = await api.get('/metrics/dashboard/');
      const data = response.data;
      
      return {
        pending_gate_passes: data.pending_gate_passes || 0,
        pending_complaints: data.pending_complaints || 0,
        pending_leaves: data.pending_leaves || 0,
        pending_meal_requests: data.pending_meal_requests || 0,
        unread_messages: data.unread_messages || 0,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes (Real-time will invalidate)
  });
}
