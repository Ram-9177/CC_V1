// Sample data for HostelConnect prototype
export const SAMPLE_STUDENT = {
  hallticket: '19X1A05C3',
  name: 'Aarav R.',
  hostel: 'Maple Hostel',
  block: 'B',
  room: 'B-204',
  bed: 'B',
  phone: '+91 98765 43210',
  email: 'aarav@college.edu'
};

export const SAMPLE_STAFF = {
  warden: { name: 'Ms. Kavya S.', role: 'WARDEN' },
  wardenHead: { name: 'Dr. Patel', role: 'WARDEN_HEAD' },
  gateman: { name: 'Mr. Devraj', role: 'GATEMAN' },
  chef: { name: 'Rahul C.', role: 'CHEF' }
};

export const SAMPLE_GATE_PASS = {
  id: 'GP-2025-1042',
  hallticket: '19X1A05C3',
  studentName: 'Aarav R.',
  reason: 'Family Function',
  destination: 'Hyderabad',
  departTime: '2025-10-30T16:00:00',
  returnTime: '2025-10-31T20:00:00',
  type: 'CASUAL',
  status: 'PENDING'
};

export const GATE_PASS_STATUSES = {
  SUBMITTED: { label: 'Submitted', color: 'bg-blue-100 text-blue-800' },
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  OUTSIDE: { label: 'Outside', color: 'bg-orange-100 text-orange-800' },
  INSIDE: { label: 'Inside', color: 'bg-gray-100 text-gray-800' },
  OVERDUE: { label: 'Overdue', color: 'bg-red-100 text-red-800' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800' }
};

export const ROLES = {
  STUDENT: 'STUDENT',
  WARDEN: 'WARDEN',
  WARDEN_HEAD: 'WARDEN_HEAD',
  CHEF: 'CHEF',
  GATEMAN: 'GATEMAN',
  SUPER_ADMIN: 'SUPER_ADMIN'
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const SAMPLE_STUDENTS = [
  {
    hallticket: '19X1A05C3',
    name: 'Aarav R.',
    hostel: 'Maple Hostel',
    room: 'B-204',
    bed: 'B',
    phone: '+91 98765 43210',
    status: 'INSIDE'
  },
  {
    hallticket: '19X1A05D1',
    name: 'Priya K.',
    hostel: 'Maple Hostel',
    room: 'A-101',
    bed: 'A',
    phone: '+91 98765 43211',
    status: 'OUTSIDE'
  },
  {
    hallticket: '19X1A05E2',
    name: 'Rohan M.',
    hostel: 'Oak Hostel',
    room: 'C-305',
    bed: 'C',
    phone: '+91 98765 43212',
    status: 'INSIDE'
  },
  {
    hallticket: '19X1A05F3',
    name: 'Sneha P.',
    hostel: 'Maple Hostel',
    room: 'B-204',
    bed: 'A',
    phone: '+91 98765 43213',
    status: 'INSIDE'
  }
];

export const SAMPLE_NOTICES = [
  {
    id: '1',
    title: 'Fire Drill at 6 PM',
    content: 'Mandatory fire safety drill scheduled for all residents.',
    author: 'Ms. Kavya S.',
    date: '2025-10-30T14:00:00',
    priority: 'HIGH'
  },
  {
    id: '2',
    title: 'Menu change: Thu dinner',
    content: 'Thursday dinner menu updated. Check the meals board.',
    author: 'Rahul C.',
    date: '2025-10-29T10:00:00',
    priority: 'NORMAL'
  }
];
