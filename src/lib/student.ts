import { User, GatePass } from '@/types';

/**
 * Normalizes student name from various backend formats
 */
export const getStudentName = (user: User | null | undefined): string => {
  if (!user) return '—';
  if (user.first_name || user.last_name) {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim();
  }
  return user.name || 'Student';
};

/**
 * Normalizes college name retrieval
 */
export const getCollegeName = (user: User | null | undefined): string => {
  if (!user) return '—';
  if (user.college_name) return user.college_name;
  if (typeof user.college === 'object' && user.college) {
    return user.college.name;
  }
  return String(user.college || '—');
};

/**
 * Checks if a student is currently outside the hostel based on status and gate passes
 */
export const isOutOnPass = (user: User | null | undefined, activePass?: GatePass | null): boolean => {
  if (!user) return false;
  
  // Explicit status check from profile
  if (user.student_status === 'OUTSIDE_HOSTEL') return true;
  
  // Pass status check
  if (activePass && activePass.status === 'used') return true;
  
  return false;
};

/**
 * Gets student identity display (Roll No / Ext No)
 */
export const getStudentIdentity = (user: User | null | undefined): string => {
  if (!user) return '—';
  return user.registration_number || user.hall_ticket || '—';
};

/**
 * Gets student avatar/profile picture URL with fallback
 */
export const getStudentAvatar = (user: User | null | undefined): string => {
  if (!user) return `https://ui-avatars.com/api/?name=User&background=e2e8f0&color=475569&bold=true`;
  
  if (user.profile_picture) return user.profile_picture;
  if (user.avatar) return user.avatar;
  
  const name = getStudentName(user);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e2e8f0&color=475569&bold=true`;
};
