# Campus Core FigJam Board Pack — Page 00 to Page 09

This document is the single-place assembly guide for the Campus Core master FigJam board.

## Goal
Create **one FigJam board** with **10 large sections** laid out as a full operating system map for Campus Core.

---

## Board section order

Use these exact section names:

1. `00_MASTER_OVERVIEW`
2. `01_ROLE_UNIVERSE`
3. `02_MODULE_MAP`
4. `03_CORE_FLOWS`
5. `04_HOSTEL_OPS`
6. `05_SECURITY_OPS`
7. `06_STUDENT`
8. `07_MEALS_ATTENDANCE`
9. `08_ADMIN`
10. `09_LAUNCH_CONTROL`

---

## Recommended board grid

```text
┌───────────────────────────────┬───────────────────────────────┐
│ 00_MASTER_OVERVIEW            │ 01_ROLE_UNIVERSE             │
├───────────────────────────────┼───────────────────────────────┤
│ 02_MODULE_MAP                 │ 03_CORE_FLOWS                │
├───────────────────────────────┼───────────────────────────────┤
│ 04_HOSTEL_OPS                 │ 05_SECURITY_OPS              │
├───────────────────────────────┼───────────────────────────────┤
│ 06_STUDENT                    │ 07_MEALS_ATTENDANCE          │
├───────────────────────────────┼───────────────────────────────┤
│ 08_ADMIN                      │ 09_LAUNCH_CONTROL            │
└───────────────────────────────┴───────────────────────────────┘
```

### Suggested sizing
- Each section: **1600 × 1100**
- Gap between sections: **200**
- Total board width: about **3400**
- Total board height: about **6300**

---

## What goes in each section

### 00_MASTER_OVERVIEW
Purpose:
- platform summary
- domain clusters
- what Campus Core is

Use generated item:
- `00_MASTER_OVERVIEW`

---

### 01_ROLE_UNIVERSE
Purpose:
- all roles
- ownership clusters
- who controls what

Use generated item:
- `01_ROLE_UNIVERSE`

---

### 02_MODULE_MAP
Purpose:
- module dependency map
- operational data flow
- reporting chain

Use generated items:
- `02_MODULE_MAP`
- `Campus Core Master Module Interaction Map`

---

### 03_CORE_FLOWS
Purpose:
- full request / approval / closure logic
- cross-role operational paths

Use generated items:
- `03_CORE_FLOWS`
- `Campus Core Gate Pass Full Role Flow`
- `Campus Core Leave Request Full Role Flow`
- `Campus Core Complaint Resolution Full Role Flow`

---

### 04_HOSTEL_OPS
Purpose:
- room and hostel control layer
- warden operations

Use generated items:
- `04_HOSTEL_OPS`
- `Campus Core Room Request and Room Mapping Full Role Flow`

---

### 05_SECURITY_OPS
Purpose:
- gate verification and movement control
- visitor verification

Use generated items:
- `05_SECURITY_OPS`
- `Campus Core Visitor Management Full Role Flow`
- `Campus Core Gate Pass Full Role Flow` (if you want gate flow duplicated for the security team view)

---

### 06_STUDENT
Purpose:
- student journey
- self-service modules
- support and campus life modules

Use generated item:
- `06_STUDENT`

---

### 07_MEALS_ATTENDANCE
Purpose:
- daily operations
- attendance capture
- chef and head chef workflow

Use generated items:
- `07_MEALS_ATTENDANCE`
- `Campus Core Attendance and Meals Integrated Flow`

---

### 08_ADMIN
Purpose:
- governance and control tower
- institutions, users, reporting, analytics

Use generated item:
- `08_ADMIN`

---

### 09_LAUNCH_CONTROL
Purpose:
- final validation zone
- launch dependencies
- go-live checklist

Use generated item:
- `09_LAUNCH_CONTROL`

---

## Visual structure inside each section

Recommended internal layout:

```text
Top: Section title + purpose
Left: Roles involved
Center: Main FigJam diagram
Right: Outputs / reports / escalations
Bottom: Risks / blockers / launch notes
```

---

## Color recommendation by domain

- Overview / system: **navy**
- Roles: **purple**
- Module maps: **blue**
- Core flows: **orange**
- Hostel ops: **teal**
- Security ops: **red**
- Student: **green**
- Meals / attendance: **amber**
- Admin: **slate**
- Launch control: **charcoal**

---

## Assembly sequence

1. Create all 10 large sections.
2. Place the 10 Page 00–09 generated diagrams first.
3. Add the detailed supporting flow diagrams near their parent sections.
4. Resize diagrams so each section reads clearly without overlap.
5. Add notes for owners, dependencies, blockers, and SOP links.

---

## Final outcome

This board should function as:
- system brain
- onboarding map
- operations manual
- launch command center
- governance reference

---

## Current generated FigJam item list

### Section pack
- `00_MASTER_OVERVIEW`
- `01_ROLE_UNIVERSE`
- `02_MODULE_MAP`
- `03_CORE_FLOWS`
- `04_HOSTEL_OPS`
- `05_SECURITY_OPS`
- `06_STUDENT`
- `07_MEALS_ATTENDANCE`
- `08_ADMIN`
- `09_LAUNCH_CONTROL`

### Detailed flow pack
- `Campus Core Master Module Interaction Map`
- `Campus Core Gate Pass Full Role Flow`
- `Campus Core Leave Request Full Role Flow`
- `Campus Core Complaint Resolution Full Role Flow`
- `Campus Core Room Request and Room Mapping Full Role Flow`
- `Campus Core Visitor Management Full Role Flow`
- `Campus Core Attendance and Meals Integrated Flow`

---

## Recommended next enhancement

After arranging the board, create a second pass for:
- swimlane versions of all critical flows
- role-by-feature matrix
- launch checklist with pass/fail markers
- module ownership and escalation notes
