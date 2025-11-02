// Mock data for development
import { User, GatePass, AttendanceSession, MealMenu, Notice, Role } from './types';

export const mockUsers: Record<string, User> = {
  'HT001': {
    id: 'u1',
    hallticket: 'HT001',
    name: 'Ravi Kumar',
    phone: '+91 98765 43210',
    email: 'ravi@college.edu',
    role: 'STUDENT',
    hostelId: 'h1',
    hostelName: 'Hostel A',
    collegeCode: 'CSE',
    room: 'A-201',
    blockId: 'b1',
    bedId: 'bed1',
    createdAt: '2025-01-01T00:00:00Z',
  },
  'HT002': {
    id: 'u2',
    hallticket: 'HT002',
    name: 'Priya Sharma',
    phone: '+91 98765 43211',
    email: 'priya@college.edu',
    role: 'STUDENT',
    hostelId: 'h1',
    hostelName: 'Hostel A',
    collegeCode: 'ECE',
    room: 'A-202',
    blockId: 'b1',
    bedId: 'bed2',
    createdAt: '2025-01-01T00:00:00Z',
  },
  'GATEMAN001': {
    id: 'g1',
    hallticket: 'GATEMAN001',
    name: 'Suresh Babu',
    phone: '+91 98765 43212',
    email: 'suresh@college.edu',
    role: 'GATEMAN',
    hostelId: 'h1',
    hostelName: 'Hostel A',
    createdAt: '2025-01-01T00:00:00Z',
  },
  'WARDEN001': {
    id: 'w1',
    hallticket: 'WARDEN001',
    name: 'Dr. Ramesh',
    phone: '+91 98765 43213',
    email: 'ramesh@college.edu',
    role: 'WARDEN',
    hostelId: 'h1',
    hostelName: 'Hostel A',
    createdAt: '2025-01-01T00:00:00Z',
  },
  'CHEF001': {
    id: 'c1',
    hallticket: 'CHEF001',
    name: 'Lakshmi',
    phone: '+91 98765 43214',
    email: 'lakshmi@college.edu',
    role: 'CHEF',
    hostelId: 'h1',
    hostelName: 'Hostel A',
    createdAt: '2025-01-01T00:00:00Z',
  },
  'ADMIN001': {
    id: 'a1',
    hallticket: 'ADMIN001',
    name: 'Admin User',
    phone: '+91 98765 43215',
    email: 'admin@college.edu',
    role: 'SUPER_ADMIN',
    createdAt: '2025-01-01T00:00:00Z',
  },
};

export const mockGatePasses: GatePass[] = [
  {
    id: 'gp1',
    hallticket: 'HT001',
    studentName: 'Ravi Kumar',
    studentId: 'u1',
    reason: 'Family Function',
    destination: 'Home - Hyderabad',
    departureTime: '2025-10-31T14:00:00Z',
    expectedReturn: '2025-11-01T18:00:00Z',
    state: 'APPROVED',
    isEmergency: false,
    approvedBy: 'Dr. Ramesh',
    approvedAt: '2025-10-31T10:00:00Z',
    lastActivityAt: '2025-10-31T10:00:00Z',
    createdAt: '2025-10-31T08:00:00Z',
    hostelId: 'h1',
    hostelName: 'Hostel A',
    adUnlocked: false,
  },
  {
    id: 'gp2',
    hallticket: 'HT002',
    studentName: 'Priya Sharma',
    studentId: 'u2',
    reason: 'Medical Checkup',
    destination: 'City Hospital',
    departureTime: '2025-10-31T10:00:00Z',
    expectedReturn: '2025-10-31T16:00:00Z',
    state: 'SUBMITTED',
    isEmergency: false,
    lastActivityAt: '2025-10-31T09:00:00Z',
    createdAt: '2025-10-31T09:00:00Z',
    hostelId: 'h1',
    hostelName: 'Hostel A',
  },
];

export const mockAttendanceSessions: AttendanceSession[] = [
  {
    id: 'as1',
    hostelId: 'h1',
    scope: 'FLOOR',
    scopeId: 'f1',
    startTime: '2025-10-31T09:00:00Z',
    endTime: '2025-10-31T10:00:00Z',
    mode: 'MIXED',
    status: 'ACTIVE',
    presentCount: 45,
    absentCount: 3,
    lateCount: 2,
    createdBy: 'Dr. Ramesh',
    createdAt: '2025-10-31T08:55:00Z',
  },
];

export const mockMealMenus: MealMenu[] = [
  {
    id: 'mm1',
    date: '2025-10-31',
    mealType: 'BREAKFAST',
    items: ['Idli', 'Vada', 'Sambar', 'Chutney', 'Tea/Coffee'],
    hostelId: 'h1',
    createdBy: 'Lakshmi',
  },
  {
    id: 'mm2',
    date: '2025-10-31',
    mealType: 'LUNCH',
    items: ['Rice', 'Dal', 'Sambar', 'Curry', 'Curd', 'Pickle'],
    hostelId: 'h1',
    createdBy: 'Lakshmi',
  },
  {
    id: 'mm3',
    date: '2025-10-31',
    mealType: 'DINNER',
    items: ['Roti', 'Rice', 'Dal', 'Paneer Curry', 'Salad'],
    hostelId: 'h1',
    createdBy: 'Lakshmi',
  },
];

export const mockNotices: Notice[] = [
  {
    id: 'n1',
    title: 'Hostel Inspection Notice',
    content: 'Hostel inspection will be conducted on November 5th. Please ensure your rooms are clean.',
    authorId: 'w1',
    authorName: 'Dr. Ramesh',
    authorRole: 'WARDEN',
    targets: {
      roles: ['STUDENT'],
      hostelIds: ['h1'],
    },
    createdAt: '2025-10-30T10:00:00Z',
    expiresAt: '2025-11-05T23:59:59Z',
  },
  {
    id: 'n2',
    title: 'Mess Menu Change',
    content: 'Special Diwali menu will be served on November 1st.',
    authorId: 'c1',
    authorName: 'Lakshmi',
    authorRole: 'CHEF',
    targets: {
      roles: ['STUDENT'],
      hostelIds: ['h1'],
    },
    createdAt: '2025-10-29T14:00:00Z',
    expiresAt: '2025-11-01T23:59:59Z',
  },
];

export function getCurrentUser(role: Role = 'STUDENT'): User {
  switch (role) {
    case 'STUDENT':
      return mockUsers['HT001'];
    case 'GATEMAN':
      return mockUsers['GATEMAN001'];
    case 'WARDEN':
    case 'WARDEN_HEAD':
      return mockUsers['WARDEN001'];
    case 'CHEF':
      return mockUsers['CHEF001'];
    case 'SUPER_ADMIN':
      return mockUsers['ADMIN001'];
    default:
      return mockUsers['HT001'];
  }
}

export function searchUsers(query: string): User[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(mockUsers).filter(
    user =>
      user.hallticket.toLowerCase().includes(lowerQuery) ||
      user.name.toLowerCase().includes(lowerQuery) ||
      user.phone?.includes(query) ||
      user.room?.toLowerCase().includes(lowerQuery)
  ).slice(0, 10);
}
