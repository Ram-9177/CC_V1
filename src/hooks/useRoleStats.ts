import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export interface RoleStats {
  pending_gate_passes?: number;
  pending_complaints?: number;
  pending_leaves?: number;
  pending_meal_requests?: number;
  unread_messages?: number;
}

export function useRoleStats() {
  const user = useAuthStore((state) => state.user);
  
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
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}
