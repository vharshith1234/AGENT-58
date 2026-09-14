# Agent 58 — Judge Walkthrough: Plan, Flows & Actions

**Project:** Faculty Workload System (AGENT-58)  
**Institution:** Vignan's Foundation for Science, Technology & Research  
**Audience:** Evaluation / demo for judges  

Use this document as a **speaking script + flow map**. Follow the demo plan in order; use the diagrams when explaining architecture.

---

## 1. One-minute pitch

Agent 58 calculates and monitors **faculty workload** against institutional norms (min / expected / max), then routes department packages through **HOD → Dean → Principal** for approval.  

- **CSE** uses **REAL** timetable/allocation data.  
- Other departments use **DEMO** academic data with **official** faculty identities and photos.  
- Roles: **HR**, **HOD**, **Faculty**, **Dean**, **Principal**.

---

## 2. System architecture (explain first)

```
┌─────────────┐         ┌──────────────────┐         ┌────────────┐
│  Frontend   │  HTTPS  │  Backend (Nest)  │  Prisma │ PostgreSQL │
│  React/Vite │ ──────► │  /api + JWT RBAC │ ──────► │  Neon/local│
│  (Vercel)   │         │  (Render)        │         └────────────┘
└─────────────┘         └──────────────────┘
```

| Layer | Responsibility |
|---|---|
| Frontend | Role dashboards, charts, login, statements UI |
| Backend | Auth, workload engine, CRUD, approvals, reports |
| Database | Faculty, allocations, norms, snapshots, approvals |
| Engine | Pure deterministic load calc → NORMAL / OVERLOAD / UNDERLOAD |

---

## 3. End-to-end data flow

```
1. HR sets policies (weights) + norms (min/expected/max)
2. HOD enters courses, allocations, timetable, projects, research, admin/committees
3. Workload engine recalculates → stores snapshot (status + totals)
4. Faculty views load, verifies, or raises a correction
5. HOD balances / simulates → submits package for approval
6. Dean reviews → approve / send-back / escalate
7. Principal finalizes escalated packages
8. Leadership views compliance, overload/underload, exports reports
```

---

## 4. Role action map (what each person does)

### A. HR — Policy & master data

| Step | Action | Where |
|---|---|---|
| 1 | Login as HR | `/login` |
| 2 | Open Dashboard — institution health | `/hr/dashboard` |
| 3 | Manage faculty / departments | Faculty Management, Departments |
| 4 | Set activity **weights** & **norms** | Workload Policies / Weightings |
| 5 | Review correction requests | Correction Requests |
| 6 | Check compliance & export reports | Compliance, Reports |

**Talking point:** HR defines *rules*; academic ops stay with HOD.

---

### B. HOD — Department operations

| Step | Action | Where |
|---|---|---|
| 1 | Login as HOD (CSE) | `/login` |
| 2 | See department dashboard | `/hod/dashboard` |
| 3 | Maintain courses & allocations | Courses, Course Allocation |
| 4 | Maintain timetable (Excel import OK) | Timetable |
| 5 | Add projects / research / admin roles | Projects, Research, Admin & Committees |
| 6 | Open Workload tab — status per faculty | Workload |
| 7 | Use Balancing / What-if (what-if does **not** save) | Balancing, What-if |
| 8 | Review corrections; submit package to Dean | Corrections, Submit approval |

**Talking point:** Teaching load comes from **allocations**; timetable is schedule evidence, not double-counted.

---

### C. Faculty — Self service

| Step | Action | Where |
|---|---|---|
| 1 | Login as faculty | `/login` |
| 2 | View my courses / timetable / projects | My Courses, Timetable, Projects… |
| 3 | Inspect My Workload + status pill | My Workload |
| 4 | Verify or request correction | Corrections |
| 5 | Download statement (PDF / Excel / CSV) | Workload Statement |
| 6 | Update profile photo | Profile |

---

### D. Dean — Cross-department oversight

| Step | Action | Where |
|---|---|---|
| 1 | Login as Dean | `/login` |
| 2 | Institution-wide dashboard counts | `/dean/dashboard` |
| 3 | Browse department cards | Departments |
| 4 | Compare Normal / Over / Under | Comparison, Analysis |
| 5 | Drill overload / underload | Overload, Underload |
| 6 | Approvals: Approve / Send back / Escalate | Approvals |
| 7 | Trends & reports | Trends, Reports |

---

### E. Principal — Institution governance

| Step | Action | Where |
|---|---|---|
| 1 | Login as Principal | `/login` |
| 2 | Overview KPIs | `/principal/dashboard` |
| 3 | Schools → departments hierarchy | Institution Overview |
| 4 | Faculty directory, analytics, compliance | Faculty, Analytics, Compliance |
| 5 | Overload / underload cards, trends | Overload, Underload, Trends |
| 6 | Approvals: Approve / Finalize / Send back | Approvals |
| 7 | Institution reports / compliance PDF | Reports |

---

## 5. Workload calculation flow (technical, short)

```
Inputs
  ├─ Course allocations (THEORY / LAB / TUTORIAL …)
  ├─ Projects, research, admin roles, committees, PhD
  ├─ Policy weights (from DB)
  └─ Norms min / expected / max (from DB)
           │
           ▼
   Workload Engine (deterministic)
           │
           ▼
   Weighted total + status
           │
           ▼
   Snapshot persisted
           │
           ├── Faculty UI / HOD tables
           ├── Dean / Principal analytics
           └── Reports & compliance %
```

| Status | Meaning |
|---|---|
| UNDERLOAD | Below minimum |
| NORMAL | Within band |
| OVERLOAD | Above maximum |
| INDETERMINATE | Not enough data |

**What-if:** same engine, **no DB write**.  
**Recalculate:** after mutations, snapshots refresh.

---

## 6. Approval workflow (judge diagram)

```
        ┌──────────────┐
        │ HOD submits  │
        │ dept package │
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │ Dean review  │
        └──────┬───────┘
     ┌─────────┼─────────┐
     ▼         ▼         ▼
 Send back  Approve   Escalate
                          │
                          ▼
                 ┌─────────────────┐
                 │ Principal review│
                 └────────┬────────┘
              ┌───────────┼───────────┐
              ▼           ▼           ▼
          Send back    Approve    Finalize
```

Also parallel: **Faculty correction → HOD/HR review**.

---

## 7. REAL vs DEMO (say this clearly)

| | REAL | DEMO |
|---|---|---|
| Scope | CSE | IT, CA, ACSE, ECE, EEE, MECH, CIVIL, DMS |
| Academic data | Section-7 timetable / allocations | Synthetic until real import |
| People / photos | Official directory sync | Same (official identities) |
| Dashboards | Often shown separately + combined totals | Same |

---

## 8. Suggested live demo plan (10–12 minutes)

### Minute 0–1 — Setup story
- Problem: uneven faculty load, manual Excel tracking.  
- Solution: Agent 58 — calculate, visualize, approve.

### Minute 1–3 — Login & roles
1. Show login page.  
2. Login **Principal** → institution KPIs.  
3. Logout → Login **Dean** → department cards / comparison.

### Minute 3–6 — HOD deep dive
1. Login **HOD**.  
2. Dashboard → Faculty → Workload tab.  
3. Point NORMAL / OVERLOAD / UNDERLOAD.  
4. Open What-if: “simulation only, does not save.”  
5. Mention submit-for-approval.

### Minute 6–8 — Faculty view
1. Login a **CSE faculty**.  
2. My Workload + download statement.  
3. Show photo/profile (official sync).

### Minute 8–10 — HR policies
1. Login **HR**.  
2. Policies / norms = institutional rules.  
3. Compliance report.

### Minute 10–12 — Close
- Approval chain HOD → Dean → Principal.  
- REAL CSE + DEMO other depts.  
- Stack: React + Nest + Postgres; deployed frontend/backend if asked.  
- Q&A.

---

## 9. Demo credentials (quick reference)

| Role | Email | Password |
|---|---|---|
| HR | uttejkumarn@vignan.ac.in | Vignan@44655544 |
| HOD | svphanikumar@vignan.ac.in | Vignan@79565614 |
| DEAN | kvkrishnakishore@vignan.ac.in | Vignan@69135562 |
| PRINCIPAL | sdevakumar@vignan.ac.in | Vignan@97536569 |
| Faculty (sample) | dsenthil@vignan.ac.in | Vignan@39206076 |
| Faculty (CSE) | kpk_cse@vignan.ac.in | Vignan@72846193 |

Full list: project `README.md`.

**Local:** http://localhost:5173/login · API http://localhost:3000/api  
**Deployed (if live):** Frontend Vercel · Backend https://agent-58.onrender.com/api  

---

## 10. Judge FAQ (short answers)

| Question | Answer |
|---|---|
| How is load computed? | Weighted sum of activities vs DB norms; engine is deterministic. |
| Does timetable double-count teaching? | No — official teaching from allocations. |
| Can HOD try scenarios safely? | Yes — What-if never writes. |
| Who approves? | HOD submits → Dean → optional Principal finalize. |
| Why DEMO depts? | Until real timetables imported; people data still official. |
| Security? | JWT access/refresh + role permissions; secrets in env, not in git. |

---

## 11. Action checklist before demo

- [ ] Backend running (local or Render awake)  
- [ ] Frontend running / Vercel live  
- [ ] `VITE_API_URL` points to correct API  
- [ ] DB seeded + photos synced (`db:enrich:official`, `db:sync:official`)  
- [ ] Test login for HR, HOD, Faculty, Dean, Principal  
- [ ] One faculty statement download works  
- [ ] One Dean/Principal dashboard shows multiple departments  

---

## 12. One-page summary for the judge

**Plan:** Define norms (HR) → Capture academic work (HOD) → Calculate status (Engine) → Faculty verify → Approve (Dean/Principal) → Report & comply.  

**Flow:** Data in → Snapshot out → Role dashboards → Approval trail → Exports.  

**Actions you will show:** Login by role → Workload colors → What-if → Statement → Dean/Principal oversight → Compliance/report.
