// English-first with optional Telugu translations
export const translations = {
  // Core Actions
  welcome: "Welcome",
  confirm: "Confirm",
  cancel: "Cancel",
  apply: "Apply",
  approve: "Approve",
  reject: "Reject",
  submit: "Submit",
  save: "Save",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  
  // Status
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  active: "Active",
  completed: "Completed",
  overdue: "Overdue",
  present: "Present",
  absent: "Absent",
  late: "Late",
  
  // Location
  outside: "Outside",
  inside: "Inside",
  
  // Roles
  student: "Student",
  gateman: "Gateman",
  warden: "Warden",
  chef: "Chef",
  admin: "Admin",
  
  // Navigation
  dashboard: "Dashboard",
  gatePass: "Gate Pass",
  attendance: "Attendance",
  meals: "Meals",
  notices: "Notices",
  profile: "Profile",
  menu: "Menu",
  
  // Fields
  hallticket: "Hall Ticket",
  name: "Name",
  phone: "Phone",
  room: "Room",
  hostel: "Hostel",
  
  // Actions
  search: "Search",
  export: "Export",
  import: "Import",
  logout: "Logout",
  settings: "Settings",
  notifications: "Notifications",
  
  // Common
  yes: "Yes",
  no: "No",
  sameAsYesterday: "Same as Yesterday",
  loading: "Loading",
  error: "Error",
  success: "Success",
};

// Telugu translations (optional display)
export const teluguTranslations = {
  welcome: "స్వాగతం",
  gatePass: "గేట్ పాస్",
  attendance: "హాజరు",
  meals: "భోజనం",
  approve: "ఆమోదించు",
  reject: "తిరస్కరించు",
};

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey): string {
  return translations[key] || key;
}

export function tWithTelugu(key: TranslationKey): string {
  const english = translations[key] || key;
  const telugu = teluguTranslations[key as keyof typeof teluguTranslations];
  return telugu ? `${english}` : english; // Just English, Telugu available if needed
}
