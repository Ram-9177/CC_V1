# SMG Hostel ERP - Application Flow Architecture

This document maps every screen and decision node in the application, explaining exactly where the user goes based on their actions.

---

## 🔐 1. Authentication & Onboarding Flow

The gateway to the application for all roles.

| Starting Page     | User Action                | System Condition       | Resulting Page               |
| :---------------- | :------------------------- | :--------------------- | :--------------------------- |
| **Login Page**    | Enter Credentials + Submit | ✅ Credentials correct | **Dashboard** (or Role Home) |
| **Login Page**    | Enter Credentials + Submit | ❌ Credentials wrong   | Same Page (Error Toast)      |
| **Login Page**    | Click "Create Account"     | -                      | **Register Page**            |
| **Register Page** | Fill form + Register       | ✅ Success             | **Login Page**               |
| **Dashboard**     | Click "Logout"             | -                      | **Login Page**               |
| **Any Page**      | Session Token Expired      | -                      | **Login Page** (Automatic)   |

---

## 🎓 2. Student Journey Flow

Primary path for students requesting services.

| Starting Page   | User Action             | Logic / Condition        | Resulting Page                    |
| :-------------- | :---------------------- | :----------------------- | :-------------------------------- |
| **Dashboard**   | Click "Apply for Pass"  | -                        | **Gate Passes Page**              |
| **Gate Passes** | Click "(+) New Pass"    | Fill form & Record Audio | **Gate Passes** (List Updates)    |
| **Gate Passes** | Warden rejects request  | Real-time Alert          | **Gate Passes** (Badge: Rejected) |
| **Gate Passes** | Warden approves request | Real-time Alert          | **Gate Passes** (Badge: Approved) |
| **Gate Passes** | Tap approved record     | -                        | **Digital ID** (QR View)          |
| **Digital ID**  | Guard scans / logs exit | -                        | **Dashboard** (Status: Out)       |
| **Dashboard**   | Click "Meals"           | -                        | **Meals Page** (Menu View)        |

---

## 🛡️ 3. Warden / Management Flow

Focus on oversight, approvals, and student tracking.

| Starting Page    | User Action            | Logic / Condition       | Resulting Page                    |
| :--------------- | :--------------------- | :---------------------- | :-------------------------------- |
| **Dashboard**    | Click "Pending Passes" | -                       | **Gate Passes Page**              |
| **Gate Passes**  | Tap Pending card       | Listen to Audio         | **Pass Details View**             |
| **Pass Details** | Click "Approve"        | Condition: Valid reason | **Gate Passes** (Status: Done)    |
| **Pass Details** | Click "Reject"         | Error/Missing info      | **Gate Passes** (Student Alerted) |
| **Attendance**   | Tap "Present" on card  | -                       | Same Page (Real-time Save)        |
| **Fines Page**   | Issue New Fine         | Search student + submit | Same Page (Student Notified)      |
| **Rooms Page**   | Click "Map"            | -                       | **Room Mapping** (Visual View)    |

---

## 👮 4. Security Flow

Gateway monitoring and scanning.

| Starting Page    | User Action            | Logic / Condition       | Resulting Page                     |
| :--------------- | :--------------------- | :---------------------- | :--------------------------------- |
| **Gate Passes**  | Tap student's record   | View Photo & Status     | **Digital Card Dialog**            |
| **Digital Card** | Select "Gate Location" | Choose Main/Side/Back   | Same Page (Dialog)                 |
| **Digital Card** | Click "Allow Exit"     | Pass status: `Approved` | **Gate Passes** (Status: Used)     |
| **Digital Card** | Click "Log Entry"      | Pass status: `Used`     | **Gate Passes** (Status: Returned) |
| **Gate Scans**   | Click search           | -                       | **Gate Scans** (Audit History)     |

---

## 👨‍🍳 5. Chef Flow

Mess and meal management.

| Starting Page  | User Action             | Logic / Condition     | Resulting Page                  |
| :------------- | :---------------------- | :-------------------- | :------------------------------ |
| **Meals Page** | Click "Update Menu"     | Fill items & calories | Same Page (Menu Updated)        |
| **Meals Page** | Click "Meal Attendance" | -                     | **Attendance Page** (Meal Mode) |
| **Attendance** | Mark entry              | Student eats          | same page (Counter Increases)   |

---

## ⚙️ 6. Admin / Power User Flow

System health and global management.

| Starting Page    | User Action            | Logic / Condition       | Resulting Page                 |
| :--------------- | :--------------------- | :---------------------- | :----------------------------- |
| **Dashboard**    | Click "Manage Tenants" | -                       | **Users Page**                 |
| **Users Page**   | Click "Add Student"    | -                       | Same Page (Success Modal)      |
| **Users Page**   | Click "Promote to HR"  | Condition: Student role | Same Page (Role badge changes) |
| **Metrics Page** | Select Metric Type     | Click "Load"            | Same Page (Charts/Data Load)   |
| **Reports Page** | Select Dates           | Click "Export"          | File Download (.csv)           |

---

**Note:** All flows are assisted by **WebSockets**. If an action is taken on a Warden's screen, the corresponding update appears on the Student's or Security's screen **instantly** without a page navigation.
