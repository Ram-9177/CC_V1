// Core type definitions
export type Role = 'STUDENT' | 'GATEMAN' | 'WARDEN' | 'WARDEN_HEAD' | 'CHEF' | 'SUPER_ADMIN';

export type GatePassState = 
  | 'DRAFT' 
  | 'SUBMITTED' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'ACTIVE' 
  | 'COMPLETED' 
  | 'OVERDUE'
  | 'REVOKED_AUTO';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

export type MealChoice = 'YES' | 'SAME' | 'NO';

export interface User {
  id: string;
  hallticket: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
  hostelId?: string;
  hostelName?: string;
  collegeCode?: string;
  room?: string;
  blockId?: string;
  bedId?: string;
  createdAt: string;
}

export interface GatePass {
  id: string;
  hallticket: string;
  studentName: string;
  studentId: string;
  reason: string;
  destination: string;
  departureTime: string;
  expectedReturn: string;
  state: GatePassState;
  isEmergency: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  lastActivityAt: string;
  createdAt: string;
  qrToken?: string;
  adUnlocked?: boolean;
  hostelId: string;
  hostelName: string;
}

export interface GateScan {
  id: string;
  gatePassId: string;
  hallticket: string;
  type: 'OUT' | 'IN';
  timestamp: string;
  scannedBy: string;
  method: 'QR' | 'MANUAL';
  kioskId?: string;
}

export interface AttendanceSession {
  id: string;
  hostelId: string;
  scope: string; // 'FLOOR' | 'BLOCK' | 'ROOM'
  scopeId: string;
  startTime: string;
  endTime: string;
  mode: 'QR' | 'BLUEPRINT' | 'MIXED';
  status: 'ACTIVE' | 'CLOSED';
  presentCount: number;
  absentCount: number;
  lateCount: number;
  createdBy: string;
  createdAt: string;
}

export interface AttendanceMark {
  id: string;
  sessionId: string;
  hallticket: string;
  studentName: string;
  status: AttendanceStatus;
  markedAt: string;
  markedBy: string;
  via: 'QR' | 'BLUEPRINT' | 'MANUAL';
}

export interface MealMenu {
  id: string;
  date: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER';
  items: string[];
  hostelId: string;
  createdBy: string;
}

export interface MealIntent {
  id: string;
  hallticket: string;
  studentName: string;
  date: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER';
  choice: MealChoice;
  isOutside: boolean;
  submittedAt: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  targets: {
    roles?: Role[];
    hostelIds?: string[];
    blockIds?: string[];
  };
  attachments?: string[];
  createdAt: string;
  expiresAt?: string;
}

export interface SearchResult {
  hallticket: string;
  name: string;
  userId: string;
  phone?: string;
  room?: string;
  hostel?: string;
  tags: string[];
  currentStatus?: 'INSIDE' | 'OUTSIDE';
}

export interface AnalyticsPeriod {
  type: 'DAY' | 'WEEK' | 'FORTNIGHT' | 'MONTH';
  start: string;
  end: string;
}

export interface DashboardStats {
  role: Role;
  period: AnalyticsPeriod;
  data: Record<string, any>;
}

// Multi-tenant admin
export interface Tenant {
  id: string;
  code: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  branding?: Record<string, any> | null;
  domains?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface College {
  id: string;
  code: string;
  name: string;
  address?: string;
  tenant: Tenant;
  createdAt: string;
  updatedAt: string;
}

// Feature flags
export type FeatureScope = 'TENANT' | 'COLLEGE';
export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  scope: FeatureScope;
  scopeId: string;
  config?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}
