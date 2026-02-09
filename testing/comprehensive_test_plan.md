# Comprehensive User-Based Test Plan

## 1. Student Workflow (User: `2024TEST001`)

- **Authentication**: Login/Logout.
- **Dashboard**: Verify personal stats (Attendance, Outings), Room details.
- **Digital ID**: Verify card rendering with photo and details.
- **Gate Passes**:
  - Create a new "Local Outing" pass.
  - Verify it appears in the list with "Pending" status.
- **Complaints**:
  - File a new complaint (e.g., "Fan not working").
  - Verify it appears in the history.
- **Notices**: View active notices.

## 2. Warden/Admin Workflow (User: `WARDEN_USER` / `ADMIN_USER`)

- **Authentication**: Login.
- **Dashboard**: Verify hostel-wide stats.
- **Gate Pass Management**:
  - View the "Pending" pass created by the student.
  - Approve the pass.
- **Complaint Management**:
  - View the complaint filed by the student.
  - Update status to "Resolved".
- **Attendance**:
  - View attendance sheet.
  - Mark a student as "Absent" and then back to "Present".

## 3. Gate Security Workflow (User: `GATESECURITY`)

- **Authentication**: Login.
- **Visitor Management**:
  - Log a new visitor entry.
  - Mark visitor exit.
- **Gate Pass Check**:
  - Verify ability to view approved passes.
  - Simulate a "Check-out" (if UI permits).

## 4. Edge Cases & Stability

- **Concurrent Sessions**: Login as Admin in one browser/tab and Student in another (simulated by logout/login sequence).
- **Data Persistence**: Verify changes made by one user are reflected for others.
