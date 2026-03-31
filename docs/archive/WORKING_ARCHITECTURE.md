# SMG CampusCore ERP - Working Architecture Specification

This document provides a comprehensive deep-dive into the technical architecture, data flows, and role-specific journeys of the SMG CampusCore Management System.

---

## 1. High-Level Architecture

The system follows a **Decoupled Client-Server Architecture** with a **Real-Time Event Bus**.

### Components:

- **Web Client (React):** Single Page Application (SPA) serving as the user interface.
- **API Gateway/Backend (Django):** Performs business logic, security enforcement, and data persistence.
- **Real-Time Engine (Django Channels):** Manages persistent WebSocket connections for instant updates.
- **Event Broker (Redis):** Handles asynchronous messaging between the API and the WebSocket clients.
- **Storage (PostgreSQL):** Relational database for all core entities (Users, Rooms, Gate Passes).

---

## 2. The "Real-Time Synchronization" Logic

Unlike traditional apps, SMG CampusCore doesn't require manual refreshing. It uses an **Invalidation-Based Update Pattern**.

1.  **Action:** A Warden approves a Gate Pass via a `PATCH` request.
2.  **Persistence:** Django saves the new status to the database.
3.  **Signal:** A post-save signal is triggered in the backend.
4.  **Broadcast:** The backend sends a message to Redis: `"invalidate:gate-passes"`.
5.  **Relay:** Redis sends this to Daphne (WebSocket server).
6.  **Socket Delivery:** Daphne pushes a lightweight JSON packet to the Student's browser.
7.  **Refetch:** The Student's frontend (React Query) sees the packet and automatically re-fetches only the visible data.

---

## 3. Screen-to-Screen Flow by Role

### 🎓 Student Flow

_Purpose: Requesting and tracking hostel services._

1.  **Dashboard:** Real-time summary of "In/Out" status and today's menu.
2.  **Gate Passes:** Click `(+) Request` → Form Popup → **Audio Brief Recording** → `Submit`.
3.  **Digital ID:** Automatically updates with a **Live QR Code** once the Warden approves.
4.  **Complaints:** Simple list view to log issues (Maintenance/Laundry) and track "Open/Closed" status.
5.  **Leaves:** Multi-day request form requiring Parent Phone Number verification.

### 🛡️ Warden Flow

_Purpose: Approvals and discipline._

1.  **Dashboard:** Metrics for "Total Students Absent" and "Urgent Complaints".
2.  **Gate Passes:** List view with "Pending" filter → Tap a pass to **Play Audio** → `Approve/Reject`.
3.  **Attendance:** Building-wise grid. Tap a student card to toggle `Present/Absent`. Calculates stats instantly.
4.  **Fines Page:** Search student → Select violation severity → **Issue Penalty**.
5.  **Room Mapping:** Visual drag-and-drop to move students between rooms/floors.

### 👨‍🍳 Chef Flow

_Purpose: Food logistics and notices._

1.  **Meals Page:** POST daily menu (Items, Calorie Info).
2.  **Meal Attendance:** Scan or Mark student entries into the mess hall.
3.  **Notices:** Broadcast "Special Holiday Menu" or "Mess Maintenance" to all students.

### 👮 Gate Security Flow

_Purpose: Perimeter control._

1.  **Security Dash:** Log of recent scans and unauthorized attempts.
2.  **Digital Card Dialog:** Visible when a student presents their ID. Guard selects the **Gate Name** (Main/Side) and clicks **"Allow Exit"**.
3.  **Gate Scans:** History log for searching specific entry/exit events for investigation.

---

## 4. Technical Stack Summary

| Layer        | Tool                 | Rationale                                                |
| :----------- | :------------------- | :------------------------------------------------------- |
| **Frontend** | React 18 / Vite      | Fast builds, state-of-the-art developer experience.      |
| **Logic**    | TypeScript           | Eliminates runtime errors and provides IDE intelligence. |
| **UI**       | shadcn/ui + Tailwind | Premium, accessible components with custom styling.      |
| **State**    | React Query          | Built-in caching, polling, and refetching logic.         |
| **Backend**  | Django 4.2           | Proven security, high robustness, and fast development.  |
| **Sockets**  | Django Channels      | Native integration with Django for async WebSockets.     |
| **Database** | PostgreSQL           | Reliability and support for complex relations and JSONB. |
| **Auth**     | JWT / SimpleJWT      | Stateless authentication for high scalability.           |

---

## 5. Deployment Architecture

The app is optimized for **Cloud Native Deployment**:

- **Reverse Proxy:** Nginx routes traffic. `/api/` goes to the API server; `/ws/` goes to the WebSocket server.
- **Static Assets:** Served via WhiteNoise or S3/CDN.
- **Background Tasks:** Celery/Redis used for sending emails or expiring old gate passes.
- **Migrations:** Auto-applied during the CI/CD pipeline.

---

**Last Updated:** February 2026
**Status:** Architecture Fully Implemented ✅
