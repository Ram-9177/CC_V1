/**
 * Central Type Definitions
 * All application types and interfaces are consolidated here for maintainability
 */

// ============================================================================
// Authentication & Authorization
// ============================================================================

export type Role = 
  | 'student' 
  | 'staff' 
  | 'admin' 
  | 'super_admin' 
  | 'head_warden' 
  | 'warden' 
  | 'chef' 
  | 'head_chef'
  | 'gate_security' 
  | 'security_head'

export interface User {
  id: number
  username: string
  email: string
  name: string
  role: Role
  phone?: string
  avatar?: string
  college?: string | { id: number; name: string }
  is_active: boolean
  created_at: string
  updated_at: string
  // Additional properties from backend
  hall_ticket?: string
  first_name?: string
  last_name?: string
  registration_number?: string
  profile_picture?: string
  room_number?: string
  room?: {
    id: number
    room_number: string
    floor: number
    building: string
  }
  tenant?: {
    father_name?: string
    father_phone?: string
    mother_name?: string
    mother_phone?: string
    guardian_name?: string
    guardian_phone?: string
    emergency_contact?: string
    blood_group?: string
    address?: string
    city?: string
    state?: string
    pincode?: string
    college_code?: string
    id_proof?: string
    risk_score?: number
    risk_status?: string
    disciplinary_notes?: string
  }
  risk_status?: 'low' | 'medium' | 'high' | 'critical'
  risk_score?: number
  is_student_hr?: boolean
}

export interface AuthResponse {
  user: User
  access: string
  refresh: string
}

export interface AuthStore {
  user: User | null
  access_token: string | null
  refresh_token: string | null
  isAuthenticated: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
}

export interface LoginRequest {
  username: string
  password: string
}

export interface PasswordResetRequest {
  email: string
}

// ============================================================================
// Attendance
// ============================================================================

export type AttendanceStatus = 'present' | 'absent'

export interface AttendanceRecord {
  id: number
  student: {
    id: number
    name: string
    hall_ticket?: string
    room_number?: string
  }
  date: string
  status: AttendanceStatus
  marked_by?: string
  marked_at: string
  gate_pass?: GatePass
}

export interface AttendanceStats {
  total_students: number
  present_today: number
  absent_today: number
  attendance_percentage: number
}

export interface AttendanceMonthly {
  date: string
  present: number
  absent: number
  percentage: number
}

export interface Defaulter {
  id: number
  name: string
  hall_ticket?: string
  room_number?: string
  absent_days: number
  last_present: string
  risk_score: number
}

// ============================================================================
// Meals
// ============================================================================

export type MealType = 'breakfast' | 'lunch' | 'dinner'
export type MealPreference = 'veg' | 'non_veg' | 'vegan'

export interface Meal {
  id: number
  date: string
  meal_type: MealType
  menu: string
  description?: string
  calories?: number
  available?: boolean
  created_by?: string
  is_feedback_active?: boolean
  feedback_prompt?: string
  created_at: string
  updated_at: string
}

export interface MealPreferences {
  id: number
  student: number
  meal_type: MealType
  preference: MealPreference
  is_active: boolean
}

export interface MealAttendance {
  id: number
  student: {
    id: number
    name: string
    hall_ticket?: string
    username?: string
  }
  meal: Meal
  status: 'taken' | 'skipped'
  attended?: boolean
  date?: string
  marked_at: string
}

export interface MealFeedback {
  id: number
  meal: number | Meal
  student: number
  student_name?: string
  hall_ticket?: string
  meal_type?: MealType
  rating: number
  comment?: string
  resolved: boolean
  created_at: string
  updated_at?: string
}

export interface MealSpecialRequest {
  id: number
  student: number
  student_name?: string
  hall_ticket?: string
  item_name: string
  quantity: number
  requested_for_date: string
  status: 'pending' | 'approved' | 'delivered' | 'rejected'
  notes?: string
  created_at: string
}

// ============================================================================
// Gate Passes & Security
// ============================================================================

export type GatePassStatus = 'pending' | 'approved' | 'rejected' | 'used' | 'expired'
export type GatePassType = 'day' | 'weekend' | 'emergency' | 'special' | 'home_pass'

export interface GatePass {
  id: number
  student: {
    id: number
    name: string
    hall_ticket?: string
  }
  type: GatePassType
  pass_type?: GatePassType // Alternative field name
  status: GatePassStatus
  date_from: string
  date_to?: string
  exit_date?: string // Alternative field name
  exit_time: string
  entry_time?: string | null
  reason?: string
  destination?: string
  phone_number?: string
  approved_by?: {
    id: number
    name: string
  }
  approved_at?: string
  qr_code?: string
  audio_brief?: string
  created_at: string
  updated_at: string
}

export interface GateScan {
  id: number
  gate_pass: GatePass
  scan_time: string
  scan_type: 'entry' | 'exit'
  scanned_by: {
    id: number
    name: string
  }
  notes?: string
  created_at: string
}

export interface Visitor {
  id: number
  name: string
  email?: string
  phone: string
  purpose: string
  student: {
    id: number
    name: string
  }
  check_in: string
  check_out?: string
  is_active: boolean
  photo_url?: string
  pre_registration?: number
  created_at: string
}

export interface VisitorPreRegistration {
  id: number
  student: number
  student_details?: User
  visitor_name: string
  relationship: string
  phone_number: string
  purpose: string
  expected_date: string
  expected_time?: string
  id_proof_number?: string
  status: 'pending' | 'approved' | 'rejected' | 'checked_in' | 'expired'
  approved_by_name?: string
  rejection_reason?: string
  notes?: string
  created_at: string
}

// ============================================================================
// Leave Applications
// ============================================================================

export type LeaveType = 'sick' | 'personal' | 'vacation' | 'emergency' | 'academic' | 'family'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface LeaveApplication {
  id: number
  student: number
  student_details?: User
  leave_type: LeaveType
  start_date: string
  end_date: string
  reason: string
  status: LeaveStatus
  approved_by?: number
  approved_by_name?: string
  approved_at?: string
  rejection_reason?: string
  parent_informed: boolean
  parent_contact?: string
  destination?: string
  contact_during_leave?: string
  attachment_url?: string
  notes?: string
  duration_days: number
  created_at: string
  updated_at: string
}

export interface LeaveStats {
  total: number
  pending: number
  approved: number
  rejected: number
  currently_on_leave: number
}

// ============================================================================
// Rooms & Allocation
// ============================================================================

export type BedType = 'single' | 'double' | 'triple'
export type RoomType = 'single' | 'double' | 'triple' | 'quad'

export interface Building {
  id: number
  name: string
  code: string
  floors: number
  capacity: number
  occupancy: number
}

export interface Room {
  id: number
  building: Building
  room_number: string
  floor: number
  type: RoomType
  capacity: number
  occupancy: number
  amenities: string[]
  bed_type: BedType
  is_active: boolean
}

export interface Bed {
  id: number
  room: Room
  bed_number: string
  is_occupied: boolean
  occupant?: {
    id: number
    name: string
    hall_ticket?: string
  }
}

export interface RoomAllocation {
  id: number
  student: {
    id: number
    name: string
    hall_ticket?: string
    phone_number?: string
  }
  room: Room
  bed: Bed
  allocation_date: string
  allocation_till?: string
  status: 'active' | 'inactive'
}

// ============================================================================
// Events
// ============================================================================

export interface Event {
  id: number
  title: string
  description?: string
  date: string
  start_time: string
  end_time: string
  location?: string
  organizer: {
    id: number
    name: string
  }
  capacity?: number
  registrations?: number
  is_past: boolean
  created_at: string
  external_link?: string | null
}

export interface EventRegistration {
  id: number
  event: Event
  student: {
    id: number
    name: string
  }
  registered_at: string
  attended: boolean
}

// ============================================================================
// Notices & Announcements
// ============================================================================

export interface Notice {
  id: number
  title: string
  content: string
  category?: string
  priority?: 'low' | 'medium' | 'high'
  is_urgent: boolean
  is_pinned: boolean
  target_audience?: 'all' | 'students' | 'staff'
  target_building_details?: {
    id: number
    name: string
  } | null
  created_by: {
    id: number
    name: string
    role: string
  }
  visibility?: 'all' | 'students' | 'staff'
  created_at: string
  updated_at: string
  external_link?: string | null
  image?: string | null
}

// ============================================================================
// Complaints & Disciplinary
// ============================================================================

export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type ComplaintCategory = 'maintenance' | 'services' | 'behavior' | 'other'

export interface Complaint {
  id: number
  student: {
    id: number
    name: string
  }
  category: ComplaintCategory
  title: string
  description: string
  status: ComplaintStatus
  attachments?: string[]
  assigned_to?: {
    id: number
    name: string
  }
  resolution?: string
  created_at: string
  updated_at: string
}

export interface DisciplinaryAction {
  id: number
  student: {
    id: number
    name: string
  }
  action_type: string
  reason: string
  severity: 'low' | 'medium' | 'high'
  status: 'pending' | 'active' | 'resolved'
  fine?: number
  created_at: string
  created_by: {
    id: number
    name: string
  }
}

export interface Fine {
  id: number
  student: {
    id: number
    name: string
    hall_ticket?: string
  }
  reason: string
  fine_amount: string | number
  is_paid: boolean
  paid_at?: string
  created_at: string
  created_by?: {
    id: number
    name: string
  }
}

// ============================================================================
// Messaging & Notifications
// ============================================================================

export interface Message {
  id: number
  sender: {
    id: number
    name: string
  }
  recipient: {
    id: number
    name: string
  }
  subject: string
  body: string
  is_read: boolean
  created_at: string
  attachments?: string[]
}

export interface Notification {
  id: number
  user: number
  title: string
  message: string
  notification_type: string
  data?: Record<string, unknown>
  is_read: boolean
  created_at: string
}

// ============================================================================
// Reports & Analytics
// ============================================================================

export interface AttendanceReport {
  date_range: {
    start: string
    end: string
  }
  total_students: number
  total_present: number
  total_absent: number
  percentage: number
  by_day: Array<{
    date: string
    present: number
    absent: number
    percentage: number
  }>
  defaulters: Defaulter[]
}

export interface OccupancyReport {
  total_rooms: number
  occupied_rooms: number
  vacant_rooms: number
  total_capacity: number
  current_occupancy: number
  by_building: Array<{
    building: string
    total: number
    occupied: number
    percentage: number
  }>
}

export interface GatePassReport {
  date_range: {
    start: string
    end: string
  }
  total_passes: number
  approved: number
  pending: number
  rejected: number
  used: number
  by_type: Record<string, number>
}

// ============================================================================
// System & Metrics
// ============================================================================

export interface SystemMetrics {
  timestamp: string
  active_users: number
  total_requests: number
  database_status: 'healthy' | 'degraded' | 'down'
  api_latency_ms: number
  cache_hit_rate: number
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down'
  database: boolean
  cache: boolean
  api: boolean
  last_check: string
}

// ============================================================================
// API Responses
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
    details?: Record<string, unknown>
  }
}

export interface PaginatedResponse<T = unknown> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ============================================================================
// Form Validation Schemas
// ============================================================================

export interface FormErrors {
  [key: string]: string | undefined
}

export interface FormSubmitState {
  isSubmitting: boolean
  isSuccess: boolean
  error?: string
}

// ============================================================================
// UI & State Management
// ============================================================================

export interface UIStore {
  sidebarOpen: boolean
  darkMode: boolean
  setSidebarOpen: (open: boolean) => void
  toggleDarkMode: () => void
}

export interface NotificationState {
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

// Sidebar Navigation
export interface SidebarItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  action?: 'install'
}

export interface SidebarCategory {
  title: string
  items: SidebarItem[]
}

// ============================================================================
// WebSocket Events
// ============================================================================

export type WebSocketEventType = 
  | 'attendance_marked'
  | 'gate_pass_status_changed'
  | 'meal_added'
  | 'complaint_updated'
  | 'notification_received'
  | 'user_status_changed'

export interface WebSocketMessage<T = unknown> {
  type: WebSocketEventType
  data: T
  timestamp: string
}

export interface RealtimeUpdates {
  attendance?: AttendanceRecord
  gatePass?: GatePass
  notification?: Notification
  [key: string]: unknown
}

// ============================================================================
// Colleges
// ============================================================================

export interface College {
  id: number
  name: string
  code: string
  city?: string
  state?: string
  contact_email?: string
  contact_phone?: string
  website?: string
  created_at: string
  updated_at: string
}

export const EMPTY_USER: User = {
  id: 0,
  username: '',
  email: '',
  name: '',
  role: 'student',
  is_active: false,
  created_at: '',
  updated_at: ''
}
